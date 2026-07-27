OJT Admin Website - Supabase Connected Empty Version

This is the admin website only.

Files:
- login.html
- logout.html
- index.html
- students.html
- applications.html
- documents.html
- certificates.html
- reports.html
- assets/css/style.css
- assets/js/script.js
- assets/js/supabase-config.js
- database/supabase_schema.sql

Admin login configuration:
- Copy assets/js/config.local.example.js to assets/js/config.local.js.
- Set a private administrator username and SHA-256 password hash.
- Never commit config.local.js.

Important changes:
- All placeholder sample records were removed.
- Students page starts empty.
- Applications page starts empty.
- Documents page is connected to Supabase.
- Certificates page starts empty.
- Reports page starts empty.
- A new localStorage key is used so old sample data should not appear.

Supabase setup:
1. Copy assets/js/config.local.example.js to assets/js/config.local.js.
2. Paste your Supabase Project URL into the local file.
3. Paste your Supabase Publishable/Anon key into the local file.
4. Make sure your Supabase table is named: ojt_uploads
5. Make sure your Supabase storage bucket is named: ojt-documents

Note:
If old data still appears in your browser, clear site data or open DevTools Console and run:

localStorage.clear();
location.reload();

Do not paste your Supabase secret service_role key into JavaScript.

Login color update:
- Login page background changed to green gradient: #043915 to #6cae66d3
- Login left panel changed to the same green gradient
- InternTrack highlight changed to #15cf69
- Login button changed to #166534
- Login button hover/focus changed to #14532d
CERTIFICATE UPDATE
- Certificates page now loads real student completion data from Supabase student_accounts.
- A student becomes eligible when completed_hours is greater than or equal to required_hours.
- Admin can preview, edit issue date/signer details, print/save as PDF, or download a generated PDF.
- The certificate includes student name, student ID, course, office assigned, required/completed hours, issue date, and signature labels.
