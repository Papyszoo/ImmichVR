#!/bin/sh

# Generate self-signed certificate if it doesn't exist
if [ ! -f /etc/nginx/ssl/server.crt ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/server.key \
        -out /etc/nginx/ssl/server.crt \
        -subj "/C=US/ST=Local/L=Local/O=ImmichVR/CN=immichvr.local" \
        -addext "subjectAltName=DNS:localhost,DNS:immichvr.local,IP:127.0.0.1"
    echo "SSL certificate generated."
fi

# Start nginx
exec "$@"
