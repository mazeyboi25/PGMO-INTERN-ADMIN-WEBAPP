/* PGMO Student Improvements: progress tracker and document preview.
   Kept separate so DTR, certificate, registration, and existing portal logic stays untouched. */
(function(){
    "use strict";

    function safeText(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getPortalStudent(){
        if(typeof getStudent === "function") return getStudent();
        return {
            accountId: sessionStorage.getItem("ojt_student_account_uuid") || "",
            id: sessionStorage.getItem("ojt_student_id") || "",
            name: sessionStorage.getItem("ojt_student_name") || "",
            completedHours: Number(sessionStorage.getItem("ojt_student_completed_hours") || 0),
            requiredHours: Number(sessionStorage.getItem("ojt_student_required_hours") || 0)
        };
    }

    function progressData(student){
        const completed = Number(student.completedHours ?? student.completed_hours ?? 0);
        const required = Number(student.requiredHours ?? student.required_hours ?? 0);
        const remaining = Math.max(0, required - completed);
        const percent = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
        const daysLeft = remaining > 0 ? Math.ceil(remaining / 8) : 0;
        const estimated = daysLeft ? estimateCompletionDate(daysLeft) : "Completed";
        return {completed, required, remaining, percent, daysLeft, estimated};
    }

    function estimateCompletionDate(daysNeeded){
        const date = new Date();
        let added = 0;
        while(added < daysNeeded){
            date.setDate(date.getDate() + 1);
            const day = date.getDay();
            if(day !== 0 && day !== 6) added++;
        }
        return date.toLocaleDateString(undefined, {year:"numeric", month:"long", day:"numeric"});
    }

    async function refreshStudentProgressFromDatabase(){
        const student = getPortalStudent();
        let merged = {...student};

        try{
            if(typeof initSupabase === "function" && initSupabase() && typeof supabaseClient !== "undefined" && supabaseClient){
                const table = typeof STUDENT_ACCOUNTS_TABLE !== "undefined" ? STUDENT_ACCOUNTS_TABLE : "student_accounts";
                let query = supabaseClient.from(table).select("*").limit(1);
                if(student.accountId){
                    query = query.eq("id", student.accountId);
                }else if(student.id){
                    query = query.eq("student_id", student.id);
                }
                const { data, error } = await query;
                if(!error && data && data.length){
                    const account = data[0];
                    merged = {
                        ...student,
                        completedHours: Number(account.completed_hours || 0),
                        requiredHours: Number(account.required_hours || 0),
                        status: account.ojt_status || account.status || "Pending"
                    };
                    sessionStorage.setItem("ojt_student_completed_hours", String(merged.completedHours));
                    sessionStorage.setItem("ojt_student_required_hours", String(merged.requiredHours));
                }
            }
        }catch(error){
            console.warn("Progress tracker used session fallback:", error.message);
        }

        return merged;
    }

    async function renderStudentProgressTracker(){
        const host = document.getElementById("studentProgressTracker");
        if(!host) return;

        host.innerHTML = `
            <div class="student-progress-loading">
                <i class="fa fa-circle-notch fa-spin"></i>
                <span>Loading progress...</span>
            </div>`;

        const student = await refreshStudentProgressFromDatabase();
        const data = progressData(student);
        const status = data.required > 0 && data.completed >= data.required ? "Completed" : (student.status || "Ongoing");

        host.innerHTML = `
            <div class="student-progress-head">
                <div>
                    <h3>OJT Progress Tracker</h3>
                    <p>Monitor your completed hours, remaining hours, and estimated completion.</p>
                </div>
                <span class="student-progress-status">${safeText(status)}</span>
            </div>

            <div class="student-progress-bar-wrap">
                <div class="student-progress-bar"><span style="width:${data.percent}%"></span></div>
                <strong>${data.percent}%</strong>
            </div>

            <div class="student-progress-grid">
                <div><span>Completed Hours</span><strong>${data.completed}</strong></div>
                <div><span>Required Hours</span><strong>${data.required || "Not set"}</strong></div>
                <div><span>Remaining Hours</span><strong>${data.required ? data.remaining : "Not set"}</strong></div>
                <div><span>Estimated Completion</span><strong>${safeText(data.required ? data.estimated : "Not set")}</strong></div>
            </div>`;
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
        let modal = document.getElementById("studentDocumentPreviewModal");
        if(modal) return modal;
        modal = document.createElement("div");
        modal.className = "modal fade student-document-preview-modal";
        modal.id = "studentDocumentPreviewModal";
        modal.tabIndex = -1;
        modal.innerHTML = `
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <div>
                            <h5 class="modal-title" id="studentDocumentPreviewTitle">Document Preview</h5>
                            <small class="text-secondary">Preview your submitted file without leaving the portal.</small>
                        </div>
                        <button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="studentDocumentPreviewBody" class="student-document-preview-body"></div>
                    </div>
                    <div class="modal-footer">
                        <a id="studentDocumentPreviewOpen" class="outline-green-btn" href="#" target="_blank" rel="noopener noreferrer" data-open-original="true" aria-label="Open original document in a new tab"><i class="fa fa-up-right-from-square"></i> Open Original</a>
                        <button class="outline-green-btn" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function openStudentDocumentPreview(url, name = "Document"){
        if(!url){
            if(typeof showToast === "function") showToast("No file URL found for this document.", "error");
            else alert("No file URL found for this document.");
            return;
        }
        const modal = ensurePreviewModal();
        const title = document.getElementById("studentDocumentPreviewTitle");
        const body = document.getElementById("studentDocumentPreviewBody");
        const open = document.getElementById("studentDocumentPreviewOpen");
        const kind = previewKind(url, name);

        title.textContent = name || "Document Preview";
        open.href = url;

        if(kind === "image"){
            body.innerHTML = `<img class="student-document-preview-image" src="${safeText(url)}" alt="${safeText(name)}">`;
        }else if(kind === "pdf"){
            body.innerHTML = `<iframe class="student-document-preview-frame" src="${safeText(url)}" title="${safeText(name)}"></iframe>`;
        }else if(kind === "office"){
            const officeUrl = "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
            body.innerHTML = `<iframe class="student-document-preview-frame" src="${safeText(officeUrl)}" title="${safeText(name)}"></iframe><p class="text-secondary small mt-2 mb-0">If Office preview does not load, use Open Original.</p>`;
        }else{
            body.innerHTML = `<div class="student-document-preview-fallback"><i class="fa fa-file-lines"></i><h5>${safeText(name)}</h5><p>This file type cannot be previewed directly. Use Open Original to view it.</p></div>`;
        }

        if(window.bootstrap?.Modal){
            bootstrap.Modal.getOrCreateInstance(modal).show();
        }else{
            window.open(url, "_blank", "noopener");
        }
    }

    window.openStudentDocumentPreview = openStudentDocumentPreview;

    function bindStudentPreviewLinks(){
        document.addEventListener("click", function(event){
            const direct = event.target.closest(".student-document-preview-btn");
            if(direct){
                event.preventDefault();
                openStudentDocumentPreview(direct.dataset.fileUrl, direct.dataset.fileName || "Document");
                return;
            }

            const link = event.target.closest("a[target='_blank']");
            if(!link) return;

            // "Open Original" must remain a real new-tab link. Do not turn it
            // back into another preview modal.
            if(link.matches('[data-open-original="true"], #pgmoDocumentPreviewOpen, #studentDocumentPreviewOpen')) return;

            const href = link.getAttribute("href") || "";
            const insideDocumentRow = link.closest(".student-file-actions, .file-row, .notification-item, .requirements-list");
            const looksLikeDocument = /\.(pdf|png|jpg|jpeg|gif|webp|doc|docx|xls|xlsx|ppt|pptx)(\?|#|$)/i.test(href) || insideDocumentRow;
            if(!looksLikeDocument) return;
            event.preventDefault();
            openStudentDocumentPreview(href, link.textContent.trim() || "Document");
        });
    }

    document.addEventListener("DOMContentLoaded", function(){
        bindStudentPreviewLinks();
        if(document.body.dataset.page === "dashboard"){
            renderStudentProgressTracker();
        }
    });
})();
