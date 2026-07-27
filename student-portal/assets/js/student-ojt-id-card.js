/* PGMO OJT ID CARD - EDITABLE STUDENT PREVIEW */
(function(){
    const TEMPLATE_SRC = "assets/img/pgmo-ojt-id-template.png";
    const REQUEST_PREFIX = "PGMO_OJT_ID_CARD::";
    let baseSnapshot = null;
    let activeRequestCache = null;
    let schoolAutosaveTimer = null;

    function esc(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getFieldValue(id){
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    }

    function setFieldValue(id, value){
        const el = document.getElementById(id);
        if(el) el.value = value || "";
    }

    function setText(id, value){
        const el = document.getElementById(id);
        if(el) el.textContent = value || "";
    }
    function getIdDraftKey(){
        const student = typeof getStudent === "function" ? getStudent() : {};
        const keyId = student.accountId || student.id || "anonymous";
        return `PGMO_OJT_ID_DRAFT::${keyId}`;
    }

    function loadIdDraft(){
        try{
            const raw = localStorage.getItem(getIdDraftKey());
            return raw ? JSON.parse(raw) : null;
        }catch(error){
            return null;
        }
    }

    function saveIdDraft(snapshot){
        try{
            localStorage.setItem(getIdDraftKey(), JSON.stringify(snapshot));
        }catch(error){
            console.warn("OJT ID draft was not saved:", error.message);
        }
    }

    function mergeSnapshot(base, override){
        return Object.assign({}, base || {}, override || {});
    }


    function cleanName(name){
        const text = String(name || "").trim();
        return text || "STUDENT NAME";
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

    function parseStoredIdSnapshot(purpose){
        const raw = String(purpose || "");
        if(!raw.startsWith(REQUEST_PREFIX)) return null;
        try{
            return JSON.parse(raw.slice(REQUEST_PREFIX.length));
        }catch(error){
            return null;
        }
    }

    async function loadStudentAccount(){
        if(typeof refreshStudentAccountForPage === "function"){
            await refreshStudentAccountForPage();
        }else if(typeof refreshCurrentStudentAccount === "function"){
            await refreshCurrentStudentAccount();
        }
    }

    function getStudentSchool(student){
        return student.school
            || sessionStorage.getItem("ojt_student_school")
            || sessionStorage.getItem("ojt_student_school_name")
            || "Not set";
    }

    function makeBaseIdSnapshot(){
        const student = typeof getStudent === "function" ? getStudent() : {};
        return {
            studentName: cleanName(student.name),
            studentId: student.id || "Not set",
            office: student.office || "Not assigned",
            school: getStudentSchool(student),
            contact: student.phone || "Not set",
            course: student.course || "",
            role: "STUDENT-INTERN",
            photoUrl: student.profilePictureUrl || "",
            submittedAt: new Date().toISOString()
        };
    }

    function makeSnapshotFromEditor(){
        const fallback = baseSnapshot || makeBaseIdSnapshot();
        return {
            studentName: cleanName(getFieldValue("ojtIdEditName") || fallback.studentName),
            studentId: getFieldValue("ojtIdEditStudentId") || fallback.studentId || "Not set",
            office: getFieldValue("ojtIdEditOffice") || fallback.office || "Not assigned",
            school: getFieldValue("ojtIdEditSchool") || fallback.school || "Not set",
            contact: getFieldValue("ojtIdEditContact") || fallback.contact || "Not set",
            course: fallback.course || "",
            role: "STUDENT-INTERN",
            photoUrl: fallback.photoUrl || "",
            submittedAt: new Date().toISOString()
        };
    }

    function renderOjtIdCard(snapshot, options = {}){
        const data = snapshot || makeSnapshotFromEditor();
        const large = options.large ? " template-large" : "";
        const photo = data.photoUrl
            ? `<img src="${esc(data.photoUrl)}" alt="Student photo">`
            : `<span>${esc(initialsFromName(data.studentName))}</span>`;

        return `
            <div class="pgmo-ojt-id-card${large}" data-student-id="${esc(data.studentId)}">
                <img class="ojt-id-template-img" src="${TEMPLATE_SRC}" alt="PGMO OJT ID Template">
                <div class="ojt-id-photo">${photo}</div>
                <div class="ojt-id-name${getOjtIdNameClass(data.studentName)}">${esc(String(data.studentName || "").replace(/\s+/g, " ").trim())}</div>
                <div class="ojt-id-info">
                    <div><span>ID NO:</span> <strong>${esc(data.studentId)}</strong></div>
                    <div><span>OFFICE:</span> <strong>${esc(data.office)}</strong></div>
                    <div><span>SCHOOL:</span> <strong>${esc(data.school)}</strong></div>
                    <div><span>CONTACT:</span> <strong>${esc(data.contact)}</strong></div>
                </div>
            </div>`;
    }

    function updatePreviewFromEditor(){
        const preview = document.getElementById("studentOjtIdPreview");
        if(preview) preview.innerHTML = renderOjtIdCard(makeSnapshotFromEditor());
    }
    function saveCurrentIdDraftAndMaybeSync(){
        const snapshot = makeSnapshotFromEditor();
        saveIdDraft(snapshot);

        if(!activeRequestCache || String(activeRequestCache.status || "Pending") !== "Pending") return;
        if(typeof supabaseClient === "undefined" || !supabaseClient || typeof getOjtIdRequestsTable !== "function") return;

        clearTimeout(schoolAutosaveTimer);
        schoolAutosaveTimer = setTimeout(async () => {
            try{
                await supabaseClient
                    .from(getOjtIdRequestsTable())
                    .update({
                        student_name: snapshot.studentName,
                        office_assigned: snapshot.office,
                        school: snapshot.school,
                        contact_number: snapshot.contact,
                        purpose: REQUEST_PREFIX + JSON.stringify(snapshot),
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", activeRequestCache.id);
            }catch(error){
                console.warn("OJT ID school autosave skipped:", error.message);
            }
        }, 650);
    }


    function fillEditor(snapshot){
        const data = snapshot || makeBaseIdSnapshot();
        setFieldValue("ojtIdEditName", data.studentName);
        setFieldValue("ojtIdEditStudentId", data.studentId);
        setFieldValue("ojtIdEditOffice", data.office);
        setFieldValue("ojtIdEditSchool", data.school);
        setFieldValue("ojtIdEditContact", data.contact);
        updatePreviewFromEditor();
    }

    function bindEditor(){
        ["ojtIdEditName", "ojtIdEditStudentId", "ojtIdEditOffice", "ojtIdEditSchool", "ojtIdEditContact"].forEach(id => {
            const input = document.getElementById(id);
            if(!input || input.dataset.ojtIdBound) return;
            input.dataset.ojtIdBound = "true";
            input.addEventListener("input", function(){
                if(id === "ojtIdEditContact"){
                    input.value = input.value.replace(/\D/g, "").slice(0, 11);
                }
                updatePreviewFromEditor();
                saveCurrentIdDraftAndMaybeSync();
            });
        });

        const resetBtn = document.getElementById("resetOjtIdPreviewButton");
        if(resetBtn && !resetBtn.dataset.ojtIdBound){
            resetBtn.dataset.ojtIdBound = "true";
            resetBtn.addEventListener("click", function(){
                const resetSnapshot = baseSnapshot || makeBaseIdSnapshot();
                fillEditor(resetSnapshot);
                saveIdDraft(resetSnapshot);
                if(typeof showToast === "function") showToast("ID preview details reset.");
            });
        }

        const submitBtn = document.getElementById("submitOjtIdRequestButton");
        if(submitBtn && !submitBtn.dataset.ojtIdBound){
            submitBtn.dataset.ojtIdBound = "true";
            submitBtn.addEventListener("click", window.submitOjtIdRequest);
        }
    }

    window.loadOjtIdRequestPage = async function(){
        const statusBox = document.getElementById("ojtIdAccessStatus");
        const submitBtn = document.getElementById("submitOjtIdRequestButton");
        const listBox = document.getElementById("ojtIdRequestList");
        const hint = document.getElementById("ojtIdRequestHint");
        const preview = document.getElementById("studentOjtIdPreview");

        if(!statusBox && !submitBtn && !listBox && !preview) return;
        if(typeof initSupabase === "function" && !initSupabase()) return;

        await loadStudentAccount();
        const student = typeof getStudent === "function" ? getStudent() : {};
        baseSnapshot = makeBaseIdSnapshot();
        bindEditor();

        let requests = [];
        let loadError = null;

        if(typeof supabaseClient !== "undefined" && supabaseClient && typeof getOjtIdRequestsTable === "function"){
            const { data, error } = await supabaseClient
                .from(getOjtIdRequestsTable())
                .select("*")
                .eq("student_id", student.id)
                .order("created_at", { ascending:false });
            requests = data || [];
            loadError = error || null;
        }

        const activeRequest = requests.find(item => ["Pending", "Approved", "Ready"].includes(String(item.status || "Pending")));
        activeRequestCache = activeRequest || null;

        const activeSnapshot = activeRequest ? parseStoredIdSnapshot(activeRequest.purpose) : null;
        const draftSnapshot = loadIdDraft();
        const editorSnapshot = activeSnapshot || draftSnapshot || baseSnapshot;
        fillEditor(mergeSnapshot(baseSnapshot, editorSnapshot));

        if(statusBox){
            if(activeRequest && String(activeRequest.status || "Pending") === "Pending"){
                statusBox.className = "id-request-status-box clean-status pending";
                statusBox.innerHTML = `<i class="fa fa-clock"></i><div><strong>ID submitted for printing</strong><p>Your latest ID preview is waiting for admin action.</p></div>`;
            }else if(activeRequest && String(activeRequest.status || "Pending") === "Ready"){
                statusBox.className = "id-request-status-box clean-status allowed";
                statusBox.innerHTML = `<i class="fa fa-circle-check"></i><div><strong>OJT ID is ready</strong><p>Your admin marked your ID as ready. Please coordinate for claiming or printing.</p></div>`;
            }else if(activeRequest && String(activeRequest.status || "Pending") === "Approved"){
                statusBox.className = "id-request-status-box clean-status allowed";
                statusBox.innerHTML = `<i class="fa fa-circle-check"></i><div><strong>OJT ID approved</strong><p>Your ID request has been approved by the admin.</p></div>`;
            }else{
                statusBox.className = "id-request-status-box clean-status allowed";
                statusBox.innerHTML = `<i class="fa fa-circle-check"></i><div><strong>Ready to submit</strong><p>Edit your details, review the ID preview, then submit it directly to the admin.</p></div>`;
            }
        }

        if(submitBtn){
            submitBtn.disabled = !!activeRequest;
            if(activeRequest && String(activeRequest.status || "Pending") === "Ready"){
                submitBtn.innerHTML = `<i class="fa fa-circle-check"></i> ID Ready`;
            }else if(activeRequest){
                submitBtn.innerHTML = `<i class="fa fa-clock"></i> Already Submitted`;
            }else{
                submitBtn.innerHTML = `<i class="fa fa-paper-plane"></i> Submit ID for Printing`;
            }
        }

        if(hint){
            if(activeRequest && String(activeRequest.status || "Pending") === "Ready") hint.textContent = "Your OJT ID is ready. Please coordinate with your admin.";
            else if(activeRequest) hint.textContent = "You already submitted an active OJT ID preview. Ask the admin if it needs changes.";
            else hint.textContent = "No approval is required before submitting. Make sure the preview is correct.";
        }

        if(!listBox) return;

        if(loadError){
            listBox.innerHTML = `<div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Could not load ID status</h5><p>${esc(loadError.message)}</p></div>`;
            return;
        }

        if(!requests.length){
            listBox.innerHTML = `<div class="empty-state compact-empty"><i class="fa fa-id-card"></i><h5>No ID submitted yet</h5><p>Your OJT ID status will appear here after submission.</p></div>`;
            return;
        }

        listBox.innerHTML = requests.map(item => {
            const status = String(item.status || "Pending");
            const savedSnapshot = parseStoredIdSnapshot(item.purpose) || baseSnapshot;
            const readyLine = status === "Ready" ? `<p class="ojt-id-ready-note"><i class="fa fa-bell"></i> Your OJT ID is ready for claiming or printing.</p>` : "";
            return `
                <div class="id-request-history-row">
                    <div class="id-history-icon ${status.toLowerCase()}"><i class="fa fa-id-card"></i></div>
                    <div class="id-history-main">
                        <strong>${esc(savedSnapshot.studentName || "OJT ID")}</strong>
                        <small>${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                        ${readyLine}
                        ${item.admin_remarks ? `<p>Admin remarks: ${esc(item.admin_remarks)}</p>` : ""}
                    </div>
                    <span class="badge-status badge-${status.toLowerCase()}">${esc(status)}</span>
                </div>`;
        }).join("");
    };

    window.submitOjtIdRequest = async function(event){
        if(event && typeof event.preventDefault === "function") event.preventDefault();
        if(typeof initSupabase === "function" && !initSupabase()) return;

        await loadStudentAccount();
        const student = typeof getStudent === "function" ? getStudent() : {};
        const snapshot = makeSnapshotFromEditor();

        if(!snapshot.studentName || !snapshot.studentId || !snapshot.office || !snapshot.school || !snapshot.contact){
            if(typeof showToast === "function") showToast("Please complete all ID details before submitting.", "error");
            return;
        }

        const { data: existing, error: existingError } = await supabaseClient
            .from(getOjtIdRequestsTable())
            .select("id,status")
            .eq("student_id", student.id)
            .in("status", ["Pending", "Approved", "Ready"])
            .limit(1);

        if(existingError){
            if(typeof showToast === "function") showToast(existingError.message, "error");
            return;
        }

        if(existing && existing.length){
            if(typeof showToast === "function") showToast("You already submitted an active OJT ID preview.", "error");
            await window.loadOjtIdRequestPage();
            return;
        }

        const btn = document.getElementById("submitOjtIdRequestButton");
        const old = btn ? btn.innerHTML : "";
        if(btn){
            btn.disabled = true;
            btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Sending ID...`;
        }

        const { error } = await supabaseClient
            .from(getOjtIdRequestsTable())
            .insert([{
                student_account_id: student.accountId || null,
                student_id: student.id,
                student_name: snapshot.studentName,
                course: student.course,
                office_assigned: snapshot.office,
                school: snapshot.school,
                contact_number: snapshot.contact,
                profile_picture_url: snapshot.photoUrl || "",
                purpose: REQUEST_PREFIX + JSON.stringify(snapshot),
                status: "Pending"
            }]);

        if(btn){
            btn.disabled = false;
            btn.innerHTML = old;
        }

        if(error){
            if(typeof showToast === "function") showToast(error.message, "error");
            return;
        }

        saveIdDraft(snapshot);
        if(typeof showToast === "function") showToast("OJT ID preview submitted to admin for printing.");
        await window.loadOjtIdRequestPage();
    };

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page !== "id-request") return;
        window.loadOjtIdRequestPage();
    });
})();
