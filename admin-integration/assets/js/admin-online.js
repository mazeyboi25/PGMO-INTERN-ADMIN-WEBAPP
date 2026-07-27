let supabaseClient = null;

function hasConfig(){
    return !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
}

function initSupabase(){
    if(!hasConfig()){
        showToast("Supabase config is missing. Open assets/js/config.js first.", "error");
        return false;
    }

    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
}

function showToast(message, type="success"){
    const toast = document.getElementById("toastBox");
    if(!toast) return;

    toast.innerHTML = message;
    toast.style.display = "block";
    toast.style.borderLeft = type === "error" ? "5px solid #dc2626" : "5px solid #16a34a";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

function badge(status){
    return `<span class="badge-status badge-${String(status).toLowerCase()}">${status}</span>`;
}

async function loadAdminUploads(){
    if(!initSupabase()) return;

    const tbody = document.getElementById("uploadsTable");
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center p-5">
                Loading uploaded files...
            </td>
        </tr>
    `;

    const search = (document.getElementById("searchInput").value || "").toLowerCase();
    const status = document.getElementById("statusFilter").value;

    const { data, error } = await supabaseClient
        .from(OJT_UPLOADS_TABLE)
        .select("*")
        .order("created_at", { ascending:false });

    if(error){
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger p-5">
                    ${error.message}
                </td>
            </tr>
        `;
        return;
    }

    let list = data || [];

    list = list.filter(item => {
        const matchesSearch = JSON.stringify(item).toLowerCase().includes(search);
        const matchesStatus = status === "All" || item.status === status;
        return matchesSearch && matchesStatus;
    });

    document.getElementById("totalUploads").textContent = data.length;
    document.getElementById("pendingUploads").textContent = data.filter(item => item.status === "Pending").length;
    document.getElementById("approvedUploads").textContent = data.filter(item => item.status === "Approved").length;
    document.getElementById("returnedUploads").textContent = data.filter(item => item.status === "Returned").length;

    if(!list.length){
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center p-5">
                    No uploaded documents found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr>
            <td>${item.student_id}</td>
            <td>${item.student_name}</td>
            <td>${item.course}</td>
            <td>${item.office_assigned}</td>
            <td>${item.document_type}<br><small>${item.file_name}</small></td>
            <td>${badge(item.status)}</td>
            <td>${new Date(item.created_at).toLocaleString()}</td>
            <td>
                <div class="d-flex flex-wrap gap-1">
                    <button type="button" class="btn btn-sm btn-outline-primary pgmo-document-preview-btn" data-file-url="${pgmoAdminDocumentPreviewAttr(item.file_url || "")}" data-file-name="${pgmoAdminDocumentPreviewAttr(item.file_name || item.document_type || "Document")}" data-file-type="${pgmoAdminDocumentPreviewAttr(item.document_type || "Document")}">View</button>
                    <button class="btn btn-sm btn-outline-success" onclick="updateUploadStatus('${item.id}','Approved')">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="openReturnModal('${item.id}')">Return</button>
                </div>
            </td>
        </tr>
    `).join("");
}

let selectedUploadId = null;

function openReturnModal(id){
    selectedUploadId = id;
    document.getElementById("adminRemarks").value = "";
    new bootstrap.Modal(document.getElementById("returnModal")).show();
}

async function updateUploadStatus(id, status, remarks=""){
    if(!initSupabase()) return;

    const { error } = await supabaseClient
        .from(OJT_UPLOADS_TABLE)
        .update({
            status: status,
            admin_remarks: remarks
        })
        .eq("id", id);

    if(error){
        showToast(error.message, "error");
        return;
    }

    showToast("Document status updated.");
    loadAdminUploads();
}

async function submitReturn(){
    const remarks = document.getElementById("adminRemarks").value.trim();

    if(!remarks){
        showToast("Please enter return remarks.", "error");
        return;
    }

    await updateUploadStatus(selectedUploadId, "Returned", remarks);
    bootstrap.Modal.getInstance(document.getElementById("returnModal")).hide();
}

document.addEventListener("DOMContentLoaded", () => {
    loadAdminUploads();

    document.getElementById("searchInput").addEventListener("keyup", loadAdminUploads);
    document.getElementById("statusFilter").addEventListener("change", loadAdminUploads);
});

/* PGMO DOCUMENT PREVIEW MODAL - Admin online side */
function pgmoAdminDocumentPreviewAttr(value){
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function pgmoAdminDocumentPreviewExtension(fileUrl, fileName){
    const cleanName = String(fileName || fileUrl || "").split("?")[0].split("#")[0].toLowerCase();
    const parts = cleanName.split(".");
    return parts.length > 1 ? parts.pop() : "";
}

function pgmoEnsureAdminDocumentPreviewModal(){
    let modal = document.getElementById("pgmoDocumentPreviewModal");
    if(modal) return modal;

    modal = document.createElement("div");
    modal.id = "pgmoDocumentPreviewModal";
    modal.className = "pgmo-document-preview-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
        <div class="pgmo-document-preview-backdrop" data-preview-close="true"></div>
        <div class="pgmo-document-preview-card" role="dialog" aria-modal="true" aria-labelledby="pgmoDocumentPreviewTitle">
            <div class="pgmo-document-preview-header">
                <div>
                    <h3 id="pgmoDocumentPreviewTitle">Document Preview</h3>
                    <p id="pgmoDocumentPreviewSubtitle">Preview uploaded document without leaving this page.</p>
                </div>
                <button type="button" class="pgmo-document-preview-close" data-preview-close="true" aria-label="Close preview">
                    <i class="fa fa-xmark"></i>
                </button>
            </div>
            <div id="pgmoDocumentPreviewBody" class="pgmo-document-preview-body"></div>
            <div class="pgmo-document-preview-footer">
                <a id="pgmoDocumentPreviewOpen" class="btn btn-sm btn-outline-success" href="#" target="_blank" rel="noopener noreferrer" data-open-original="true" aria-label="Open original document in a new tab">
                    <i class="fa fa-up-right-from-square"></i> Open Original
                </a>
                <button type="button" class="btn btn-sm btn-success" data-preview-close="true">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function closePgmoDocumentPreview(){
    const modal = document.getElementById("pgmoDocumentPreviewModal");
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("pgmo-document-preview-open");
}

function openPgmoDocumentPreview(fileUrl, fileName = "Document", fileType = "Document"){
    if(!fileUrl){
        alert("Document link is not available.");
        return;
    }

    const modal = pgmoEnsureAdminDocumentPreviewModal();
    const title = document.getElementById("pgmoDocumentPreviewTitle");
    const subtitle = document.getElementById("pgmoDocumentPreviewSubtitle");
    const body = document.getElementById("pgmoDocumentPreviewBody");
    const openLink = document.getElementById("pgmoDocumentPreviewOpen");
    const ext = pgmoAdminDocumentPreviewExtension(fileUrl, fileName);
    const safeFileName = pgmoAdminDocumentPreviewAttr(fileName || "Document");
    const encodedUrl = encodeURI(fileUrl);

    if(title) title.textContent = fileName || "Document Preview";
    if(subtitle) subtitle.textContent = fileType || ext.toUpperCase() || "Document";
    if(openLink) openLink.href = fileUrl;

    if(["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)){
        body.innerHTML = `<div class="pgmo-document-image-wrap"><img src="${encodedUrl}" alt="${safeFileName}"></div>`;
    }else if(ext === "pdf"){
        body.innerHTML = `<iframe class="pgmo-document-frame" src="${encodedUrl}#toolbar=1&navpanes=0" title="${safeFileName}"></iframe>`;
    }else if(["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)){
        body.innerHTML = `
            <iframe class="pgmo-document-frame" src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}" title="${safeFileName}"></iframe>
            <p class="pgmo-document-preview-note">If the preview does not load, click <b>Open Original</b>.</p>
        `;
    }else{
        body.innerHTML = `
            <div class="pgmo-document-preview-empty">
                <i class="fa fa-file-lines"></i>
                <h4>Preview may not be available for this file type.</h4>
                <p>You can still open the original file using the button below.</p>
            </div>
        `;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("pgmo-document-preview-open");
}

function setupPgmoAdminDocumentPreviewButtons(){
    if(window.__pgmoAdminDocumentPreviewButtonsReady) return;
    window.__pgmoAdminDocumentPreviewButtonsReady = true;

    document.addEventListener("click", function(event){
        const closeButton = event.target.closest("[data-preview-close]");
        if(closeButton){
            closePgmoDocumentPreview();
            return;
        }

        const button = event.target.closest(".pgmo-document-preview-btn");
        if(!button) return;
        event.preventDefault();
        openPgmoDocumentPreview(button.dataset.fileUrl || "", button.dataset.fileName || "Document", button.dataset.fileType || "Document");
    });

    document.addEventListener("keydown", function(event){
        if(event.key === "Escape") closePgmoDocumentPreview();
    });
}

setupPgmoAdminDocumentPreviewButtons();
window.openPgmoDocumentPreview = openPgmoDocumentPreview;
