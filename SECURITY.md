# Security Policy

Do not report real credentials in public issues or pull requests.

Before publishing or deploying this project:

1. Confirm that no `config.local.js`, `.env`, service-role key, password, or private token is tracked.
2. Review Supabase Row Level Security policies and database function permissions.
3. Replace browser-only administrator authentication with server-validated authentication for production use.
4. Rotate credentials immediately if they are accidentally committed.
