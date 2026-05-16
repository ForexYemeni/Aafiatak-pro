#!/usr/bin/env bash
# ============================================================================
# عافيتك (Aafiatak) Healthcare Platform - Firebase Environment Setup for Vercel
# ============================================================================
# Sets Firebase Admin SDK environment variables on Vercel using the Vercel API.
#
# Usage:
#   ./scripts/setup-firebase-env.sh <path-to-service-account.json> [vercel-project-id] [vercel-team-id]
#
# Example:
#   ./scripts/setup-firebase-env.sh ./firebase-service-account.json
#   ./scripts/setup-firebase-env.sh ./firebase-service-account.json proj_abc123 team_xyz789
#
# Prerequisites:
#   - jq (JSON processor) must be installed
#   - VERCEL_TOKEN environment variable must be set (or you'll be prompted)
#   - Vercel CLI installed and project linked (for auto-detecting project ID)
# ============================================================================

set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper Functions ─────────────────────────────────────────────────
info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Check Prerequisites ─────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || error "jq is required but not installed. Install it with: apt install jq / brew install jq"

# ── Arguments ────────────────────────────────────────────────────────
SERVICE_ACCOUNT_FILE="${1:-}"
VERCEL_PROJECT_ID="${2:-}"
VERCEL_TEAM_ID="${3:-}"

if [ -z "$SERVICE_ACCOUNT_FILE" ]; then
  error "Usage: $0 <path-to-service-account.json> [vercel-project-id] [vercel-team-id]"
fi

if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
  error "File not found: $SERVICE_ACCOUNT_FILE"
fi

# ── Extract values from service account JSON ─────────────────────────
info "Reading service account JSON: $SERVICE_ACCOUNT_FILE"

PROJECT_ID=$(jq -r '.project_id // empty' "$SERVICE_ACCOUNT_FILE")
CLIENT_EMAIL=$(jq -r '.client_email // empty' "$SERVICE_ACCOUNT_FILE")
PRIVATE_KEY=$(jq -r '.private_key // empty' "$SERVICE_ACCOUNT_FILE")

if [ -z "$PROJECT_ID" ]; then
  error "Could not extract 'project_id' from $SERVICE_ACCOUNT_FILE"
fi
if [ -z "$CLIENT_EMAIL" ]; then
  error "Could not extract 'client_email' from $SERVICE_ACCOUNT_FILE"
fi
if [ -z "$PRIVATE_KEY" ]; then
  error "Could not extract 'private_key' from $SERVICE_ACCOUNT_FILE"
fi

ok "Extracted: project_id=$PROJECT_ID, client_email=$CLIENT_EMAIL"
info "Private key length: ${#PRIVATE_KEY} characters"

# ── Vercel Token ─────────────────────────────────────────────────────
VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [ -z "$VERCEL_TOKEN" ]; then
  # Try to read from Vercel CLI config
  if [ -f "$HOME/.vercel/auth.json" ]; then
    VERCEL_TOKEN=$(jq -r '.token // empty' "$HOME/.vercel/auth.json" 2>/dev/null || true)
  fi
fi

if [ -z "$VERCEL_TOKEN" ]; then
  echo ""
  warn "VERCEL_TOKEN not found."
  echo "  Please set it as an environment variable:"
  echo "    export VERCEL_TOKEN=your_vercel_api_token"
  echo ""
  echo "  You can create a token at: https://vercel.com/account/tokens"
  echo ""
  read -rp "Or paste your Vercel token now: " VERCEL_TOKEN
  if [ -z "$VERCEL_TOKEN" ]; then
    error "Vercel token is required"
  fi
fi

# ── Vercel Project ID ────────────────────────────────────────────────
if [ -z "$VERCEL_PROJECT_ID" ]; then
  # Try to auto-detect from .vercel directory
  if [ -f ".vercel/project.json" ]; then
    VERCEL_PROJECT_ID=$(jq -r '.orgId // empty' .vercel/project.json 2>/dev/null || true)
    # Note: orgId might not be projectId — try projectId field
    ALT_ID=$(jq -r '.projectId // empty' .vercel/project.json 2>/dev/null || true)
    if [ -n "$ALT_ID" ]; then
      VERCEL_PROJECT_ID="$ALT_ID"
    fi
  fi
fi

if [ -z "$VERCEL_PROJECT_ID" ]; then
  echo ""
  warn "Could not auto-detect Vercel project ID."
  echo "  You can find it in your Vercel project settings."
  echo ""
  read -rp "Enter your Vercel project ID: " VERCEL_PROJECT_ID
  if [ -z "$VERCEL_PROJECT_ID" ]; then
    error "Vercel project ID is required"
  fi
fi

info "Using Vercel project ID: $VERCEL_PROJECT_ID"

# ── Base64-encode the private key ───────────────────────────────────
# Vercel env vars have issues with multi-line values and special characters.
# Base64 encoding avoids all these problems.
PRIVATE_KEY_B64=$(echo -n "$PRIVATE_KEY" | base64 -w 0)

info "Base64-encoded private key length: ${#PRIVATE_KEY_B64} characters"

# ── Set Vercel Environment Variables ─────────────────────────────────
VERCEL_API_BASE="https://api.vercel.com"

set_vercel_env() {
  local key="$1"
  local value="$2"
  local target="${3:-production,preview,development}"

  info "Setting $key on Vercel..."

  local payload
  payload=$(jq -n \
    --arg key "$key" \
    --arg value "$value" \
    --arg target "$target" \
    '{key: $key, value: $value, target: ($target | split(","))}')

  local response
  local http_code

  response=$(curl -s -w "\n%{http_code}" -X POST \
    "${VERCEL_API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/env${VERCEL_TEAM_ID:+?teamId=$VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    ok "$key set successfully (HTTP $http_code)"
  elif [ "$http_code" = "409" ]; then
    # Variable already exists — update it
    warn "$key already exists. Updating..."

    # Get the variable ID
    local var_id
    var_id=$(echo "$body" | jq -r '.id // empty' 2>/dev/null || true)

    if [ -z "$var_id" ]; then
      # Try to find the existing variable
      local existing
      existing=$(curl -s \
        "${VERCEL_API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/env${VERCEL_TEAM_ID:+?teamId=$VERCEL_TEAM_ID}" \
        -H "Authorization: Bearer $VERCEL_TOKEN")

      var_id=$(echo "$existing" | jq -r ".envs[] | select(.key == \"$key\") | .id" 2>/dev/null | head -1 || true)
    fi

    if [ -n "$var_id" ]; then
      local update_payload
      update_payload=$(jq -n \
        --arg value "$value" \
        --arg target "$target" \
        '{value: $value, target: ($target | split(","))}')

      local update_response
      update_response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "${VERCEL_API_BASE}/v9/projects/${VERCEL_PROJECT_ID}/env/${var_id}${VERCEL_TEAM_ID:+?teamId=$VERCEL_TEAM_ID}" \
        -H "Authorization: Bearer $VERCEL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$update_payload")

      local update_code
      update_code=$(echo "$update_response" | tail -1)

      if [ "$update_code" -ge 200 ] && [ "$update_code" -lt 300 ]; then
        ok "$key updated successfully (HTTP $update_code)"
      else
        warn "Failed to update $key (HTTP $update_code)"
      fi
    else
      warn "Could not find existing variable ID for $key to update"
    fi
  else
    warn "Failed to set $key (HTTP $http_code): $(echo "$body" | head -c 200)"
  fi
}

# Set each environment variable
set_vercel_env "FIREBASE_PROJECT_ID" "$PROJECT_ID"
set_vercel_env "FIREBASE_CLIENT_EMAIL" "$CLIENT_EMAIL"
set_vercel_env "FIREBASE_PRIVATE_KEY" "$PRIVATE_KEY_B64"

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "========================================="
ok "Firebase environment variables configured!"
echo "========================================="
echo ""
echo "  FIREBASE_PROJECT_ID  = $PROJECT_ID"
echo "  FIREBASE_CLIENT_EMAIL = $CLIENT_EMAIL"
echo "  FIREBASE_PRIVATE_KEY  = <base64-encoded, ${#PRIVATE_KEY_B64} chars>"
echo ""
echo "  Project ID: $VERCEL_PROJECT_ID"
echo ""
info "Next steps:"
echo "  1. Redeploy your Vercel project for the env vars to take effect:"
echo "     vercel --prod"
echo ""
echo "  2. Or trigger a redeployment from the Vercel dashboard."
echo ""
echo "  3. Verify the env vars are set correctly:"
echo "     vercel env ls"
echo ""
echo "  Note: The private key is base64-encoded. The firebase-admin-sdk.ts"
echo "  will automatically decode it at runtime."
echo ""
echo "  Alternatively, you can configure Firebase credentials from the"
echo "  admin dashboard at: /api/admin/firebase-config"
