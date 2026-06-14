#!/usr/bin/env bash
# Post-deployment HTTPS verification for ULA.
# Usage: ./verify-https.sh https://ula.yourdomain.com
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Usage: $0 https://your-domain"
  exit 1
fi

BASE="${BASE%/}"
DOMAIN="${BASE#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%%/*}"

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "ULA HTTPS verification — $BASE"
echo ""

echo "1. HTTP → HTTPS redirect"
REDIRECT=$(curl -sI "http://$DOMAIN" | head -1)
check "HTTP redirects to HTTPS" echo "$REDIRECT" | grep -qE '301|308'

echo ""
echo "2. TLS certificate"
check "HTTPS responds" curl -sfI "$BASE/api/health" -o /dev/null
EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null || true)
if [[ -n "$EXPIRY" ]]; then
  echo "  ℹ Certificate $EXPIRY"
fi

echo ""
echo "3. Security headers"
HEADERS=$(curl -sI "$BASE/")
check "HSTS present" echo "$HEADERS" | grep -qi 'strict-transport-security'
check "X-Content-Type-Options" echo "$HEADERS" | grep -qi 'x-content-type-options: nosniff'
check "CSP present" echo "$HEADERS" | grep -qi 'content-security-policy'

echo ""
echo "4. API health"
HEALTH=$(curl -sf "$BASE/api/health")
check "Health ok:true" echo "$HEALTH" | grep -q '"ok":true'
check "HTTPS URLs in health" echo "$HEALTH" | grep -q '"https"'

echo ""
echo "5. Tenant + platform routes (SPA)"
for path in "/" "/platform/login" "/ibbul" "/ibbul/login"; do
  CODE=$(curl -sI -o /dev/null -w "%{http_code}" "$BASE$path")
  check "$path returns 200" [[ "$CODE" == "200" ]]
done

echo ""
echo "6. Node verification script"
if [[ -f "$(dirname "$0")/../../scripts/verify-https-deployment.js" ]]; then
  BASE_URL="$BASE" node "$(dirname "$0")/../../scripts/verify-https-deployment.js" && check "Node verifier" true || check "Node verifier" false
fi

echo ""
echo "────────────────────────────"
echo "Passed: $PASS  Failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo "All checks passed."
