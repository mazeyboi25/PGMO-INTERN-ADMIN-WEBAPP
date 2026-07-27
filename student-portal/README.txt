PGMO Student Portal - Multi Page Fixed Version

This version fixes the dashboard structure.

Main changes:
- dashboard.html only contains dashboard content
- profile.html has My Profile
- documents.html has Documents Overview
- upload.html has Upload Documents
- submissions.html has My Submissions
- requirements.html has OJT Requirements
- notifications.html has Notifications
- help.html has Help & Support
- sidebar.html is included as a reusable sidebar reference
- student.js now supports all separate pages
- upload system is fixed and redirects to submissions.html after upload
- registration/login still uses Supabase student_accounts
- uploads still use Supabase Storage and ojt_uploads

Important:
Run database/supabase_student_accounts_schema.sql in Supabase SQL Editor.

Make sure Storage bucket exists:
ojt-documents

Make sure assets/js/config.js contains:
SUPABASE_URL
SUPABASE_ANON_KEY
OJT_STORAGE_BUCKET
OJT_UPLOADS_TABLE
STUDENT_ACCOUNTS_TABLE

If old data causes problems, run this once in browser Console:
localStorage.clear();
sessionStorage.clear();
location.reload();

Upload preview fix:
- upload.html now shows the selected file before upload.
- student.js updates the preview when a file is selected or cleared.
- style.css includes selected file preview styling.
