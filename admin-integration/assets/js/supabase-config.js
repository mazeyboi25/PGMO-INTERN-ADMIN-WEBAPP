/* Runtime configuration reader. Actual values belong in config.local.js. */
const PGMO_ADMIN_RUNTIME_CONFIG = window.PGMO_CONFIG || {};

const SUPABASE_URL = String(PGMO_ADMIN_RUNTIME_CONFIG.SUPABASE_URL || "PASTE_SUPABASE_PROJECT_URL");
const SUPABASE_ANON_KEY = String(PGMO_ADMIN_RUNTIME_CONFIG.SUPABASE_ANON_KEY || "PASTE_SUPABASE_PUBLISHABLE_OR_ANON_KEY");

const OJT_STORAGE_BUCKET = "ojt-documents";
const OJT_UPLOADS_TABLE = "ojt_uploads";
const STUDENT_ACCOUNTS_TABLE = "student_accounts";
const OJT_NOTIFICATIONS_TABLE = "ojt_notifications";
const OJT_DTR_FORMS_TABLE = "ojt_dtr_forms";
const OJT_ID_REQUESTS_TABLE = "ojt_id_requests";
const REGISTRATION_INVITES_TABLE = "registration_invites";
