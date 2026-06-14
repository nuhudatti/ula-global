#!/usr/bin/env bash
# Obtain and install Let's Encrypt certificate for ULA.
# Usage: sudo ./ssl-setup.sh ula.yourdomain.com [admin@email.com]
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo $0 <domain> [letsencrypt-email]"
  exit 1
fi

if ! command -v certbot &>/dev/null; then
  echo "[ula-ssl] Installing certbot..."
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure nginx site is installed first
if [[ ! -f /etc/nginx/sites-available/ula ]]; then
  echo "[ula-ssl] Nginx site not found — running install-nginx.sh..."
  "$SCRIPT_DIR/install-nginx.sh" "$DOMAIN"
fi

mkdir -p /var/www/certbot

CERTBOT_ARGS=(--nginx -d "$DOMAIN" --agree-tos --non-interactive --redirect)
if [[ -n "$EMAIL" ]]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

echo "[ula-ssl] Requesting certificate for $DOMAIN..."
certbot "${CERTBOT_ARGS[@]}"

echo "[ula-ssl] Enabling automatic renewal (certbot systemd timer)..."
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

# Reload hook — nginx picks up renewed certs
HOOK="/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh"
mkdir -p "$(dirname "$HOOK")"
cat > "$HOOK" <<'EOF'
#!/bin/bash
nginx -t && systemctl reload nginx
EOF
chmod +x "$HOOK"

nginx -t
systemctl reload nginx

echo "[ula-ssl] Certificate installed. Verify:"
echo "  curl -I https://$DOMAIN"
echo "  curl -s https://$DOMAIN/api/health | jq ."
