/* PGMO Admin Improvements: dashboard alerts, activity log, backup/export, and document preview.
   This file is intentionally separate so existing DTR, certificate, registration, and report logic stays untouched. */
(function(){
    "use strict";

    const ACTIVITY_STORAGE_KEY = "pgmo_admin_activity_log_local";
    const ACTIVITY_TABLE = "admin_activity_log";
    const PATCH_VERSION = "pgmo-improvements-20260713";

    function adminClient(){
        try{
            if(typeof initSupabaseAdmin === "function") return initSupabaseAdmin();
            if(typeof supabase !== "undefined" && typeof SUPABASE_URL !== "undefined" && typeof SUPABASE_ANON_KEY !== "undefined"){
                if(!window.__pgmoAdminImprovementClient){
                    window.__pgmoAdminImprovementClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                }
                return window.__pgmoAdminImprovementClient;
            }
        }catch(error){
            console.warn("Admin improvement client unavailable:", error.message);
        }
        return null;
    }

    function tableName(globalName, fallback){
        return typeof window[globalName] !== "undefined" ? window[globalName] : fallback;
    }

    function adminName(){
        if(typeof getAdminSessionUsername === "function") return getAdminSessionUsername();
        return sessionStorage.getItem("interntrack_username") || localStorage.getItem("interntrack_username") || "admin";
    }

    function safeText(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function plain(value, fallback = ""){
        const text = String(value ?? "").trim();
        return text || fallback;
    }

    function downloadBlob(filename, mimeType, content){
        const blob = content instanceof Blob ? content : new Blob([content], {type:mimeType});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
    }

    function readLocalActivities(){
        try{
            const parsed = JSON.parse(localStorage.getItem(ACTIVITY_STORAGE_KEY) || "[]");
            return Array.isArray(parsed) ? parsed : [];
        }catch(error){
            return [];
        }
    }

    function writeLocalActivity(entry){
        const list = readLocalActivities();
        list.unshift(entry);
        localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(list.slice(0, 300)));
    }

    async function pgmoLogAdminActivity(actionType, entityType, entityName, details = {}){
        const entry = {
            id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
            admin_name: adminName(),
            action_type: plain(actionType, "Activity"),
            entity_type: plain(entityType, "System"),
            entity_name: plain(entityName, "Record"),
            details: typeof details === "string" ? {note:details} : (details || {}),
            created_at: new Date().toISOString()
        };

        writeLocalActivity(entry);

        const client = adminClient();
        if(client){
            try{
                await client.from(ACTIVITY_TABLE).insert([entry]);
            }catch(error){
                console.warn("Activity log table is not available yet. Local log saved instead.");
            }
        }

        if(document.body.dataset.page === "activity-log") renderActivityLogPage();
        if(document.body.dataset.page === "dashboard") renderRecentActivitySummary();
        return entry;
    }

    window.pgmoLogAdminActivity = pgmoLogAdminActivity;

    function injectAdminSidebarLinks(){
        const sidebar = document.querySelector(".sidebar");
        const logout = sidebar ? sidebar.querySelector(".logout-link") : null;
        if(!sidebar || !logout || sidebar.querySelector('[href="activity-log.html"]')) return;

        const activity = document.createElement("a");
        activity.href = "activity-log.html";
        activity.innerHTML = '<i class="fa fa-clock-rotate-left"></i> Activity Log';
        if(document.body.dataset.page === "activity-log") activity.classList.add("active");

        const backup = document.createElement("a");
        backup.href = "backup.html";
        backup.innerHTML = '<i class="fa fa-database"></i> Backup / Export';
        if(document.body.dataset.page === "backup") backup.classList.add("active");

        sidebar.insertBefore(activity, logout);
        sidebar.insertBefore(backup, logout);
    }

    async function fetchTableRows(client, table, select = "*"){
        try{
            const { data, error } = await client.from(table).select(select);
            if(error) throw error;
            return Array.isArray(data) ? data : [];
        }catch(error){
            console.warn(`Could not fetch ${table}:`, error.message);
            return [];
        }
    }

    function studentDisplayName(student){
        const full = plain(student.full_name || student.name);
        if(full) return full;
        const last = plain(student.last_name).toUpperCase();
        const first = plain(student.first_name);
        const mi = plain(student.middle_initial);
        return [last, [first, mi].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Unnamed Student";
    }

    function progressPercent(student){
        const completed = Number(student.completed_hours || student.completed || 0);
        const required = Number(student.required_hours || student.required || 0);
        if(required <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round((completed / required) * 100)));
    }

    async function renderDashboardAlerts(){
        const host = document.getElementById("adminDashboardAlerts");
        if(!host) return;

        host.innerHTML = `
            <div class="pgmo-alert-loading">
                <i class="fa fa-circle-notch fa-spin"></i>
                <span>Checking portal alerts...</span>
            </div>`;

        const client = adminClient();
        if(!client){
            host.innerHTML = `<div class="pgmo-alert-empty"><i class="fa fa-triangle-exclamation"></i> Supabase config is missing.</div>`;
            return;
        }

        const studentsTable = tableName("STUDENT_ACCOUNTS_TABLE", "student_accounts");
        const uploadsTable = tableName("OJT_UPLOADS_TABLE", "ojt_uploads");
        const dtrTable = tableName("OJT_DTR_FORMS_TABLE", "ojt_dtr_forms");

        const [students, uploads, dtrs] = await Promise.all([
            fetchTableRows(client, studentsTable),
            fetchTableRows(client, uploadsTable),
            fetchTableRows(client, dtrTable),
        ]);

        const pendingDocs = uploads.filter(item => String(item.status || "Pending").toLowerCase() === "pending");
        const returnedDocs = uploads.filter(item => String(item.status || "").toLowerCase() === "returned");
        const pendingDtr = dtrs.filter(item => String(item.status || "Pending").toLowerCase() === "pending");
        const noOffice = students.filter(item => !plain(item.office_assigned) || plain(item.office_assigned).toLowerCase() === "not assigned");
        const nearCompletion = students.filter(item => {
            const percent = progressPercent(item);
            return percent >= 80 && percent < 100;
        });
        const completed = students.filter(item => String(item.ojt_status || item.status || "").toLowerCase() === "completed" || progressPercent(item) >= 100);

        const alerts = [
            {
                count: pendingDocs.length,
                title: "Pending document reviews",
                text: "Student uploads waiting for approval or return.",
                icon: "fa-folder-open",
                href: "documents.html?status=Pending&from=dashboard-alert",
                tone: "warning"
            },
            {
                count: pendingDtr.length,
                title: "Pending DTR approvals",
                text: "DTR submissions waiting for admin action.",
                icon: "fa-calendar-check",
                href: "dtr.html?status=Pending&from=dashboard-alert",
                tone: "primary"
            },
            {
                count: returnedDocs.length,
                title: "Returned documents",
                text: "Files returned to students for correction.",
                icon: "fa-rotate-left",
                href: "documents.html?status=Returned&from=dashboard-alert",
                tone: "danger"
            },
            {
                count: noOffice.length,
                title: "Students without office",
                text: "Students still marked as Not assigned.",
                icon: "fa-building-circle-exclamation",
                href: "students.html?dashboardFilter=no-office&from=dashboard-alert",
                tone: "muted"
            },
            {
                count: nearCompletion.length,
                title: "Near completion",
                text: "Students with 80% or more completed hours.",
                icon: "fa-chart-line",
                href: "students.html?dashboardFilter=near-completion&from=dashboard-alert",
                tone: "success"
            },
            {
                count: completed.length,
                title: "Completed students",
                text: "Students ready for final checking or certificate.",
                icon: "fa-award",
                href: "certificates.html?eligibility=Eligible&from=dashboard-alert",
                tone: "success"
            }
        ];

        host.innerHTML = alerts.map(alert => `
            <a class="pgmo-alert-card pgmo-alert-${alert.tone}" href="${alert.href}">
                <div class="pgmo-alert-icon"><i class="fa ${alert.icon}"></i></div>
                <div>
                    <strong>${safeText(alert.count)}</strong>
                    <span>${safeText(alert.title)}</span>
                    <small>${safeText(alert.text)}</small>
                </div>
            </a>
        `).join("");
    }

    async function getRecentActivities(limit = 8){
        const client = adminClient();
        if(client){
            try{
                const { data, error } = await client
                    .from(ACTIVITY_TABLE)
                    .select("*")
                    .order("created_at", {ascending:false})
                    .limit(limit);
                if(!error && Array.isArray(data)) return data;
            }catch(error){
                console.warn("Using local admin activity log fallback.");
            }
        }
        return readLocalActivities().slice(0, limit);
    }

    async function renderRecentActivitySummary(){
        const host = document.getElementById("adminRecentActivity");
        if(!host) return;

        const activities = await getRecentActivities(6);
        if(!activities.length){
            host.innerHTML = `
                <div class="pgmo-activity-empty">
                    <i class="fa fa-clock-rotate-left"></i>
                    <span>No admin activity recorded yet.</span>
                </div>`;
            return;
        }

        host.innerHTML = activities.map(item => `
            <div class="pgmo-activity-row">
                <div class="pgmo-activity-dot"></div>
                <div>
                    <strong>${safeText(item.action_type || "Activity")}</strong>
                    <span>${safeText(item.entity_name || item.entity_type || "Record")}</span>
                    <small>${safeText(item.admin_name || "admin")} • ${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                </div>
            </div>
        `).join("");
    }

    function renderActivityRows(host, count, activities){
        if(count) count.textContent = String(activities.length);

        if(!activities.length){
            host.innerHTML = `<tr><td colspan="5"><div class="empty-state pgmo-clean-empty"><i class="fa fa-clock-rotate-left"></i><h5>No admin activity yet</h5><p>Actions will appear here after approvals, returns, uploads, resets, and exports.</p></div></td></tr>`;
            return;
        }

        host.innerHTML = activities.map(item => `
            <tr>
                <td>${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</td>
                <td><strong>${safeText(item.admin_name || "admin")}</strong></td>
                <td>${safeText(item.action_type || "Activity")}</td>
                <td>${safeText(item.entity_type || "Record")}</td>
                <td>
                    <strong>${safeText(item.entity_name || "-")}</strong><br>
                    <small class="text-secondary">${safeText(JSON.stringify(item.details || {}))}</small>
                </td>
            </tr>
        `).join("");
    }

    async function renderActivityLogPage(options = {}){
        const host = document.getElementById("adminActivityLogBody");
        const count = document.getElementById("activityLogCount");
        if(!host) return;

        const currentHasRows = host.querySelector("tr") && !host.textContent.includes("Loading activity log");
        const localActivities = readLocalActivities().slice(0, 200);

        /* Keep the page visually stable. Do not reload the full page and do not flash
           a spinner when the admin switches to Activity Log. Render cached/local rows
           first, then quietly replace them with Supabase rows when available. */
        if(localActivities.length && !options.forceBlank){
            renderActivityRows(host, count, localActivities);
        }else if(!currentHasRows){
            host.innerHTML = `<tr><td colspan="5"><div class="empty-state pgmo-clean-empty"><i class="fa fa-clock-rotate-left"></i><h5>Loading activity log...</h5><p>Please wait while the latest actions are checked.</p></div></td></tr>`;
            if(count) count.textContent = "0";
        }

        const activities = await getRecentActivities(200);
        renderActivityRows(host, count, activities);
    }

    async function refreshActivityLogClean(){
        await renderActivityLogPage({forceBlank:false});
    }

    window.refreshActivityLogClean = refreshActivityLogClean;

    async function exportActivityLogExcel(){
        const activities = await getRecentActivities(500);
        if(!activities.length){ alert("No activity log to export."); return; }
        if(typeof ExcelJS === "undefined"){
            downloadBlob("pgmo-admin-activity-log.json", "application/json", JSON.stringify(activities, null, 2));
            return;
        }
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "PGMO OJT System";
        workbook.created = new Date();
        const sheet = workbook.addWorksheet("Admin Activity Log");
        sheet.columns = [
            {header:"Date and Time", key:"created_at", width:24},
            {header:"Admin", key:"admin_name", width:20},
            {header:"Action", key:"action_type", width:24},
            {header:"Record Type", key:"entity_type", width:20},
            {header:"Record Name", key:"entity_name", width:34},
            {header:"Details", key:"details", width:52}
        ];
        sheet.getRow(1).eachCell(cell => {
            cell.font = {bold:true, color:{argb:"FFFFFFFF"}};
            cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF0F5132"}};
            cell.alignment = {vertical:"middle", wrapText:true};
        });
        activities.forEach(item => sheet.addRow({
            created_at: item.created_at ? new Date(item.created_at).toLocaleString() : "",
            admin_name: item.admin_name || "admin",
            action_type: item.action_type || "Activity",
            entity_type: item.entity_type || "Record",
            entity_name: item.entity_name || "-",
            details: JSON.stringify(item.details || {})
        }));
        sheet.views = [{state:"frozen", ySplit:1}];
        sheet.autoFilter = "A1:F1";
        const buffer = await workbook.xlsx.writeBuffer();
        downloadBlob("pgmo-admin-activity-log.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Blob([buffer]));
        pgmoLogAdminActivity("Exported activity log", "Backup", "Admin Activity Log", {format:"xlsx"});
    }

    async function clearLocalActivityLog(){
        if(!confirm("Clear the local activity log stored in this browser? Supabase records will not be deleted.")) return;
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
        await renderActivityLogPage();
    }

    window.exportActivityLogExcel = exportActivityLogExcel;
    window.clearLocalActivityLog = clearLocalActivityLog;

    function tableList(){
        return [
            {label:"Students", table:tableName("STUDENT_ACCOUNTS_TABLE", "student_accounts")},
            {label:"Documents", table:tableName("OJT_UPLOADS_TABLE", "ojt_uploads")},
            {label:"DTR Forms", table:tableName("OJT_DTR_FORMS_TABLE", "ojt_dtr_forms")},
            {label:"Notifications", table:"student_notifications"},
            {label:"Registration Codes", table:"registration_invites"},
            {label:"OJT ID Requests", table:"ojt_id_requests"},
            {label:"Admin Activity Log", table:ACTIVITY_TABLE}
        ];
    }

    async function collectBackupData(){
        const client = adminClient();
        if(!client) throw new Error("Supabase config is missing.");
        const backup = {};
        for(const item of tableList()){
            backup[item.label] = await fetchTableRows(client, item.table);
        }
        backup["Local Admin Activity"] = readLocalActivities();
        return backup;
    }

    async function exportFullBackupJson(){
        try{
            const backup = await collectBackupData();
            backup.__generated_at = new Date().toISOString();
            backup.__system = "PGMO OJT / Work Immersion System";
            downloadBlob(`pgmo-full-backup-${new Date().toISOString().slice(0,10)}.json`, "application/json", JSON.stringify(backup, null, 2));
            pgmoLogAdminActivity("Exported full backup", "Backup", "Full JSON Backup", {format:"json"});
        }catch(error){
            alert(error.message || "Could not export backup.");
        }
    }

    async function exportFullBackupExcel(){
        try{
            const backup = await collectBackupData();
            if(typeof ExcelJS === "undefined"){
                downloadBlob("pgmo-full-backup.json", "application/json", JSON.stringify(backup, null, 2));
                return;
            }
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "PGMO OJT System";
            workbook.created = new Date();
            for(const [label, rows] of Object.entries(backup)){
                const sheet = workbook.addWorksheet(label.slice(0, 31));
                const list = Array.isArray(rows) ? rows : [];
                const keys = Array.from(new Set(list.flatMap(row => Object.keys(row || {}))));
                if(!keys.length){
                    sheet.addRow(["No records found"]);
                    continue;
                }
                sheet.columns = keys.map(key => ({header:key, key, width:Math.min(45, Math.max(14, key.length + 4))}));
                sheet.getRow(1).eachCell(cell => {
                    cell.font = {bold:true, color:{argb:"FFFFFFFF"}};
                    cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:"FF0F5132"}};
                    cell.alignment = {vertical:"middle", wrapText:true};
                });
                list.forEach(row => {
                    const formatted = {};
                    keys.forEach(key => {
                        const value = row[key];
                        formatted[key] = value && typeof value === "object" ? JSON.stringify(value) : value;
                    });
                    sheet.addRow(formatted);
                });
                sheet.views = [{state:"frozen", ySplit:1}];
                
                function pgmoBackupColumnLetter(index){
                    let n = index;
                    let s = "";
                    while(n > 0){
                        const m = (n - 1) % 26;
                        s = String.fromCharCode(65 + m) + s;
                        n = Math.floor((n - 1) / 26);
                    }
                    return s || "A";
                }
                sheet.autoFilter = `A1:${pgmoBackupColumnLetter(keys.length)}1`;
            }
            const buffer = await workbook.xlsx.writeBuffer();
            downloadBlob(`pgmo-full-backup-${new Date().toISOString().slice(0,10)}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Blob([buffer]));
            pgmoLogAdminActivity("Exported full backup", "Backup", "Full Excel Backup", {format:"xlsx"});
        }catch(error){
            alert(error.message || "Could not export Excel backup.");
        }
    }

    window.exportFullBackupJson = exportFullBackupJson;
    window.exportFullBackupExcel = exportFullBackupExcel;

    function renderBackupTableInfo(){
        const host = document.getElementById("backupTableList");
        if(!host) return;
        host.innerHTML = tableList().map(item => `
            <div class="pgmo-backup-table-chip">
                <i class="fa fa-table"></i>
                <div><strong>${safeText(item.label)}</strong><span>${safeText(item.table)}</span></div>
            </div>
        `).join("");
    }

    function previewKind(url, name){
        const clean = String(url || "").split("?")[0].toLowerCase();
        const fileName = String(name || clean).toLowerCase();
        if(/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(clean) || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(fileName)) return "image";
        if(/\.pdf$/.test(clean) || /\.pdf$/.test(fileName)) return "pdf";
        if(/\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(clean) || /\.(doc|docx|ppt|pptx|xls|xlsx)$/.test(fileName)) return "office";
        return "other";
    }

    function ensurePreviewModal(){
        let modal = document.getElementById("pgmoDocumentPreviewModal");
        if(modal) return modal;
        modal = document.createElement("div");
        modal.className = "modal fade pgmo-document-preview-modal";
        modal.id = "pgmoDocumentPreviewModal";
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title" id="pgmoDocumentPreviewTitle">Document Preview</h5>
                            <small class="text-secondary" id="pgmoDocumentPreviewType">Preview</small>
                        </div>
                        <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="pgmoDocumentPreviewBody" class="pgmo-document-preview-body"></div>
                    </div>
                    <div class="modal-footer">
                        <a id="pgmoDocumentPreviewOpen" class="btn btn-outline-primary" href="#" target="_blank" rel="noopener noreferrer" data-open-original="true" aria-label="Open original document in a new tab"><i class="fa fa-up-right-from-square"></i> Open Original</a>
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function openDocumentPreview(url, name = "Document", type = ""){
        if(!url){ alert("No file URL found for this document."); return; }
        const modal = ensurePreviewModal();
        const title = document.getElementById("pgmoDocumentPreviewTitle");
        const typeLabel = document.getElementById("pgmoDocumentPreviewType");
        const body = document.getElementById("pgmoDocumentPreviewBody");
        const open = document.getElementById("pgmoDocumentPreviewOpen");
        const kind = previewKind(url, name);

        title.textContent = name || "Document Preview";
        typeLabel.textContent = type || kind.toUpperCase();
        open.href = url;

        if(kind === "image"){
            body.innerHTML = `<img class="pgmo-document-preview-image" src="${safeText(url)}" alt="${safeText(name)}">`;
        }else if(kind === "pdf"){
            body.innerHTML = `<iframe class="pgmo-document-preview-frame" src="${safeText(url)}" title="${safeText(name)}"></iframe>`;
        }else if(kind === "office"){
            const officeUrl = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
            body.innerHTML = `
                <iframe class="pgmo-document-preview-frame" src="${safeText(officeUrl)}" title="${safeText(name)}"></iframe>
                <p class="text-secondary small mt-2 mb-0">If Office preview does not load, use Open Original.</p>`;
        }else{
            body.innerHTML = `
                <div class="pgmo-document-preview-fallback">
                    <i class="fa fa-file-lines"></i>
                    <h5>${safeText(name)}</h5>
                    <p>This file type cannot be previewed directly. Use Open Original to view it.</p>
                </div>`;
        }

        if(window.bootstrap?.Modal){
            bootstrap.Modal.getOrCreateInstance(modal).show();
        }else{
            window.open(url, "_blank", "noopener");
        }
    }

    window.openPgmoDocumentPreview = openDocumentPreview;

    function bindDocumentPreview(){
        document.addEventListener("click", function(event){
            const button = event.target.closest(".pgmo-document-preview-btn");
            if(button){
                event.preventDefault();
                openDocumentPreview(button.dataset.fileUrl, button.dataset.fileName || "Document", button.dataset.fileType || "Document");
                return;
            }

            const link = event.target.closest("a[target='_blank']");
            if(!link) return;

            // Open Original is the final destination, not another preview
            // trigger. Let the browser honor target="_blank" normally.
            if(link.matches('[data-open-original="true"], #pgmoDocumentPreviewOpen')) return;

            const href = link.getAttribute("href") || "";
            const text = link.textContent || "Document";
            const looksLikeDocument = /\.(pdf|png|jpg|jpeg|gif|webp|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i.test(href) || link.closest(".student-file-actions, .file-row, .document-row");
            if(!looksLikeDocument) return;
            event.preventDefault();
            openDocumentPreview(href, text.trim() || "Document", "Document");
        });
    }

    function wrapAdminActions(){
        const wraps = [
            {name:"setDocumentStatus", label:"Changed document status", entity:"Document"},
            {name:"returnDocument", label:"Returned document", entity:"Document"},
            {name:"approveMonthlyDtr", label:"Approved DTR", entity:"DTR"},
            {name:"rejectMonthlyDtr", label:"Rejected DTR", entity:"DTR"},
            {name:"deleteMonthlyDtr", label:"Deleted DTR", entity:"DTR"},
            {name:"deleteStudent", label:"Deleted student", entity:"Student"},
            {name:"adminUploadStudentDocument", label:"Uploaded admin document", entity:"Document"},
            {name:"resetStudentPassword", label:"Reset student password", entity:"Student"}
        ];

        wraps.forEach(item => {
            const original = window[item.name];
            if(typeof original !== "function" || original.__pgmoActivityWrapped) return;
            const wrapped = async function(...args){
                const result = await original.apply(this, args);
                await pgmoLogAdminActivity(item.label, item.entity, args[0] || item.entity, {function:item.name, arguments:args.map(value => String(value))});
                return result;
            };
            wrapped.__pgmoActivityWrapped = true;
            window[item.name] = wrapped;
        });
    }



    /* Dashboard alert target filters.
       These keep the alert cards useful by opening the exact filtered records instead of every record. */
    function dashboardParams(){
        return new URLSearchParams(window.location.search || "");
    }

    function dashboardFilterNotice(message){
        if(!message || document.getElementById("pgmoDashboardFilterNotice")) return;
        const content = document.querySelector(".content");
        if(!content) return;

        const notice = document.createElement("div");
        notice.id = "pgmoDashboardFilterNotice";
        notice.className = "pgmo-dashboard-filter-notice";
        notice.innerHTML = `
            <div>
                <strong><i class="fa fa-filter"></i> Dashboard alert filter active</strong>
                <span>${safeText(message)}</span>
            </div>
            <a class="btn btn-sm btn-outline-dark" href="${location.pathname.split('/').pop() || 'index.html'}">Clear filter</a>
        `;
        content.prepend(notice);
    }

    function setSelectValue(id, value){
        const select = document.getElementById(id);
        if(!select || !value) return false;
        const option = [...select.options].find(opt => String(opt.value || opt.textContent).toLowerCase() === String(value).toLowerCase());
        if(option){
            select.value = option.value || option.textContent;
            return true;
        }
        return false;
    }

    function filterStudentRowsForDashboardAlert(){
        const params = dashboardParams();
        const filter = params.get("dashboardFilter") || "";
        if(!filter || document.body.dataset.page !== "students") return;

        const tbody = document.getElementById("studentsTableBody");
        if(!tbody) return;

        const rows = [...tbody.querySelectorAll("tr")].filter(row => !row.querySelector(".empty-state"));
        if(!rows.length) return;

        let visibleCount = 0;
        rows.forEach(row => {
            const cells = row.children;
            const officeText = String(cells[4]?.textContent || "").trim().toLowerCase();
            const hoursText = String(cells[5]?.textContent || "").replace(/,/g, "");
            const statusText = String(cells[6]?.textContent || "").trim().toLowerCase();
            const match = hoursText.match(/([0-9.]+)\s*\/\s*([0-9.]+)/);
            const completed = match ? Number(match[1]) : 0;
            const required = match ? Number(match[2]) : 0;
            const percent = required > 0 ? (completed / required) * 100 : 0;

            let keep = true;
            if(filter === "no-office"){
                keep = !officeText || officeText === "not assigned" || officeText.includes("not assigned");
            }else if(filter === "near-completion"){
                keep = percent >= 80 && percent < 100;
            }else if(filter === "completed"){
                keep = statusText.includes("completed") || percent >= 100;
            }

            row.style.display = keep ? "" : "none";
            if(keep) visibleCount += 1;
        });

        if(visibleCount === 0){
            tbody.innerHTML = typeof emptyRow === "function"
                ? emptyRow(8, "fa fa-filter", "No matching dashboard alert records", "There are no records for this alert right now.")
                : `<tr><td colspan="8">No matching dashboard alert records.</td></tr>`;
        }
    }

    function patchStudentDashboardAlertRender(){
        const original = window.renderStudents;
        if(typeof original !== "function" || original.__pgmoDashboardAlertPatched) return;

        const patched = async function(...args){
            const result = await original.apply(this, args);
            filterStudentRowsForDashboardAlert();
            return result;
        };
        patched.__pgmoDashboardAlertPatched = true;
        window.renderStudents = patched;
    }

    function applyDashboardAlertTargetFilters(){
        const params = dashboardParams();
        if(params.get("from") !== "dashboard-alert") return;

        const page = document.body.dataset.page;
        const status = params.get("status");
        const dashboardFilter = params.get("dashboardFilter");
        const eligibility = params.get("eligibility");

        if(page === "documents"){
            if(setSelectValue("documentStatus", status)){
                dashboardFilterNotice(`${status} documents are shown from the dashboard alert.`);
                setTimeout(() => typeof renderDocuments === "function" && renderDocuments(), 80);
            }
        }

        if(page === "dtr"){
            if(setSelectValue("dtrStatusFilter", status)){
                dashboardFilterNotice(`${status} DTR submissions are shown from the dashboard alert.`);
                setTimeout(() => typeof renderMonthlyDtrAdmin === "function" && renderMonthlyDtrAdmin(), 80);
            }
        }

        if(page === "students"){
            if(dashboardFilter === "no-office"){
                dashboardFilterNotice("Students without an assigned office are shown from the dashboard alert.");
                setTimeout(() => {
                    patchStudentDashboardAlertRender();
                    if(typeof renderStudents === "function") renderStudents();
                }, 80);
            }
            if(dashboardFilter === "near-completion"){
                dashboardFilterNotice("Students with 80% to 99% completed hours are shown from the dashboard alert.");
                setTimeout(() => {
                    patchStudentDashboardAlertRender();
                    if(typeof renderStudents === "function") renderStudents();
                }, 80);
            }
            if(dashboardFilter === "completed"){
                dashboardFilterNotice("Completed students are shown from the dashboard alert.");
                setTimeout(() => {
                    patchStudentDashboardAlertRender();
                    if(typeof renderStudents === "function") renderStudents();
                }, 80);
            }
        }

        if(page === "certificates"){
            if(setSelectValue("certificateEligibility", eligibility)){
                dashboardFilterNotice(`${eligibility} certificate records are shown from the dashboard alert.`);
                setTimeout(() => typeof renderCertificates === "function" && renderCertificates(), 80);
            }
        }
    }

    document.addEventListener("DOMContentLoaded", function(){
        patchStudentDashboardAlertRender();
        injectAdminSidebarLinks();
        bindDocumentPreview();
        applyDashboardAlertTargetFilters();
        setTimeout(wrapAdminActions, 100);

        if(document.body.dataset.page === "dashboard"){
            renderDashboardAlerts();
            renderRecentActivitySummary();
        }
        if(document.body.dataset.page === "activity-log"){
            renderActivityLogPage();
        }
        if(document.body.dataset.page === "backup"){
            renderBackupTableInfo();
        }
    });
})();
