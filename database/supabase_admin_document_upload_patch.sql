-- Optional patch for Admin document upload support.
-- Run this if admin upload cannot upload, view, or replace files in Supabase Storage.

create policy if not exists "Allow public update ojt documents"
on storage.objects for update
using (bucket_id = 'ojt-documents')
with check (bucket_id = 'ojt-documents');

create policy if not exists "Allow public delete ojt documents"
on storage.objects for delete
using (bucket_id = 'ojt-documents');

-- ojt_uploads already has public insert/select/update policies in the main schema.


-- Allow document records to be deleted from the admin/student document views.
drop policy if exists "Allow public delete uploads" on public.ojt_uploads;
create policy "Allow public delete uploads"
on public.ojt_uploads for delete
using (true);
