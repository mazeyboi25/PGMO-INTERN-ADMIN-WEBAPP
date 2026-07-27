-- PGMO PATCH: Student portal document delete restriction
-- Optional hardening patch. The frontend already removes the student delete button.
-- Run this only if you want to remove the public delete policy for uploaded documents.
-- Note: If admin deletion also depends on the same public policy, create an admin RPC first before running this.

drop policy if exists "Allow public delete uploads" on public.ojt_uploads;

-- Do not create a replacement public delete policy here.
-- Approved documents and student submissions should be managed by admin-side actions only.
