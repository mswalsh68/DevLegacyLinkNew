<#
.SYNOPSIS
    Deploys synonyms and stored procedures to a LegacyLink App DB.

.DESCRIPTION
    Runs, in order:
      1. 00_create_synonyms.sql  — creates dbo.syn_GetOrCreateUser and
                                   dbo.syn_TransferPlayerToAlumni
      2. sp_App_AllProcedures.sql — creates / replaces all App DB SPs

    Both scripts are run via sqlcmd so SQLCMD variables ($(GlobalDb))
    are resolved before SQL Server parses the statement.

.PARAMETER Server
    SQL Server host.
    Local  : localhost\SQLEXPRESS
    Azure  : <name>.database.windows.net

.PARAMETER AppDb
    Name of the App DB to deploy to (e.g. DevLegacyLinkApp or
    LegacyLinkApp_TeamSlug).

.PARAMETER GlobalDb
    Name of the Global DB that contains sp_GetOrCreateUser and
    sp_TransferPlayerToAlumni.
    Default : LegacyLinkGlobal
    Dev     : DevLegacyLinkGlobal

.PARAMETER Username
    SQL login username. Omit to use Windows / Integrated auth.

.PARAMETER Password
    SQL login password. Omit to use Windows / Integrated auth.

.EXAMPLE
    # Local dev — Windows auth
    .\scripts\deploy-app-db.ps1 `
        -Server "localhost\SQLEXPRESS" `
        -AppDb  "DevLegacyLinkApp" `
        -GlobalDb "DevLegacyLinkGlobal"

.EXAMPLE
    # Azure SQL — SQL auth
    .\scripts\deploy-app-db.ps1 `
        -Server   "myserver.database.windows.net" `
        -AppDb    "LegacyLinkApp_Bulls" `
        -GlobalDb "LegacyLinkGlobal" `
        -Username "sqladmin" `
        -Password $env:AZURE_SQL_PASSWORD
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [Parameter(Mandatory = $true)]
    [string]$AppDb,

    [Parameter(Mandatory = $false)]
    [string]$GlobalDb = 'LegacyLinkGlobal',

    [Parameter(Mandatory = $false)]
    [string]$Username,

    [Parameter(Mandatory = $false)]
    [string]$Password
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Resolve script paths ─────────────────────────────────────────────────────
$RepoRoot  = Split-Path -Parent $PSScriptRoot
$SynScript = Join-Path $RepoRoot 'databases\app\stored-procedures\00_create_synonyms.sql'
$SpScript  = Join-Path $RepoRoot 'databases\app\stored-procedures\sp_App_AllProcedures.sql'

foreach ($f in $SynScript, $SpScript) {
    if (-not (Test-Path $f)) {
        throw "Required file not found: $f"
    }
}

# ── Build common sqlcmd args ──────────────────────────────────────────────────
$baseArgs = @('-S', $Server, '-d', $AppDb, '-b', '-I')

if ($Username -and $Password) {
    $baseArgs += '-U', $Username, '-P', $Password
} else {
    $baseArgs += '-E'   # Windows / Integrated auth
}

function Invoke-Sqlcmd-Script {
    param(
        [string]$Label,
        [string]$ScriptPath,
        [string[]]$ExtraArgs = @()
    )

    Write-Host ""
    Write-Host "[$Label]" -ForegroundColor Cyan
    Write-Host "  Script : $ScriptPath"

    $allArgs = $baseArgs + $ExtraArgs + @('-i', $ScriptPath)
    & sqlcmd @allArgs

    if ($LASTEXITCODE -ne 0) {
        throw "sqlcmd exited with code $LASTEXITCODE on step: $Label"
    }

    Write-Host "  ✓ Done" -ForegroundColor Green
}

# ── Deploy ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================"
Write-Host " LegacyLink App DB Deployment"
Write-Host "========================================"
Write-Host " Server   : $Server"
Write-Host " App DB   : $AppDb"
Write-Host " Global DB: $GlobalDb"
Write-Host "========================================"

Invoke-Sqlcmd-Script `
    -Label     '1/2  Synonyms' `
    -ScriptPath $SynScript `
    -ExtraArgs  @('-v', "GlobalDb=$GlobalDb")

Invoke-Sqlcmd-Script `
    -Label     '2/2  Stored Procedures' `
    -ScriptPath $SpScript

Write-Host ""
Write-Host "========================================"
Write-Host " Deployment complete." -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Next steps (first-time Azure SQL only):"
Write-Host "  1. Grant EXECUTE on both synonyms to your app service user."
Write-Host "     See the GRANT block at the bottom of 00_create_synonyms.sql."
Write-Host "  2. Grant EXECUTE on the target SPs in $GlobalDb to the same user."
