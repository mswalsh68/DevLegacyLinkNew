# LegacyLink — Database Deployment Guide

## Architecture

```
Azure SQL Logical Server
├── LegacyLinkGlobal          ← one, shared across all tenants
│   ├── dbo.sp_GetOrCreateUser
│   └── dbo.sp_TransferPlayerToAlumni
│
├── LegacyLinkApp_<TeamSlug>  ← one per team/client
│   ├── dbo.syn_GetOrCreateUser        (synonym → GlobalDB)
│   ├── dbo.syn_TransferPlayerToAlumni (synonym → GlobalDB)
│   └── dbo.sp_CreatePlayer, sp_GraduatePlayer, …
│
└── LegacyLinkApp_<TeamSlug2> ← another team, same pattern
```

**Key rule**: Every App DB must be on the **same Azure SQL logical server**
as the Global DB. Azure SQL supports cross-database synonyms within the same
logical server but not across servers.

---

## Files

| File | Purpose |
|------|---------|
| `app/stored-procedures/00_create_synonyms.sql` | Creates `syn_GetOrCreateUser` and `syn_TransferPlayerToAlumni` in the App DB. Uses SQLCMD variable `$(GlobalDb)` — run via sqlcmd, not Azure Portal. |
| `app/stored-procedures/sp_App_AllProcedures.sql` | All App DB stored procedures. References synonyms (no 4-part names). Run **after** the synonyms script. |

---

## Why Synonyms?

Azure SQL does not support linked servers or 4-part names
(`[GLOBAL_DB].LegacyLinkGlobal.dbo.sp_GetOrCreateUser`).

Synonyms give each App DB a local alias that SQL Server resolves at runtime:

```sql
-- App DB procedure calls this local alias:
EXEC dbo.syn_GetOrCreateUser @Email = ..., @UserId = @UserId OUTPUT, ...

-- SQL Server looks up the synonym and routes to:
-- [LegacyLinkGlobal].[dbo].[sp_GetOrCreateUser]
```

The synonym target uses a SQLCMD variable (`$(GlobalDb)`) so the same script
works for both dev and production without code changes.

---

## Deploying a New App DB

### Option A — Helper scripts (recommended)

**Windows (PowerShell):**
```powershell
.\scripts\deploy-app-db.ps1 `
    -Server   "myserver.database.windows.net" `
    -AppDb    "LegacyLinkApp_Bulls" `
    -GlobalDb "LegacyLinkGlobal" `
    -Username "sqladmin" `
    -Password $env:AZURE_SQL_PASSWORD
```

**Linux / macOS / GitHub Actions (Bash):**
```bash
./scripts/deploy-app-db.sh \
    --server    myserver.database.windows.net \
    --app-db    LegacyLinkApp_Bulls \
    --global-db LegacyLinkGlobal \
    --username  sqladmin \
    --password  "$AZURE_SQL_PASSWORD"
```

---

### Option B — Run scripts manually with sqlcmd

> ⚠️ Do **not** use the Azure Portal query editor — it does not support SQLCMD
> mode and the `$(GlobalDb)` variable will be treated as undefined.
> Use SSMS in SQLCMD mode, Azure Data Studio, or the `sqlcmd` CLI.

**Step 1 — Synonyms** (pass the correct GlobalDb for your environment):
```bash
# Production
sqlcmd -S myserver.database.windows.net -d LegacyLinkApp_Bulls \
  -U sqladmin -P <password> \
  -v GlobalDb="LegacyLinkGlobal" \
  -i databases/app/stored-procedures/00_create_synonyms.sql -b

# Dev (local SQL Express)
sqlcmd -S localhost\SQLEXPRESS -d DevLegacyLinkApp -E \
  -v GlobalDb="DevLegacyLinkGlobal" \
  -i databases/app/stored-procedures/00_create_synonyms.sql -b
```

**Step 2 — Stored procedures** (no extra variables needed):
```bash
sqlcmd -S myserver.database.windows.net -d LegacyLinkApp_Bulls \
  -U sqladmin -P <password> \
  -i databases/app/stored-procedures/sp_App_AllProcedures.sql -b
```

The `-b` flag makes sqlcmd exit with a non-zero code on any SQL error,
so failures are never silently swallowed.

---

## First-Time Azure SQL Permissions

After the synonyms are created, grant the app service account the right to
execute them. Connect to the **App DB** and run:

```sql
GRANT EXECUTE ON dbo.syn_GetOrCreateUser        TO [app_service_user];
GRANT EXECUTE ON dbo.syn_TransferPlayerToAlumni TO [app_service_user];
```

Then connect to the **Global DB** and grant access to the target procedures:

```sql
GRANT EXECUTE ON dbo.sp_GetOrCreateUser        TO [app_service_user];
GRANT EXECUTE ON dbo.sp_TransferPlayerToAlumni TO [app_service_user];
```

Replace `app_service_user` with your actual Azure SQL login or
Entra ID (AAD) service principal name.

---

## CI/CD — GitHub Actions

The workflow `.github/workflows/deploy-database.yml` runs automatically on
every push to `main` that changes `databases/**` or `scripts/**`.

You can also trigger it manually (**Actions → Deploy Database → Run workflow**)
to deploy to a specific App DB without a code change.

### Required Secrets

Add these in **Settings → Secrets and variables → Actions**:

| Secret | Example value |
|--------|---------------|
| `AZURE_SQL_SERVER` | `myserver.database.windows.net` |
| `AZURE_SQL_USERNAME` | `sqladmin` |
| `AZURE_SQL_PASSWORD` | *(your password)* |
| `GLOBAL_DB_NAME` | `LegacyLinkGlobal` |

Add this Repository Variable (not a secret):

| Variable | Example value |
|----------|---------------|
| `APP_DB_NAME` | `LegacyLinkApp` *(default for push-triggered runs)* |

### Azure Firewall

Azure SQL must allow connections from GitHub Actions runners. In the Azure
Portal → your SQL Server → **Networking**, enable:

> ✅ Allow Azure services and resources to access this server

---

## Adding a Second App DB (new tenant)

1. Provision the new database on the same Azure SQL logical server.
2. Run the deploy script with the new DB name:
   ```bash
   ./scripts/deploy-app-db.sh \
     --server    myserver.database.windows.net \
     --app-db    LegacyLinkApp_NewTeam \
     --global-db LegacyLinkGlobal \
     --username  sqladmin \
     --password  "$AZURE_SQL_PASSWORD"
   ```
3. Grant permissions to the app service account (see above).
4. Set the `APP_DB_NAME` secret / env var in the application config for that tenant.

That is the entire onboarding process for a new tenant.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `$(GlobalDb)` appears literally in synonym target | Script run in Azure Portal query editor | Use sqlcmd CLI instead |
| `Could not find stored procedure 'dbo.syn_GetOrCreateUser'` | Synonyms not created yet | Run `00_create_synonyms.sql` first |
| `The server principal … is not able to access the database` | Missing cross-DB permission | Grant EXECUTE on target SPs in the Global DB |
| `SQL71562` in SSDT/DACPAC build | SSDT can't resolve external reference at build time | Add Global DB as a DACPAC database reference in the .sqlproj, or suppress warning 71562 |
| Synonym resolves but SP fails | Both DBs must be on the same logical server | Confirm server names match in Azure Portal |
