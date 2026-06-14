#!/usr/bin/env bash
# Install ULA Nginx configuration on Ubuntu/Debian.
# Usage: sudo ./install-nginx.sh ula.yourdomain.com
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo $0 <domain>"
  echo "Example: sudo $0 ula.ibbul.edu.ng"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NGINX_AVAILABLE="/etc/nginx/sites-available/ula"
NGINX_ENABLED="/etc/nginx/sites-enabled/ula"
SNIPPETS_DIR="/etc/nginx/snippets"

echo "[ula-nginx] Installing snippets..."
mkdir -p "$SNIPPETS_DIR" /var/www/certbot
cp "$REPO_ROOT/deploy/nginx/snippets/ssl-params.conf" "$SNIPPETS_DIR/ula-ssl-params.conf"
cp "$REPO_ROOT/deploy/nginx/snippets/security-headers.conf" "$SNIPPETS_DIR/ula-security-headers.conf"
cp "$REPO_ROOT/deploy/nginx/snippets/proxy.conf" "$SNIPPETS_DIR/ula-proxy.conf"

echo "[ula-nginx] Installing rate-limit zones in /etc/nginx/conf.d/ula-rate-limit.conf..."
cat > /etc/nginx/conf.d/ula-rate-limit.conf <<'EOF'
# ULA rate limiting — included in http {} via conf.d
limit_req_zone $binary_remote_addr zone=ula_auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=ula_api:10m rate=120r/m;
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

echo "[ula-nginx] Generating site config for $DOMAIN..."
sed "s/__ULA_DOMAIN__/$DOMAIN/g" "$REPO_ROOT/deploy/nginx/ula.conf.template" > "$NGINX_AVAILABLE"

ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

echo "[ula-nginx] Testing configuration..."
nginx -t

echo "[ula-nginx] Done. Next steps:"
echo "  1. Ensure DNS A record points to this server"
echo "  2. Run: sudo $SCRIPT_DIR/ssl-setup.sh $DOMAIN"
echo "  3. Run: sudo systemctl reload nginx"
