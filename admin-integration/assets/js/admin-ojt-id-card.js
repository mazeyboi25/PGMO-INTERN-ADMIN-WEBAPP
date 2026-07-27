
/* PGMO OJT ID CARD OVERHAUL - ADMIN */
(function(){
    const TEMPLATE_SRC = "assets/img/pgmo-ojt-id-template.png";
    const REQUEST_PREFIX = "PGMO_OJT_ID_CARD::";
    let activePreviewRequestId = null;
    let activePreviewStudentId = null;
    let activePreviewSnapshot = null;
    const OJT_IDS_PER_A4_PAGE = 4;
    let cachedOjtIdRequests = [];
    let cachedOjtIdStudents = [];

    function esc(value){
        if(typeof safeText === "function") return safeText(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function statusBadge(status){
        if(typeof badge === "function") return badge(status || "Pending");
        return `<span class="badge-soft badge-${String(status || "pending").toLowerCase()}">${esc(status || "Pending")}</span>`;
    }

    function initialsFromName(name){
        const clean = String(name || "S").replace(/,/g," ").trim();
        const parts = clean.split(/\s+/).filter(Boolean);
        if(!parts.length) return "S";
        return parts.slice(0,2).map(part => part.charAt(0).toUpperCase()).join("");
    }

    function getOjtIdNameClass(name){
        const length = String(name || "").trim().length;
        if(length >= 34) return " name-extra-long";
        if(length >= 24) return " name-very-long";
        if(length >= 16) return " name-long";
        return "";
    }

    function parseSnapshot(req){
        const raw = String(req?.purpose || "");
        if(raw.startsWith(REQUEST_PREFIX)){
            try{
                return JSON.parse(raw.slice(REQUEST_PREFIX.length));
            }catch(error){
                return null;
            }
        }
        return null;
    }

    function snapshotFromRequest(req, students){
        const stored = parseSnapshot(req);
        if(stored) return stored;

        const match = (students || []).find(student => String(student.id || "") === String(req.student_id || "")) || {};
        return {
            studentName: req.student_name || match.name || "Student Name",
            studentId: req.student_id || match.id || "Not set",
            office: req.office_assigned || match.office || "Not assigned",
            school: req.school || match.school || "Not set",
            contact: req.contact_number || match.phone || "Not set",
            course: req.course || match.course || "",
            role: "STUDENT-INTERN",
            photoUrl: req.profile_picture_url || match.profilePictureUrl || match.profile_picture_url || "",
            submittedAt: req.created_at || new Date().toISOString()
        };
    }

    function renderOjtIdCard(snapshot, options = {}){
        const data = snapshot || {};
        const large = options.large ? " template-large" : "";
        const photo = data.photoUrl
            ? `<img src="${esc(data.photoUrl)}" alt="Student photo">`
            : `<span>${esc(initialsFromName(data.studentName))}</span>`;

        return `
            <div class="pgmo-ojt-id-card${large}" data-student-id="${esc(data.studentId)}">
                <img class="ojt-id-template-img" src="${TEMPLATE_SRC}" alt="PGMO OJT ID Template">
                <div class="ojt-id-photo">${photo}</div>
                <div class="ojt-id-name${getOjtIdNameClass(data.studentName || "Student Name")}">${esc(String(data.studentName || "Student Name").replace(/\s+/g, " ").trim())}</div>
                <div class="ojt-id-info">
                    <div><span>ID NO:</span> <strong>${esc(data.studentId || "Not set")}</strong></div>
                    <div><span>OFFICE:</span> <strong>${esc(data.office || "Not assigned")}</strong></div>
                    <div><span>SCHOOL:</span> <strong>${esc(data.school || "Not set")}</strong></div>
                    <div><span>CONTACT:</span> <strong>${esc(data.contact || "Not set")}</strong></div>
                </div>
            </div>`;
    }

    async function getStudentSnapshots(){
        if(typeof fetchAdminStudents === "function"){
            const result = await fetchAdminStudents();
            return result.students || [];
        }
        return [];
    }

    window.renderOjtIdRequestsAdmin = async function(){
        const tbody = document.getElementById("idRequestsTableBody");
        if(!tbody) return;

        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(!client){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase config missing</h5><p>Open assets/js/config.js first.</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading submitted OJT IDs...</h5></div></td></tr>`;

        const students = await getStudentSnapshots();
        const { data, error } = await client
            .from(getAdminOjtIdRequestsTable())
            .select("*")
            .order("created_at", { ascending:false });

        if(error){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load OJT IDs</h5><p>${esc(error.message)}</p></div></td></tr>`;
            return;
        }

        cachedOjtIdRequests = data || [];
        cachedOjtIdStudents = students || [];

        if(!data || !data.length){
            tbody.innerHTML = emptyRow(7,"fa fa-id-card","No submitted OJT IDs yet","Student ID previews will appear here after students submit them for printing.");
            bindOjtIdBulkPrintControls();
            return;
        }

        tbody.innerHTML = data.map(req => {
            const snapshot = snapshotFromRequest(req, students);
            const status = String(req.status || "Pending");
            const canNotify = !["Ready", "Rejected"].includes(status);
            const readyLine = req.approved_at ? `<br><small class="text-success"><i class="fa fa-bell"></i> ${status === "Ready" ? "Ready" : "Updated"}: ${new Date(req.approved_at).toLocaleString()}</small>` : "";
            const remarks = req.admin_remarks ? `<br><small class="text-danger">Admin: ${esc(req.admin_remarks)}</small>` : "";
            const thumb = `<div class="ojt-id-admin-thumb"><img src="assets/img/pgmo-ojt-id-template.png" alt="ID template"></div>`;
            const actions = `
                <button class="btn btn-sm btn-outline-primary" onclick="openAdminOjtIdPreview('${req.id}')"><i class="fa fa-eye"></i> View ID</button>
                ${canNotify ? `<button class="btn btn-sm btn-success" onclick="markOjtIdReadyAndNotify('${req.id}')"><i class="fa fa-bell"></i> Mark Ready</button>` : `<button class="btn btn-sm btn-outline-secondary" disabled>${status === "Ready" ? "Ready Sent" : "Done"}</button>`}
                ${status === "Pending" ? `<button class="btn btn-sm btn-outline-danger" onclick="setOjtIdRequestStatus('${req.id}','Rejected')">Reject</button>` : ""}`;

            return `<tr>
                <td class="ojt-id-select-col"><input class="form-check-input ojt-id-print-checkbox" type="checkbox" value="${esc(req.id)}" aria-label="Select ${esc(snapshot.studentName)} for printing"></td>
                <td><strong>${esc(snapshot.studentName)}</strong><br><small>${esc(snapshot.studentId)} · ${esc(snapshot.course || req.course || "")}</small></td>
                <td>${esc(snapshot.office || req.office_assigned || "Not assigned")}</td>
                <td><div class="ojt-id-admin-mini">${thumb}<div><strong>ID preview submitted</strong><br><small>${esc(snapshot.school || "School not set")}</small></div></div></td>
                <td>${statusBadge(status)}${req.approved_by ? `<br><small class="text-secondary">By: ${esc(req.approved_by)}</small>` : ""}</td>
                <td>${req.created_at ? new Date(req.created_at).toLocaleString() : "-"}${readyLine}${remarks}</td>
                <td><div class="action-group">${actions}</div></td>
            </tr>`;
        }).join("");
        bindOjtIdBulkPrintControls();
    };



    function chunkSnapshotsForPrint(snapshots){
        // Hard limit: exactly four portrait IDs at most on each A4 sheet (2 columns x 2 rows).
        const pages = [];
        for(let index = 0; index < snapshots.length; index += OJT_IDS_PER_A4_PAGE){
            pages.push(snapshots.slice(index, index + OJT_IDS_PER_A4_PAGE));
        }
        return pages;
    }

    function buildOjtIdPrintDocument(snapshots){
        const singlePrint = snapshots.length === 1;
        const pages = chunkSnapshotsForPrint(snapshots);
        const sheets = pages.map((page, pageIndex) => `
            <section class="ojt-id-print-sheet${singlePrint ? " ojt-id-single-sheet" : ""}" data-page="${pageIndex + 1}">
                <div class="${singlePrint ? "ojt-id-single-print-grid" : "ojt-id-print-grid"}">
                    ${page.map(snapshot => `<div class="ojt-id-print-cell">${renderOjtIdCard(snapshot)}</div>`).join("")}
                </div>
            </section>
        `).join("");

        return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title> </title>
<base href="${esc(document.baseURI)}">
<style>
    @page{ size:A4 portrait; margin:0; }
    /* Slightly larger than a typical CR80/student ID, arranged 4 per A4 page. */
    :root{
        --ojt-card-w:62mm;
        --ojt-card-h:100mm;
    }
    html,body{
        width:210mm;
        min-height:297mm;
        margin:0;
        padding:0;
        background:#fff;
        font-family:Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
    }
    *{ box-sizing:border-box; }
    .ojt-id-print-sheet{
        width:210mm;
        height:297mm;
        padding:2.5mm 0;
        margin:0 auto;
        background:#fff;
        page-break-after:always;
        break-after:page;
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
    }
    .ojt-id-print-sheet:last-child{ page-break-after:auto; break-after:auto; }
    .ojt-id-print-grid{
        width:auto;
        height:auto;
        display:grid;
        grid-template-columns:repeat(2, var(--ojt-card-w));
        grid-template-rows:repeat(2, var(--ojt-card-h));
        column-gap:18mm;
        row-gap:14mm;
        align-items:center;
        justify-items:center;
        place-content:center;
        margin:0 auto;
    }
    .ojt-id-single-print-grid{
        width:var(--ojt-card-w);
        height:var(--ojt-card-h);
        display:flex;
        align-items:center;
        justify-content:center;
        margin:0 auto;
    }
    .ojt-id-print-cell{
        width:var(--ojt-card-w);
        height:var(--ojt-card-h);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
        background:#fff;
    }
    .pgmo-ojt-id-card{
        position:relative;
        display:block;
        width:var(--ojt-card-w);
        height:var(--ojt-card-h);
        min-width:var(--ojt-card-w);
        min-height:var(--ojt-card-h);
        max-width:var(--ojt-card-w);
        max-height:var(--ojt-card-h);
        margin:0 auto;
        padding:0;
        overflow:hidden;
        background:#fff;
        border:0;
        box-shadow:none;
        border-radius:0;
    }
    .pgmo-ojt-id-card .ojt-id-template-img{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:fill;
        display:block;
        z-index:1;
    }
    .pgmo-ojt-id-card .ojt-id-photo{
        position:absolute;
        left:21.0%;
        top:33.1%;
        width:56.2%;
        height:auto;
        aspect-ratio:1 / 1;
        border-radius:50%;
        overflow:hidden;
        background:#f8fafc;
        z-index:3;
        display:flex;
        align-items:center;
        justify-content:center;
    }
    .pgmo-ojt-id-card .ojt-id-photo img{
        width:100%;
        height:100%;
        object-fit:cover;
        object-position:center center;
        border-radius:50%;
        display:block;
    }
    .pgmo-ojt-id-card .ojt-id-photo span{
        width:100%;
        height:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        background:#ecfdf5;
        color:#064e3b;
        font-size:7mm;
        font-weight:900;
    }
    .pgmo-ojt-id-card .ojt-id-name{
        position:absolute;
        left:6.2%;
        right:6.2%;
        top:73.15%;
        height:5.30%;
        padding:0 .2mm .12mm;
        z-index:4;
        color:#064e3b;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        text-align:center;
        font-size:3.7mm;
        line-height:.94;
        font-weight:950;
        letter-spacing:-.04em;
        text-transform:uppercase;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:clip;
    }
    .pgmo-ojt-id-card .ojt-id-name.name-long{
        font-size:3.12mm;
        letter-spacing:-.045em;
    }
    .pgmo-ojt-id-card .ojt-id-name.name-very-long{
        font-size:2.62mm;
        letter-spacing:-.055em;
    }
    .pgmo-ojt-id-card .ojt-id-name.name-extra-long{
        font-size:2.25mm;
        letter-spacing:-.065em;
    }
    .pgmo-ojt-id-card .ojt-id-info{
        position:absolute;
        left:9.5%;
        right:9.5%;
        top:80.45%;
        z-index:4;
        color:#064e3b;
        text-align:left;
        font-size:2.58mm;
        line-height:1.08;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:-.025em;
    }
    .pgmo-ojt-id-card .ojt-id-info div{
        display:grid;
        grid-template-columns:39% 61%;
        column-gap:.85mm;
        align-items:baseline;
        min-height:3.05mm;
        margin:0;
        padding:0;
    }
    .pgmo-ojt-id-card .ojt-id-info span{
        text-align:right;
        font-weight:950;
        white-space:nowrap;
        overflow:visible;
    }
    .pgmo-ojt-id-card .ojt-id-info strong{
        text-align:left;
        font-weight:900;
        min-width:0;
        overflow:hidden;
        text-overflow:clip;
        white-space:nowrap;
    }
</style>
</head>
<body>${sheets}</body>
</html>`;
    }

    function waitForOjtIdPrintImages(doc){
        const images = Array.from(doc.images || []);
        if(!images.length) return Promise.resolve();

        return Promise.all(images.map(img => {
            if(img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve;
                setTimeout(resolve, 2500);
            });
        }));
    }

    function printOjtIdSnapshots(snapshots){
        if(!snapshots || !snapshots.length){
            alert("No OJT ID selected for printing.");
            return;
        }

        const oldTitle = document.title;
        document.title = " ";

        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.opacity = "0";
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(buildOjtIdPrintDocument(snapshots));
        doc.close();

        const cleanup = () => {
            setTimeout(() => {
                if(iframe.parentNode) iframe.parentNode.removeChild(iframe);
                document.title = oldTitle;
            }, 500);
        };

        setTimeout(async () => {
            await waitForOjtIdPrintImages(doc);
            try{
                doc.title = " ";
                iframe.contentWindow.document.title = " ";
                document.title = " ";
            }catch(error){}
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            cleanup();
        }, 350);
    }

    function runOjtIdPrintWithCleanTitle(printClass, cleanupDelay = 900){
        const oldTitle = document.title;
        document.title = "";
        document.body.classList.add(printClass);

        const cleanup = () => {
            document.body.classList.remove(printClass);
            document.title = oldTitle;
            window.removeEventListener("afterprint", cleanup);
        };

        window.addEventListener("afterprint", cleanup);

        setTimeout(() => {
            window.print();
            setTimeout(cleanup, cleanupDelay);
        }, 80);
    }

    function selectedOjtIdRequestIds(){
        return Array.from(document.querySelectorAll(".ojt-id-print-checkbox:checked"))
            .map(input => input.value)
            .filter(Boolean);
    }

    function renderBulkPrintSheets(snapshots){
        const printArea = document.getElementById("adminOjtIdBulkPrintArea");
        if(!printArea) return;

        const pages = chunkSnapshotsForPrint(snapshots);

        printArea.innerHTML = pages.map((page, pageIndex) => `
            <section class="ojt-id-print-sheet" data-page="${pageIndex + 1}">
                <div class="ojt-id-print-grid">
                    ${page.map(snapshot => `<div class="ojt-id-print-cell">${renderOjtIdCard(snapshot)}</div>`).join("")}
                </div>
            </section>
        `).join("");
    }

    function printSelectedOjtIds(){
        const ids = selectedOjtIdRequestIds();
        if(!ids.length){
            alert("Select at least one OJT ID to print.");
            return;
        }

        const snapshots = ids.map(id => {
            const req = cachedOjtIdRequests.find(item => String(item.id) === String(id));
            return req ? snapshotFromRequest(req, cachedOjtIdStudents) : null;
        }).filter(Boolean);

        if(!snapshots.length){
            alert("Could not find the selected OJT ID records. Please refresh and try again.");
            return;
        }

        printOjtIdSnapshots(snapshots);
    }

    function bindOjtIdBulkPrintControls(){
        const printBtn = document.getElementById("printSelectedOjtIdsButton");
        if(printBtn && !printBtn.dataset.ready){
            printBtn.dataset.ready = "true";
            printBtn.addEventListener("click", printSelectedOjtIds);
        }

        const selectAllBtn = document.getElementById("selectAllVisibleOjtIdsButton");
        if(selectAllBtn && !selectAllBtn.dataset.ready){
            selectAllBtn.dataset.ready = "true";
            selectAllBtn.addEventListener("click", function(){
                const boxes = Array.from(document.querySelectorAll(".ojt-id-print-checkbox"));
                const shouldCheck = boxes.some(box => !box.checked);
                boxes.forEach(box => box.checked = shouldCheck);
                const header = document.getElementById("ojtIdSelectAllCheckbox");
                if(header) header.checked = shouldCheck;
            });
        }

        const selectAllCheckbox = document.getElementById("ojtIdSelectAllCheckbox");
        if(selectAllCheckbox && !selectAllCheckbox.dataset.ready){
            selectAllCheckbox.dataset.ready = "true";
            selectAllCheckbox.addEventListener("change", function(){
                document.querySelectorAll(".ojt-id-print-checkbox").forEach(box => box.checked = selectAllCheckbox.checked);
            });
        }
    }

    window.openAdminOjtIdPreview = async function(id){
        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(!client){ alert("Supabase config is missing."); return; }

        const { data, error } = await client
            .from(getAdminOjtIdRequestsTable())
            .select("*")
            .eq("id", id)
            .limit(1);

        if(error || !data || !data.length){
            alert(error ? error.message : "OJT ID request not found.");
            return;
        }

        const students = await getStudentSnapshots();
        const req = data[0];
        const snapshot = snapshotFromRequest(req, students);
        activePreviewRequestId = req.id;
        activePreviewStudentId = req.student_id;
        activePreviewSnapshot = snapshot;

        const body = document.getElementById("adminOjtIdPreviewPrintArea");
        const subtitle = document.getElementById("adminOjtIdPreviewSubtitle");
        const readyBtn = document.getElementById("markOjtIdReadyFromModalButton");

        if(body) body.innerHTML = renderOjtIdCard(snapshot, {large:true});
        if(subtitle) subtitle.textContent = `${snapshot.studentName || "Student"} · ${snapshot.studentId || ""}`;
        if(readyBtn){
            readyBtn.disabled = String(req.status || "Pending") === "Ready" || String(req.status || "Pending") === "Rejected";
            readyBtn.innerHTML = String(req.status || "Pending") === "Ready" ? `<i class="fa fa-circle-check"></i> Ready Sent` : `<i class="fa fa-bell"></i> Mark Ready & Notify`;
        }

        const modalEl = document.getElementById("adminOjtIdPreviewModal");
        if(modalEl && typeof bootstrap !== "undefined"){
            new bootstrap.Modal(modalEl).show();
        }
    };

    window.markOjtIdReadyAndNotify = async function(id){
        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(!client){ alert("Supabase config is missing."); return; }

        const { data } = await client
            .from(getAdminOjtIdRequestsTable())
            .select("*")
            .eq("id", id)
            .limit(1);

        const req = data && data[0];
        if(!req){ alert("OJT ID request not found."); return; }

        if(!confirm(`Mark ${req.student_name}'s OJT ID as ready and notify the student?`)) return;

        const adminName = typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "admin";
        const { error } = await client
            .from(getAdminOjtIdRequestsTable())
            .update({
                status:"Ready",
                admin_remarks:"Your OJT ID is ready for claiming or printing.",
                approved_by:adminName,
                approved_at:new Date().toISOString(),
                updated_at:new Date().toISOString()
            })
            .eq("id", id);

        if(error){ alert(error.message); return; }

        if(typeof createStudentNotification === "function"){
            await createStudentNotification(
                req.student_id,
                "OJT ID Ready",
                "Your OJT ID is ready. Please coordinate with your OJT coordinator or office for claiming/printing.",
                "success",
                "ojt_id_request",
                id
            );
        }

        alert("Student notified that the OJT ID is ready.");
        await window.renderOjtIdRequestsAdmin();

        const readyBtn = document.getElementById("markOjtIdReadyFromModalButton");
        if(readyBtn && activePreviewRequestId === id){
            readyBtn.disabled = true;
            readyBtn.innerHTML = `<i class="fa fa-circle-check"></i> Ready Sent`;
        }
    };

    window.setOjtIdRequestStatus = async function(id, status){
        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(!client){ alert("Supabase config is missing."); return; }

        const remarks = status === "Rejected" ? prompt("Reason for rejection:", "Please update your profile details and submit again.") : prompt("Admin remarks, optional:", "OJT ID request updated.");
        if(remarks === null) return;

        const { data: rows } = await client.from(getAdminOjtIdRequestsTable()).select("*").eq("id", id).limit(1);
        const req = rows && rows[0];
        const adminName = typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "admin";

        const { error } = await client.from(getAdminOjtIdRequestsTable()).update({
            status: status,
            admin_remarks: remarks || status,
            approved_by: adminName,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq("id", id);

        if(error){ alert(error.message); return; }

        if(req && typeof createStudentNotification === "function"){
            await createStudentNotification(req.student_id, `OJT ID ${status}`, status === "Rejected" ? "Your OJT ID submission was rejected. Please check the admin remarks." : "Your OJT ID request was updated.", status === "Rejected" ? "error" : "info", "ojt_id_request", id);
        }

        await window.renderOjtIdRequestsAdmin();
    };

    function bindModalButtons(){
        const printBtn = document.getElementById("printOjtIdPreviewButton");
        if(printBtn && !printBtn.dataset.ready){
            printBtn.dataset.ready = "true";
            printBtn.addEventListener("click", function(){
                if(!activePreviewSnapshot){
                    alert("Open an OJT ID preview first.");
                    return;
                }
                printOjtIdSnapshots([activePreviewSnapshot]);
            });
        }

        const readyBtn = document.getElementById("markOjtIdReadyFromModalButton");
        if(readyBtn && !readyBtn.dataset.ready){
            readyBtn.dataset.ready = "true";
            readyBtn.addEventListener("click", function(){
                if(activePreviewRequestId) window.markOjtIdReadyAndNotify(activePreviewRequestId);
            });
        }
    }

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page !== "id-requests") return;
        bindModalButtons();
        setTimeout(() => {
            if(typeof window.renderOjtIdRequestsAdmin === "function") window.renderOjtIdRequestsAdmin();
        }, 100);
    });
})();
