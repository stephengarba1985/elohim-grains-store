# Production database protection

Keep database and application secrets in the production host's secret manager or
environment configuration. Do not commit `.env` files, connection strings, API
keys, or private certificates to Git.

## Required deployment settings

- Set `NODE_ENV=production` and a production-only `DATABASE_URL`.
- Production database connections use TLS by default. Configure `DB_SSL_CA` with
  the database provider's CA certificate if its certificate chain is not already
  trusted by the runtime. Do not disable certificate verification in production.
- Use separate database users and credentials for production, staging, and local
  development. Grant the application user only the privileges it needs.
- Rotate database credentials and application secrets after staff changes or any
  suspected exposure.

## Operational controls

- Enable automated encrypted backups and test restoring them regularly.
- Enable point-in-time recovery where the selected database provider supports it.
- Limit network access to the database to the application/deployment network and
  approved administrative access; do not expose the database publicly.
- Keep a documented retention period and an owner for backup-restore testing.
- Store production secrets only in the deployment environment; frontend variables
  prefixed with `NEXT_PUBLIC_` must never contain database or payment secrets.
