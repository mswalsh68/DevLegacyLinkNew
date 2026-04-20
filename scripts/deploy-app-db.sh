#!/usr/bin/env bash
# =============================================================================
# deploy-app-db.sh
# Deploys synonyms and stored procedures to a LegacyLink App DB.
#
# Usage:
#   ./scripts/deploy-app-db.sh [options]
#
# Options:
#   --server     <host>      SQL Server host (required)
#                            Local : localhost\SQLEXPRESS  (or localhost for Linux)
#                            Azure : <name>.database.windows.net
#   --app-db     <name>      App DB name (required)
#   --global-db  <name>      Global DB name (default: LegacyLinkGlobal)
#   --username   <login>     SQL login (omit for Windows/Integrated auth)
#   --password   <pass>      SQL password (omit for Windows/Integrated auth)
#
# Examples:
#   # Local dev — Linux Docker SQL Server, no auth
#   ./scripts/deploy-app-db.sh \
#     --server localhost --app-db DevLegacyLinkApp \
#     --global-db DevLegacyLinkGlobal \
#     --username sa --password YourPassword1!
#
#   # Azure SQL — SQL auth (typical CI/CD usage)
#   ./scripts/deploy-app-db.sh \
#     --server myserver.database.windows.net \
#     --app-db LegacyLinkApp_Bulls \
#     --global-db LegacyLinkGlobal \
#     --username sqladmin \
#     --password "$AZURE_SQL_PASSWORD"
#
# Requirements:
#   sqlcmd must be on PATH.
#   Ubuntu/Debian: https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility
#   macOS        : brew install sqlcmd
#   GitHub Actions: ubuntu-latest ships with mssql-tools18 pre-installed.
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
SERVER=""
APP_DB=""
GLOBAL_DB="LegacyLinkGlobal"
USERNAME=""
PASSWORD=""

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --server)    SERVER="$2";    shift 2 ;;
        --app-db)    APP_DB="$2";    shift 2 ;;
        --global-db) GLOBAL_DB="$2"; shift 2 ;;
        --username)  USERNAME="$2";  shift 2 ;;
        --password)  PASSWORD="$2";  shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ -z "$SERVER" || -z "$APP_DB" ]]; then
    echo "Error: --server and --app-db are required." >&2
    exit 1
fi

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SYN_SCRIPT="$REPO_ROOT/databases/app/stored-procedures/00_create_synonyms.sql"
SP_SCRIPT="$REPO_ROOT/databases/app/stored-procedures/sp_App_AllProcedures.sql"

for f in "$SYN_SCRIPT" "$SP_SCRIPT"; do
    if [[ ! -f "$f" ]]; then
        echo "Error: required file not found: $f" >&2
        exit 1
    fi
done

# ── Build base sqlcmd args ────────────────────────────────────────────────────
BASE_ARGS=(-S "$SERVER" -d "$APP_DB" -b -I)

if [[ -n "$USERNAME" && -n "$PASSWORD" ]]; then
    BASE_ARGS+=(-U "$USERNAME" -P "$PASSWORD")
fi

# ── Helper ────────────────────────────────────────────────────────────────────
run_script() {
    local label="$1"
    local script="$2"
    shift 2
    local extra_args=("$@")

    echo ""
    echo "[$label]"
    echo "  Script : $script"

    sqlcmd "${BASE_ARGS[@]}" "${extra_args[@]}" -i "$script"

    echo "  ✓ Done"
}

# ── Deploy ────────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo " LegacyLink App DB Deployment"
echo "========================================"
echo " Server   : $SERVER"
echo " App DB   : $APP_DB"
echo " Global DB: $GLOBAL_DB"
echo "========================================"

run_script "1/2  Synonyms" "$SYN_SCRIPT" \
    -v "GlobalDb=$GLOBAL_DB"

run_script "2/2  Stored Procedures" "$SP_SCRIPT"

echo ""
echo "========================================"
echo " Deployment complete."
echo "========================================"
echo ""
echo "Next steps (first-time Azure SQL only):"
echo "  1. Grant EXECUTE on both synonyms in $APP_DB to your app service user."
echo "     See the GRANT block at the bottom of 00_create_synonyms.sql."
echo "  2. Grant EXECUTE on the target SPs in $GLOBAL_DB to the same user."
