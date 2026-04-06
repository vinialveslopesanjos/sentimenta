#!/bin/bash
# Verify a test user's email directly in the database.
# Usage: ./verify-email.sh <email>
EMAIL="$1"
if [ -z "$EMAIL" ]; then
  echo "Usage: $0 <email>" >&2
  exit 1
fi
PGPASSWORD='Vini201297##' psql -h localhost -U sentimenta -d sentimenta_db -tAc \
  "UPDATE users SET email_verified = true, email_verification_token = NULL WHERE email = '${EMAIL}' RETURNING id;"
