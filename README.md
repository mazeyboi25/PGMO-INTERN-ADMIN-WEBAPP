# PGMO OJT Management System

This repository contains the PGMO OJT student portal and administrative interface.

## Project structure

- `student-portal/` — student login, profile, requirements, document uploads, DTR, and related pages
- `admin-integration/` — administrative dashboard, student records, documents, reports, certificates, and DTR management
- `database/` — database setup and patch scripts

## Local configuration

Credentials are intentionally excluded from the repository.

1. Copy `student-portal/assets/js/config.local.example.js` to `student-portal/assets/js/config.local.js`.
2. Copy `admin-integration/assets/js/config.local.example.js` to `admin-integration/assets/js/config.local.js`.
3. Enter the Supabase project URL and publishable/anon key in both local files.
4. In the admin local file, enter the initial administrator username and a SHA-256 password hash.
5. Keep both `config.local.js` files private. They are excluded by `.gitignore`.

### Generate an administrator password hash

Run this in a browser developer console and replace `YOUR_PASSWORD` locally:

```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("YOUR_PASSWORD"))
  .then(buffer => [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join(""))
  .then(console.log);
```

## Running locally

Serve the repository using a local web server rather than opening HTML files directly. For example:

```bash
python -m http.server 8000
```

Then open:

- Student portal: `http://localhost:8000/student-portal/`
- Admin interface: `http://localhost:8000/admin-integration/login.html`

## Security notes

- Never commit service-role keys, database passwords, private API keys, or administrator passwords.
- A Supabase publishable/anon key is used by browser applications, but its safety depends on correctly configured Row Level Security policies.
- The current administrator bootstrap login is browser-side. Before public production deployment, replace it with server-validated authentication such as Supabase Auth and review all database policies and RPC permissions.
- Rotate any credential that has previously been published or shared publicly.
