let supabaseClient = null;
let currentUploads = [];
let currentFilter = "All";

const STUDENT_SESSION_KEYS = [
    "ojt_student_logged_in",
    "ojt_student_id",
    "ojt_student_name",
    "ojt_student_last_name",
    "ojt_student_first_name",
    "ojt_student_middle_initial",
    "ojt_student_course",
    "ojt_student_office",
    "ojt_student_email",
    "ojt_student_phone",
    "ojt_student_profile_picture_url",
    "ojt_student_profile_picture_path",
    "ojt_student_account_uuid",
    "ojt_student_completed_hours",
    "ojt_student_required_hours"
];

function getInputValue(id){
    const input = document.getElementById(id);
    return input ? input.value.trim() : "";
}

function getStudentAccountsTable(){
    return typeof STUDENT_ACCOUNTS_TABLE !== "undefined" ? STUDENT_ACCOUNTS_TABLE : "student_accounts";
}

function hasConfig(){
    return typeof SUPABASE_URL !== "undefined"
        && typeof SUPABASE_ANON_KEY !== "undefined"
        && !SUPABASE_URL.includes("PASTE_")
        && !SUPABASE_ANON_KEY.includes("PASTE_");
}

function initSupabase(){
    if(!hasConfig()){
        showToast("Supabase config is missing. Open assets/js/config.js first.", "error");
        return false;
    }

    if(!supabaseClient){
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return true;
}

async function hashPassword(password){
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function clearStudentSession(){
    STUDENT_SESSION_KEYS.forEach(key => {
        sessionStorage.removeItem(key);
        localStorage.removeItem(key); // remove old persistent sessions from previous versions
    });
    sessionStorage.removeItem("ojt_student_last_activity");
}

function setStudentSession(account){
    const lastName = account.last_name || "";
    const firstName = account.first_name || "";
    const middleInitial = account.middle_initial || "";
    const computedName = formatStudentFullName(lastName, firstName, middleInitial);
    const savedName = String(account.full_name || "").trim();
    const finalName = computedName && computedName.includes(",") ? computedName : (savedName || computedName);

    sessionStorage.setItem("ojt_student_logged_in", "true");
    sessionStorage.setItem("ojt_student_last_activity", String(Date.now()));
    sessionStorage.setItem("ojt_student_account_uuid", account.id || "");
    sessionStorage.setItem("ojt_student_id", account.student_id || "");
    sessionStorage.setItem("ojt_student_name", finalName || "");
    sessionStorage.setItem("ojt_student_last_name", lastName || "");
    sessionStorage.setItem("ojt_student_first_name", firstName || "");
    sessionStorage.setItem("ojt_student_middle_initial", middleInitial || "");
    sessionStorage.setItem("ojt_student_course", account.course || "");
    sessionStorage.setItem("ojt_student_office", account.office_assigned || "Not assigned");
    sessionStorage.setItem("ojt_student_email", account.email || "");
    sessionStorage.setItem("ojt_student_phone", account.phone || account.contact_number || "");
    sessionStorage.setItem("ojt_student_profile_picture_url", account.profile_picture_url || "");
    sessionStorage.setItem("ojt_student_profile_picture_path", account.profile_picture_path || "");
    sessionStorage.setItem("ojt_student_completed_hours", Number(account.completed_hours ?? 0));
    sessionStorage.setItem("ojt_student_required_hours", Number(account.required_hours ?? 0));
}

function getStudent(){
    const rawUuid = sessionStorage.getItem("ojt_student_account_uuid") || "";
    return {
        accountId: typeof isValidUuid === "function" && isValidUuid(rawUuid) ? rawUuid : rawUuid,
        id: sessionStorage.getItem("ojt_student_id") || "",
        name: sessionStorage.getItem("ojt_student_name") || "",
        lastName: sessionStorage.getItem("ojt_student_last_name") || "",
        firstName: sessionStorage.getItem("ojt_student_first_name") || "",
        middleInitial: sessionStorage.getItem("ojt_student_middle_initial") || "",
        course: sessionStorage.getItem("ojt_student_course") || "",
        office: sessionStorage.getItem("ojt_student_office") || "Not assigned",
        email: sessionStorage.getItem("ojt_student_email") || "",
        phone: sessionStorage.getItem("ojt_student_phone") || "",
        profilePictureUrl: sessionStorage.getItem("ojt_student_profile_picture_url") || "",
        profilePicturePath: sessionStorage.getItem("ojt_student_profile_picture_path") || "",
        completedHours: Number(sessionStorage.getItem("ojt_student_completed_hours") || 0),
        requiredHours: Number(sessionStorage.getItem("ojt_student_required_hours") || 0)
    };
}

function isLoggedIn(){
    return sessionStorage.getItem("ojt_student_logged_in") === "true";
}

const STUDENT_AUTO_LOGOUT_MS = 8 * 60 * 60 * 1000;

function requireActiveStudentSession(){
    if(!isLoggedIn()){
        return false;
    }

    const lastActivity = Number(sessionStorage.getItem("ojt_student_last_activity") || 0);
    const expired = lastActivity && Date.now() - lastActivity > STUDENT_AUTO_LOGOUT_MS;

    if(expired){
        clearStudentSession();
        sessionStorage.setItem("student_session_expired", "Your session expired. Please log in again.");
        return false;
    }

    sessionStorage.setItem("ojt_student_last_activity", String(Date.now()));
    return true;
}

function startStudentAutoLogout(){
    if(!isLoggedIn()){
        return;
    }

    if(window.__pgmoStudentAutoLogoutStarted){
        return;
    }
    window.__pgmoStudentAutoLogoutStarted = true;

    const updateActivity = () => {
        sessionStorage.setItem("ojt_student_last_activity", String(Date.now()));
    };

    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
        document.addEventListener(eventName, updateActivity, {passive:true});
    });

    setInterval(() => {
        if(!isLoggedIn()){
            return;
        }

        const lastActivity = Number(sessionStorage.getItem("ojt_student_last_activity") || 0);
        if(lastActivity && Date.now() - lastActivity > STUDENT_AUTO_LOGOUT_MS){
            clearStudentSession();
            sessionStorage.setItem("student_session_expired", "Your session expired. Please log in again.");
            window.location.href = "index.html";
        }
    }, 30000);
}

async function loginStudent(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const loginInput = document.getElementById("loginId").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if(!loginInput || !password){
        showToast("Please enter your Student ID or Email and password.", "error");
        return;
    }

    const button = event.target.querySelector("button[type='submit']");
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "Signing in...";

    const table = getStudentAccountsTable();
    let query = supabaseClient.from(table).select("*").limit(1);

    if(loginInput.includes("@")){
        query = query.eq("email", loginInput.toLowerCase());
    }else{
        query = query.eq("student_id", loginInput.toUpperCase());
    }

    const { data, error } = await query;

    button.disabled = false;
    button.innerHTML = originalText;

    if(error){
        showToast(error.message, "error");
        return;
    }

    if(!data || !data.length){
        showToast("Account not found. Please register first.", "error");
        return;
    }

    const account = data[0];
    const passwordHash = await hashPassword(password);

    if(account.password_hash !== passwordHash){
        showToast("Incorrect password.", "error");
        return;
    }

    if(account.status && account.status !== "Active"){
        showToast("Your account is not active. Please contact your coordinator.", "error");
        return;
    }

    setStudentSession(account);

    await supabaseClient
        .from(table)
        .update({last_login_at:new Date().toISOString()})
        .eq("id", account.id);

    if(window.pgmoStartStudentLoginAnimation){
        window.pgmoStartStudentLoginAnimation("dashboard.html");
        return;
    }

    window.location.href = "dashboard.html";
}

async function registerStudent(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const lastName = getInputValue("registerLastName").toUpperCase();
    const firstName = getInputValue("registerFirstName");
    const middleInitial = getInputValue("registerMiddleInitial").toUpperCase().charAt(0);
    const name = formatStudentFullName(lastName, firstName, middleInitial);

    const studentId = getInputValue("registerStudentId").toUpperCase();
    const email = getInputValue("registerEmail").toLowerCase();
    const contactNumber = getInputValue("registerContact");
    const course = getInputValue("registerCourse");
    const password = getInputValue("registerPassword");
    const confirmPassword = getInputValue("confirmPassword");
    const termsCheck = document.getElementById("termsCheck") ? document.getElementById("termsCheck").checked : false;
    const office = "Not assigned";

    if(!lastName || !firstName || !studentId || !email || !contactNumber || !course || !password || !confirmPassword){
        showToast("Please complete all required fields.", "error");
        return;
    }

    if(typeof validateSecureStudentPassword === "function" && !validateSecureStudentPassword(password).ok){
        showToast("Password must include at least 8 characters, uppercase, lowercase, and number.", "error");
        return;
    }else if(typeof validateSecureStudentPassword !== "function" && password.length < 8){
        showToast("Password must be at least 8 characters.", "error");
        return;
    }

    if(password !== confirmPassword){
        showToast("Password and confirm password do not match.", "error");
        return;
    }

    if(!termsCheck){
        showToast("Please agree to the Terms of Service and Privacy Policy.", "error");
        return;
    }

    const button = event.target.querySelector("button[type='submit']");
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = "Creating account...";

    const table = getStudentAccountsTable();

    const { data: sameId, error: idError } = await supabaseClient
        .from(table)
        .select("id")
        .eq("student_id", studentId)
        .limit(1);

    if(idError){
        button.disabled = false;
        button.innerHTML = originalText;
        showToast(idError.message, "error");
        return;
    }

    if(sameId && sameId.length){
        button.disabled = false;
        button.innerHTML = originalText;
        showToast("This Student ID is already registered.", "error");
        return;
    }

    const { data: sameEmail, error: emailError } = await supabaseClient
        .from(table)
        .select("id")
        .eq("email", email)
        .limit(1);

    if(emailError){
        button.disabled = false;
        button.innerHTML = originalText;
        showToast(emailError.message, "error");
        return;
    }

    if(sameEmail && sameEmail.length){
        button.disabled = false;
        button.innerHTML = originalText;
        showToast("This Email is already registered.", "error");
        return;
    }

    const passwordHash = await hashPassword(password);

    const { error } = await supabaseClient
        .from(table)
        .insert([
            {
                student_id: studentId,
                last_name: lastName,
                first_name: firstName,
                middle_initial: middleInitial,
                full_name: name,
                email: email,
                phone: contactNumber,
                contact_number: contactNumber,
                course: course,
                office_assigned: office,
                password_hash: passwordHash,
                status: "Active",
                ojt_status: "Pending",
                completed_hours: 0,
                required_hours: 0
            }
        ]);

    button.disabled = false;
    button.innerHTML = originalText;

    if(error){
        showToast(error.message, "error");
        return;
    }

    clearStudentSession();
    sessionStorage.setItem("registration_success", "Account created successfully. Please log in.");
    window.location.href = "index.html";
}

function logoutStudent(event){
    if(event && typeof event.preventDefault === "function"){
        event.preventDefault();
    }

    if(window.pgmoStartStudentLogoutAnimation){
        window.pgmoStartStudentLogoutAnimation();
        return;
    }

    clearStudentSession();
    window.location.href = "index.html";
}

function protectStudentPage(){
    if(!requireActiveStudentSession()){
        window.location.href = "index.html";
        return false;
    }

    return true;
}

function showToast(message, type="success"){
    const toast = document.getElementById("toastBox");
    if(!toast){
        alert(message);
        return;
    }

    toast.innerHTML = message;
    toast.style.display = "block";
    toast.style.borderLeft = type === "error" ? "5px solid #dc2626" : "5px solid #16a34a";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

function togglePassword(inputId, iconId){
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if(!input || !icon) return;

    if(input.type === "password"){
        input.type = "text";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }else{
        input.type = "password";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    }
}

function updateStats(){
    const total = currentUploads.length;
    const pending = currentUploads.filter(file => file.status === "Pending").length;
    const approved = currentUploads.filter(file => file.status === "Approved").length;
    const returned = currentUploads.filter(file => file.status === "Returned").length;

    const updates = {
        totalFiles: total,
        pendingFiles: pending,
        approvedFiles: approved,
        docOverviewTotal: total,
        docOverviewPending: pending,
        docOverviewApproved: approved,
        docOverviewReturned: returned,
    };

    Object.entries(updates).forEach(([id,value]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    });

    const dot = document.getElementById("topNotificationDot");
    if(dot) dot.style.display = returned > 0 ? "block" : "none";
}

function renderStudentFiles(){
    const container = document.getElementById("studentFiles");
    if(!container) return;

    let list = currentUploads;

    if(currentFilter !== "All"){
        list = currentUploads.filter(file => file.status === currentFilter);
    }

    if(!list.length){
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-folder-open"></i>
                <h5>No documents uploaded yet</h5>
                <p>Your uploaded files will appear here after submission.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(file => `
        <div class="file-row">
            <div class="file-info">
                <div class="file-icon">
                    <i class="fa fa-file-lines"></i>
                </div>
                <div>
                    <strong>${file.file_name}</strong><br>
                    <small>${file.document_type} · ${new Date(file.created_at).toLocaleString()}</small><br>
                    <span class="badge-status badge-${String(file.status).toLowerCase()}">${file.status}</span>
                    ${file.admin_remarks ? `<small class="d-block text-danger mt-1">Admin remarks: ${file.admin_remarks}</small>` : ""}
                </div>
            </div>

            <div class="student-file-actions">
                <button type="button" class="btn btn-sm btn-outline-success pgmo-document-preview-btn" data-file-url="${pgmoDocumentPreviewAttr(file.file_url || "")}" data-file-name="${pgmoDocumentPreviewAttr(file.file_name || file.document_type || "Document")}" data-file-type="${pgmoDocumentPreviewAttr(file.document_type || "Document")}">
                    <i class="fa fa-eye"></i> View
                </button>
                ${String(file.status || "").toLowerCase() === "approved" ? `<span class="student-document-lock"><i class="fa fa-lock"></i> Approved</span>` : `<span class="student-document-lock"><i class="fa fa-file-shield"></i> Submitted</span>`}
            </div>
        </div>
    `).join("");
}

function renderNotifications(){
    const container = document.getElementById("notificationsList");
    if(!container) return;

    const returned = currentUploads.filter(file => file.status === "Returned");
    const approved = currentUploads.filter(file => file.status === "Approved");

    const items = [
        ...returned.map(file => ({
            icon:"fa-rotate-left",
            type:"returned",
            title:"Document returned",
            text:`${file.file_name} needs revision. ${file.admin_remarks || ""}`
        })),
        ...approved.map(file => ({
            icon:"fa-circle-check",
            type:"approved",
            title:"Document approved",
            text:`${file.file_name} has been approved.`
        }))
    ];

    if(!items.length){
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-bell"></i>
                <h5>No notifications yet</h5>
                <p>Updates about your documents will appear here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="notification-item ${item.type}">
            <i class="fa ${item.icon}"></i>
            <div>
                <strong>${item.title}</strong>
                <p>${item.text}</p>
            </div>
        </div>
    `).join("");
}


function formatFileSize(bytes){
    if(!bytes && bytes !== 0) return "";
    const units = ["B","KB","MB","GB"];
    let size = bytes;
    let unitIndex = 0;

    while(size >= 1024 && unitIndex < units.length - 1){
        size = size / 1024;
        unitIndex++;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getUploadSlotIndexes(){
    return [1, 2, 3].filter(slot => document.getElementById(`documentFile${slot}`));
}

function getUploadSlotElements(slot){
    return {
        documentType: document.getElementById(`documentType${slot}`),
        fileInput: document.getElementById(`documentFile${slot}`),
        remarks: document.getElementById(`remarks${slot}`),
        fileInfo: document.getElementById(`selectedFileInfo${slot}`),
        fileName: document.getElementById(`selectedFileName${slot}`),
        fileDetails: document.getElementById(`selectedFileDetails${slot}`),
        dropZone: document.getElementById(`dropZone${slot}`),
        dropZoneTitle: document.getElementById(`dropZoneTitle${slot}`),
        dropZoneSubtitle: document.getElementById(`dropZoneSubtitle${slot}`)
    };
}

function updateSelectedFilePreview(slot = null){
    const slots = slot ? [slot] : getUploadSlotIndexes();

    if(slots.length){
        slots.forEach(currentSlot => {
            const el = getUploadSlotElements(currentSlot);

            if(!el.fileInput || !el.fileInfo || !el.fileName || !el.fileDetails) return;

            if(!el.fileInput.files || !el.fileInput.files.length){
                el.fileInfo.classList.remove("show");
                el.fileName.textContent = "No file selected";
                el.fileDetails.textContent = "Choose a file before uploading.";

                if(el.dropZone) el.dropZone.classList.remove("has-file");
                if(el.dropZoneTitle) el.dropZoneTitle.textContent = "Drop file here";
                if(el.dropZoneSubtitle) el.dropZoneSubtitle.textContent = "or click to browse";

                return;
            }

            const file = el.fileInput.files[0];
            const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE";

            el.fileInfo.classList.add("show");
            el.fileName.textContent = file.name;
            el.fileDetails.textContent = `${extension} · ${formatFileSize(file.size)}`;

            if(el.dropZone) el.dropZone.classList.add("has-file");
            if(el.dropZoneTitle) el.dropZoneTitle.textContent = "File selected";
            if(el.dropZoneSubtitle) el.dropZoneSubtitle.textContent = file.name;
        });

        return;
    }

    const fileInput = document.getElementById("documentFile");
    const fileInfo = document.getElementById("selectedFileInfo");
    const fileName = document.getElementById("selectedFileName");
    const fileDetails = document.getElementById("selectedFileDetails");
    const dropZone = document.getElementById("dropZone");
    const dropZoneTitle = document.getElementById("dropZoneTitle");
    const dropZoneSubtitle = document.getElementById("dropZoneSubtitle");

    if(!fileInput || !fileInfo || !fileName || !fileDetails) return;

    if(!fileInput.files || !fileInput.files.length){
        fileInfo.classList.remove("show");
        fileName.textContent = "No file selected";
        fileDetails.textContent = "Choose a file before uploading.";
        if(dropZone) dropZone.classList.remove("has-file");
        if(dropZoneTitle) dropZoneTitle.textContent = "Drag & drop your file here";
        if(dropZoneSubtitle) dropZoneSubtitle.textContent = "or click to browse";
        return;
    }

    const file = fileInput.files[0];
    const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE";

    fileInfo.classList.add("show");
    fileName.textContent = file.name;
    fileDetails.textContent = `${extension} · ${formatFileSize(file.size)}`;
    if(dropZone) dropZone.classList.add("has-file");
    if(dropZoneTitle) dropZoneTitle.textContent = "File selected";
    if(dropZoneSubtitle) dropZoneSubtitle.textContent = file.name;
}

function clearSelectedFilePreview(slot = null){
    if(slot){
        const fileInput = document.getElementById(`documentFile${slot}`);
        if(fileInput) fileInput.value = "";
        updateSelectedFilePreview(slot);
        return;
    }

    getUploadSlotIndexes().forEach(currentSlot => {
        const fileInput = document.getElementById(`documentFile${currentSlot}`);
        if(fileInput) fileInput.value = "";
        updateSelectedFilePreview(currentSlot);
    });

    const fileInput = document.getElementById("documentFile");
    if(fileInput) fileInput.value = "";
    updateSelectedFilePreview();
}

function getPreparedUploadSlots(){
    const slots = getUploadSlotIndexes();
    const prepared = [];

    slots.forEach(slot => {
        const el = getUploadSlotElements(slot);
        const documentType = el.documentType ? el.documentType.value.trim() : "";
        const file = el.fileInput && el.fileInput.files && el.fileInput.files.length ? el.fileInput.files[0] : null;
        const remarks = el.remarks ? el.remarks.value.trim() : "";

        if(documentType || file){
            prepared.push({
                slot,
                documentType,
                file,
                remarks
            });
        }
    });

    return prepared;
}


async function deleteStudentDocument(id){
    if(!initSupabase()) return;

    const student = getStudent();
    const file = currentUploads.find(item => String(item.id) === String(id));

    if(!file){
        showToast("Document not found. Please refresh the page.", "error");
        return;
    }

    if(String(file.student_id || "") !== String(student.id || "")){
        showToast("You can only delete your own documents.", "error");
        return;
    }

    if(String(file.status || "").toLowerCase() === "approved"){
        showToast("Approved documents cannot be deleted.", "error");
        return;
    }

    showToast("Document deletion is disabled in the student portal.", "error");
    return;

    if(!confirm("Delete this document from your submissions?")) return;

    try{
        if(file.file_path){
            const { error: storageError } = await supabaseClient
                .storage
                .from(typeof OJT_STORAGE_BUCKET !== "undefined" ? OJT_STORAGE_BUCKET : "ojt-documents")
                .remove([file.file_path]);

            if(storageError){
                console.warn("Storage delete warning:", storageError.message);
            }
        }

        const { error } = await supabaseClient
            .from(OJT_UPLOADS_TABLE)
            .delete()
            .eq("id", id)
            .eq("student_id", student.id);

        if(error){
            throw new Error(error.message);
        }

        currentUploads = currentUploads.filter(item => String(item.id) !== String(id));
        updateStats();
        renderStudentFiles();
        loadRequirementChecklist();
        showToast("Document deleted successfully.");
    }catch(error){
        console.error(error);
        showToast(error.message || "Could not delete document.", "error");
    }
}

window.deleteStudentDocument = deleteStudentDocument;

async function uploadDocument(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const student = getStudent();

    if(!student.id || !student.name){
        showToast("Student session is missing. Please log in again.", "error");
        return;
    }

    const multiSlots = getUploadSlotIndexes();

    if(multiSlots.length){
        const preparedSlots = getPreparedUploadSlots();

        if(!preparedSlots.length){
            showToast("Please select at least one document type and file.", "error");
            return;
        }

        for(const item of preparedSlots){
            if(!item.documentType){
                showToast(`Please select a document type for File ${item.slot}.`, "error");
                return;
            }

            if(!item.file){
                showToast(`Please choose a file for File ${item.slot}.`, "error");
                return;
            }
        }

        const allowedExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

        for(const item of preparedSlots){
            const extension = item.file.name.includes(".") ? item.file.name.split(".").pop().toLowerCase() : "";

            if(!allowedExtensions.includes(extension)){
                showToast(`Invalid file type in File ${item.slot}. Use PDF, DOC, DOCX, JPG, JPEG, or PNG.`, "error");
                return;
            }
        }

        const uploadButton = document.getElementById("uploadButton");
        const originalText = uploadButton ? uploadButton.innerHTML : "";

        if(uploadButton){
            uploadButton.disabled = true;
            uploadButton.innerHTML = `Uploading ${preparedSlots.length} file(s)...`;
        }

        const uploadedRecords = [];

        for(const item of preparedSlots){
            const safeName = item.file.name
                .replace(/\s+/g, "_")
                .replace(/[^a-zA-Z0-9._-]/g, "");

            const filePath = `${student.id}/requirements/${Date.now()}_${item.slot}_${safeName}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from(OJT_STORAGE_BUCKET)
                .upload(filePath, item.file, {
                    cacheControl: "3600",
                    upsert: true
                });

            if(uploadError){
                if(uploadButton){
                    uploadButton.disabled = false;
                    uploadButton.innerHTML = originalText;
                }

                console.error("Storage upload error:", uploadError);
                showToast(`File ${item.slot} upload failed: ${uploadError.message}`, "error");
                return;
            }

            const { data: publicUrlData } = supabaseClient
                .storage
                .from(OJT_STORAGE_BUCKET)
                .getPublicUrl(filePath);

            uploadedRecords.push({
                student_id: student.id,
                student_name: student.name,
                course: student.course,
                office_assigned: student.office,
                document_type: item.documentType,
                file_name: item.file.name,
                file_path: filePath,
                file_url: publicUrlData.publicUrl,
                status: "Pending",
                remarks: item.remarks
            });
        }

        const { error: insertError } = await supabaseClient
            .from(OJT_UPLOADS_TABLE)
            .insert(uploadedRecords);

        if(uploadButton){
            uploadButton.disabled = false;
            uploadButton.innerHTML = originalText;
        }

        if(insertError){
            console.error("Database insert error:", insertError);
            showToast("Upload record failed: " + insertError.message, "error");
            return;
        }

        document.getElementById("uploadForm").reset();
        updateSelectedFilePreview();
        showToast(`${uploadedRecords.length} document(s) uploaded successfully. Waiting for admin review.`);

        setTimeout(() => {
            window.location.href = "submissions.html";
        }, 900);

        return;
    }

    const documentType = document.getElementById("documentType") ? document.getElementById("documentType").value.trim() : "";
    const fileInput = document.getElementById("documentFile");
    const remarks = document.getElementById("remarks") ? document.getElementById("remarks").value.trim() : "";

    if(!documentType){
        showToast("Please select a document type.", "error");
        return;
    }

    if(!fileInput || !fileInput.files || !fileInput.files.length){
        showToast("Please select a file to upload.", "error");
        return;
    }

    const file = fileInput.files[0];
    const allowedExtensions = ["pdf","doc","docx","jpg","jpeg","png"];
    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";

    if(!allowedExtensions.includes(extension)){
        showToast("Invalid file type. Use PDF, DOC, DOCX, JPG, JPEG, or PNG.", "error");
        return;
    }

    const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = `${student.id}/requirements/${Date.now()}_${safeName}`;
    const uploadButton = document.getElementById("uploadButton");
    const originalText = uploadButton.innerHTML;

    uploadButton.disabled = true;
    uploadButton.innerHTML = "Uploading...";

    const { error: uploadError } = await supabaseClient
        .storage
        .from(OJT_STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true
        });

    if(uploadError){
        uploadButton.disabled = false;
        uploadButton.innerHTML = originalText;
        console.error("Storage upload error:", uploadError);
        showToast("Storage upload failed: " + uploadError.message, "error");
        return;
    }

    const { data: publicUrlData } = supabaseClient
        .storage
        .from(OJT_STORAGE_BUCKET)
        .getPublicUrl(filePath);

    const uploadRecord = {
        student_id: student.id,
        student_name: student.name,
        course: student.course,
        office_assigned: student.office,
        document_type: documentType,
        file_name: file.name,
        file_path: filePath,
        file_url: publicUrlData.publicUrl,
        status: "Pending",
        remarks: remarks
    };

    const { error: insertError } = await supabaseClient
        .from(OJT_UPLOADS_TABLE)
        .insert([uploadRecord]);

    uploadButton.disabled = false;
    uploadButton.innerHTML = originalText;

    if(insertError){
        console.error("Database insert error:", insertError);
        showToast("Upload record failed: " + insertError.message, "error");
        return;
    }

    document.getElementById("uploadForm").reset();
    updateSelectedFilePreview();
    showToast("Document uploaded successfully. Waiting for admin review.");

    setTimeout(() => {
        window.location.href = "submissions.html";
    }, 900);
}

async function loadStudentDocuments(){
    if(!initSupabase()){
        currentUploads = [];
        updateStats();
        renderStudentFiles();
        renderNotifications();
        return;
    }

    const student = getStudent();
    const container = document.getElementById("studentFiles");

    if(container){
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-spinner fa-spin"></i>
                <h5>Loading documents...</h5>
            </div>
        `;
    }

    const { data, error } = await supabaseClient
        .from(OJT_UPLOADS_TABLE)
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending:false });

    if(error){
        if(container){
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa fa-triangle-exclamation"></i>
                    <h5>Could not load files</h5>
                    <p>${error.message}</p>
                </div>
            `;
        }
        return;
    }

    currentUploads = data || [];
    updateStats();
    renderStudentFiles();
    renderNotifications();
}


async function refreshCurrentStudentAccount(){
    if(!initSupabase()) return null;

    const student = getStudent();

    if(!student.id && !student.accountId) return null;

    let query = supabaseClient
        .from(getStudentAccountsTable())
        .select("*")
        .limit(1);

    if(student.accountId){
        query = query.eq("id", student.accountId);
    }else{
        query = query.eq("student_id", student.id);
    }

    const { data, error } = await query;

    if(error || !data || !data.length){
        return null;
    }

    setStudentSession(data[0]);
    return data[0];
}

function applyProfilePicture(url){
    const targets = [
        document.getElementById("profilePicturePreview")
    ];

    targets.forEach(target => {
        if(!target) return;

        if(url){
            target.innerHTML = `<img src="${url}" alt="Profile Picture">`;
            target.classList.add("has-image");
        }else{
            target.innerHTML = `<i class="fa fa-user"></i>`;
            target.classList.remove("has-image");
        }
    });
}

function loadProfileForm(){
    const student = getStudent();
    const computedName = formatStudentFullName(student.lastName, student.firstName, student.middleInitial);
    const finalName = computedName && computedName.includes(",") ? computedName : (student.name || computedName);

    const fields = {
        profileStudentIdInput: student.id,
        profileLastNameInput: student.lastName,
        profileFirstNameInput: student.firstName,
        profileMiddleInitialInput: student.middleInitial,
        profileCourseInput: student.course,
        profileOfficeInput: student.office,
        profileEmailInput: student.email,
        profilePhoneInput: student.phone,
        profileNameInput: finalName
    };

    Object.entries(fields).forEach(([id,value]) => {
        const input = document.getElementById(id);
        if(input) input.value = value || "";
    });

    applyProfilePicture(student.profilePictureUrl);

    const profileFile = document.getElementById("profilePictureInput");
    const profileFileName = document.getElementById("profilePictureFileName");

    if(profileFile && profileFileName){
        profileFile.addEventListener("change", () => {
            if(profileFile.files && profileFile.files.length){
                profileFileName.textContent = profileFile.files[0].name;
                const previewUrl = URL.createObjectURL(profileFile.files[0]);
                applyProfilePicture(previewUrl);
            }else{
                profileFileName.textContent = "JPG, PNG, or WEBP only";
                applyProfilePicture(student.profilePictureUrl);
            }
        });
    }
}

async function saveStudentProfile(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const current = getStudent();
    const oldStudentId = current.id;

    const newStudentId = getInputValue("profileStudentIdInput").toUpperCase();
    const newEmail = getInputValue("profileEmailInput").toLowerCase();
    const newPhone = getInputValue("profilePhoneInput");
    const newCourse = getInputValue("profileCourseInput");
    const profilePictureInput = document.getElementById("profilePictureInput");

    if(!newStudentId || !newEmail || !newPhone || !newCourse){
        showToast("Please complete Student ID, Email, Contact Number, and Course.", "error");
        return;
    }

    const button = document.getElementById("saveProfileButton");
    const originalText = button.innerHTML;

    button.disabled = true;
    button.innerHTML = "Saving...";

    let profilePictureUrl = current.profilePictureUrl || "";
    let profilePicturePath = current.profilePicturePath || "";

    if(profilePictureInput && profilePictureInput.files && profilePictureInput.files.length){
        const file = profilePictureInput.files[0];
        const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
        const allowed = ["jpg","jpeg","png","webp"];

        if(!allowed.includes(ext)){
            button.disabled = false;
            button.innerHTML = originalText;
            showToast("Profile picture must be JPG, PNG, or WEBP.", "error");
            return;
        }

        const safeName = file.name
            .replace(/\\s+/g, "_")
            .replace(/[^a-zA-Z0-9._-]/g, "");

        profilePicturePath = `profiles/${newStudentId}/${Date.now()}_${safeName}`;

        const { error: picError } = await supabaseClient
            .storage
            .from(OJT_STORAGE_BUCKET)
            .upload(profilePicturePath, file, {
                cacheControl: "3600",
                upsert: true
            });

        if(picError){
            button.disabled = false;
            button.innerHTML = originalText;
            showToast("Profile picture upload failed: " + picError.message, "error");
            return;
        }

        const { data: picUrlData } = supabaseClient
            .storage
            .from(OJT_STORAGE_BUCKET)
            .getPublicUrl(profilePicturePath);

        profilePictureUrl = picUrlData.publicUrl;
    }

    const payload = {
        student_id: newStudentId,
        email: newEmail,
        phone: newPhone,
        contact_number: newPhone,
        course: newCourse,
        profile_picture_url: profilePictureUrl,
        profile_picture_path: profilePicturePath,
        updated_at: new Date().toISOString()
    };

    let updateQuery = supabaseClient
        .from(getStudentAccountsTable())
        .update(payload);

    if(current.accountId){
        updateQuery = updateQuery.eq("id", current.accountId);
    }else{
        updateQuery = updateQuery.eq("student_id", oldStudentId);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select("*");

    if(updateError){
        button.disabled = false;
        button.innerHTML = originalText;
        showToast(updateError.message, "error");
        return;
    }

    if(oldStudentId !== newStudentId){
        await supabaseClient
            .from(OJT_UPLOADS_TABLE)
            .update({
                student_id: newStudentId,
                course: newCourse
            })
            .eq("student_id", oldStudentId);

        if(typeof OJT_DTR_FORMS_TABLE !== "undefined"){
            await supabaseClient
                .from(OJT_DTR_FORMS_TABLE)
                .update({
                    student_id: newStudentId,
                    course: newCourse
                })
                .eq("student_id", oldStudentId);
        }
    }else{
        await supabaseClient
            .from(OJT_UPLOADS_TABLE)
            .update({
                course: newCourse
            })
            .eq("student_id", newStudentId);

        if(typeof OJT_DTR_FORMS_TABLE !== "undefined"){
            await supabaseClient
                .from(OJT_DTR_FORMS_TABLE)
                .update({
                    course: newCourse
                })
                .eq("student_id", newStudentId);
        }
    }

    if(updatedRows && updatedRows.length){
        setStudentSession(updatedRows[0]);
    }else{
        await refreshCurrentStudentAccount();
    }

    setStudentHeader();
    loadProfileForm();

    button.disabled = false;
    button.innerHTML = originalText;

    showToast("Profile updated successfully.");
}


function setStudentHeader(){
    const student = getStudent();
    const computedName = formatStudentFullName(student.lastName, student.firstName, student.middleInitial);
    const displayName = computedName && computedName.includes(",") ? computedName : (student.name || "Student");

    const values = {
        studentDetailsDisplay: `${student.id || "-"} · ${student.course || "-"} · ${student.office || "-"}`,
        miniStudentName: displayName,
        miniStudentId: student.id || "STU-000",
        profileName: displayName,
        profileMeta: `${student.course || "-"} · ${student.office || "-"}`,
        profileStudentId: student.id || "-",
        profileEmail: student.email || "-",
        profileCourse: student.course || "-",
        profileOffice: student.office || "-",
        profilePhone: student.phone || "-"
    };

    Object.entries(values).forEach(([id,value]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    });
    renderSidebarProfilePicture();
}

function renderSidebarProfilePicture(){
    const student = getStudent();
    const miniAvatar = document.querySelector(".mini-avatar");

    if(!miniAvatar) return;

    if(student.profilePictureUrl){
        miniAvatar.innerHTML = `
            <img src="${student.profilePictureUrl}" alt="Profile Picture">
        `;
        miniAvatar.classList.add("has-profile-image");
    }else{
        miniAvatar.innerHTML = `<i class="fa fa-user"></i>`;
        miniAvatar.classList.remove("has-profile-image");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if(page === "login"){
        const msg = sessionStorage.getItem("registration_success");
        if(msg){
            showToast(msg);
            sessionStorage.removeItem("registration_success");
        }

        const expiredMsg = sessionStorage.getItem("student_session_expired");
        if(expiredMsg){
            showToast(expiredMsg, "error");
            sessionStorage.removeItem("student_session_expired");
        }

        clearStudentSession();

        document.getElementById("loginForm").addEventListener("submit", loginStudent);
    }

    if(page === "register"){
        const registerForm = document.getElementById("registerForm");
        if(registerForm){
            registerForm.addEventListener("submit", registerStudent);
        }
    }

    if(!["login","register"].includes(page)){
        if(protectStudentPage() === false) return;
        startStudentAutoLogout();
        setStudentHeader();

        // PERFORMANCE FIX: only load the data needed by the current page.
        // The old code loaded documents + requirements on every student page, including dashboard.
        if(["dashboard", "submissions", "documents", "notifications"].includes(page)){
            loadStudentDocuments();
        }

        if(page === "requirements"){
            loadRequirementChecklist();
        }

        const logoutButton = document.getElementById("logoutButton");
        if(logoutButton){
            logoutButton.addEventListener("click", logoutStudent);
        }

        const uploadForm = document.getElementById("uploadForm");
        if(uploadForm){
            uploadForm.addEventListener("submit", uploadDocument);
        }

        const documentFile = document.getElementById("documentFile");
        if(documentFile){
            documentFile.addEventListener("change", updateSelectedFilePreview);
        }

        const clearSelectedFile = document.getElementById("clearSelectedFile");
        if(clearSelectedFile){
            clearSelectedFile.addEventListener("click", clearSelectedFilePreview);
        }

        updateSelectedFilePreview();

        const profileForm = document.getElementById("profileForm");
        if(profileForm){
            refreshCurrentStudentAccount().then(() => {
                setStudentHeader();
                loadProfileForm();
            });
            profileForm.addEventListener("submit", saveStudentProfile);
        }

        document.querySelectorAll(".tab-row button[data-filter]").forEach(button => {
            button.setAttribute("type", "button");
            button.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const nextFilter = button.dataset.filter || "All";
                if(currentFilter === nextFilter && button.classList.contains("active")){
                    return;
                }

                currentFilter = nextFilter;
                document.querySelectorAll(".tab-row button[data-filter]").forEach(tab => tab.classList.remove("active"));
                button.classList.add("active");
                renderStudentFiles();
            });
        });
    }
});


/* MONTHLY DTR TEMPLATE SYSTEM - RESTORED */

function getDtrFormsTable(){
    return typeof OJT_DTR_FORMS_TABLE !== "undefined" ? OJT_DTR_FORMS_TABLE : "ojt_dtr_forms";
}

function monthlyMinutes(value){
    if(!value) return null;
    const clean = String(value).trim().toLowerCase();
    if(!clean) return null;

    const match = clean.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/);
    if(!match) return null;

    let hour = Number(match[1]);
    let minute = Number(match[2] || 0);
    const period = match[3];

    if(hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    if(period === "pm" && hour < 12) hour += 12;
    if(period === "am" && hour === 12) hour = 0;

    return hour * 60 + minute;
}

function monthlyBlockHours(start, end, blockType = ""){
    let a = monthlyMinutes(start);
    let b = monthlyMinutes(end);

    if(a === null && b === null) return 0;
    if(a === null || b === null) return null;

    let officialStart = 0;
    let officialEnd = 0;

    if(blockType === "am"){
        officialStart = 8 * 60;
        officialEnd = 12 * 60;
    }

    if(blockType === "pm"){
        officialStart = 13 * 60;
        officialEnd = 17 * 60;

        if(a < 720) a += 720;
        if(b < 720) b += 720;
    }

    if(b <= a) return null;

    const countedStart = Math.max(a, officialStart);
    const countedEnd = Math.min(b, officialEnd);

    if(countedEnd <= countedStart) return 0;

    return (countedEnd - countedStart) / 60;
}

function createMonthlyDtrRows(){
    const tbody = document.getElementById("monthlyDtrRows");
    if(!tbody) return;

    let rows = "";

    for(let day = 1; day <= 31; day++){
        rows += `
            <tr data-day="${day}">
                <td class="day-cell">${day}</td>
                <td><input data-field="am_in" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" placeholder="8:00"></td>
                <td><input data-field="am_out" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" placeholder="12:00"></td>
                <td><input data-field="pm_in" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" placeholder="1:00"></td>
                <td><input data-field="pm_out" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" placeholder="5:00"></td>
                <td><input data-field="undertime_hours" data-day="${day}" class="dtr-under-input" type="number" min="0" max="12" step="1"></td>
                <td><input data-field="undertime_minutes" data-day="${day}" class="dtr-under-input" type="number" min="0" max="59" step="1"></td>
            </tr>
        `;
    }

    tbody.innerHTML = rows;

    tbody.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", updateMonthlyDtrTotal);
        input.addEventListener("change", updateMonthlyDtrTotal);
    });

    markMonthWeekends();
    updateMonthlyDtrTotal();
}

function markMonthWeekends(){
    const month = document.getElementById("dtrMonth")?.value;
    const tbody = document.getElementById("monthlyDtrRows");
    if(!month || !tbody) return;

    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    tbody.querySelectorAll("tr").forEach(row => {
        const day = Number(row.dataset.day);
        const cells = row.querySelectorAll("td");

        row.classList.remove("inactive-day");

        if(day > daysInMonth){
            row.classList.add("inactive-day");
            row.querySelectorAll("input").forEach(input => input.value = "");
            return;
        }

        const date = new Date(year, mon - 1, day);
        const weekday = date.getDay();

        if(weekday === 0 || weekday === 6){
            cells[1].innerHTML = `<span class="weekend-label">${weekday === 0 ? "SUN" : "SAT"}</span>`;
            cells[2].innerHTML = "";
            cells[3].innerHTML = "";
            cells[4].innerHTML = "";
        }else{
            const fields = [
                ["am_in", "8:00"],
                ["am_out", "12:00"],
                ["pm_in", "1:00"],
                ["pm_out", "5:00"]
            ];

            fields.forEach(([field, placeholder], index) => {
                const td = cells[index + 1];

                if(!td.querySelector("input")){
                    td.innerHTML = `<input data-field="${field}" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" placeholder="${placeholder}">`;
                    td.querySelector("input").addEventListener("input", updateMonthlyDtrTotal);
                    td.querySelector("input").addEventListener("change", updateMonthlyDtrTotal);
                }
            });
        }
    });

    updateMonthlyDtrTotal();
}

function fillMonthlyWeekdays(){
    const tbody = document.getElementById("monthlyDtrRows");
    if(!tbody) return;

    tbody.querySelectorAll("tr").forEach(row => {
        if(row.classList.contains("inactive-day")) return;

        const amIn = row.querySelector('[data-field="am_in"]');
        const amOut = row.querySelector('[data-field="am_out"]');
        const pmIn = row.querySelector('[data-field="pm_in"]');
        const pmOut = row.querySelector('[data-field="pm_out"]');

        if(amIn && amOut && pmIn && pmOut){
            amIn.value = "8:00";
            amOut.value = "12:00";
            pmIn.value = "1:00";
            pmOut.value = "5:00";
        }
    });

    updateMonthlyDtrTotal();
}

function clearMonthlyDtr(){
    document.querySelectorAll("#monthlyDtrRows input").forEach(input => input.value = "");
    updateMonthlyDtrTotal();
}

function getMonthlyDtrEntries(){
    const rows = document.querySelectorAll("#monthlyDtrRows tr");
    const entries = [];
    let total = 0;

    rows.forEach(row => {
        if(row.classList.contains("inactive-day")) return;

        const day = Number(row.dataset.day);
        const amIn = row.querySelector('[data-field="am_in"]')?.value || "";
        const amOut = row.querySelector('[data-field="am_out"]')?.value || "";
        const pmIn = row.querySelector('[data-field="pm_in"]')?.value || "";
        const pmOut = row.querySelector('[data-field="pm_out"]')?.value || "";
        const undertimeHours = Number(row.querySelector('[data-field="undertime_hours"]')?.value || 0);
        const undertimeMinutes = Number(row.querySelector('[data-field="undertime_minutes"]')?.value || 0);

        const amHours = monthlyBlockHours(amIn, amOut, "am");
        const pmHours = monthlyBlockHours(pmIn, pmOut, "pm");

        if(amHours === null || pmHours === null){
            entries.push({day, invalid:true, am_in:amIn, am_out:amOut, pm_in:pmIn, pm_out:pmOut, undertime_hours:undertimeHours, undertime_minutes:undertimeMinutes, hours:0});
            return;
        }

        const worked = amHours + pmHours;
        const undertime = undertimeHours + (undertimeMinutes / 60);
        const hours = Math.max(0, Number((worked - undertime).toFixed(2)));
        const hasEntry = amIn || amOut || pmIn || pmOut || undertimeHours || undertimeMinutes;

        if(hasEntry){
            total += hours;
            entries.push({
                day,
                am_in:amIn,
                am_out:amOut,
                pm_in:pmIn,
                pm_out:pmOut,
                undertime_hours:undertimeHours,
                undertime_minutes:undertimeMinutes,
                hours
            });
        }
    });

    return {entries, total:Number(total.toFixed(2))};
}

function updateMonthlyDtrTotal(){
    const totalEl = document.getElementById("monthlyDtrTotal");
    if(!totalEl) return;

    const result = getMonthlyDtrEntries();
    const hasInvalid = result.entries.some(item => item.invalid);

    if(hasInvalid){
        totalEl.textContent = "Invalid time entry";
        totalEl.classList.add("text-danger");
        return;
    }

    totalEl.textContent = `${result.total} hours`;
    totalEl.classList.remove("text-danger");
}


function addWorkingDays(startDate, workingDays){
    const result = new Date(startDate);
    let added = 0;

    while(added < workingDays){
        result.setDate(result.getDate() + 1);
        const day = result.getDay();

        if(day !== 0 && day !== 6){
            added++;
        }
    }

    return result;
}

function getEstimatedCompletionDate(completed, required){
    completed = Number(completed || 0);
    required = Number(required || 0);

    if(required <= 0){
        return "Not set";
    }

    const remaining = Math.max(0, required - completed);

    if(remaining <= 0){
        return "Completed";
    }

    const dailyHours = 8;
    const workingDaysNeeded = Math.ceil(remaining / dailyHours);
    const estimatedDate = addWorkingDays(new Date(), workingDaysNeeded);

    return estimatedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function normalizeRequirementName(value){
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function getRequirementAliases(requirementName){
    const key = normalizeRequirementName(requirementName);
    const aliases = {
        endorsementfromschool: ["endorsementfromschool", "endorsementletter", "schoolendorsement", "endorsement"],
        applicationletter: ["applicationletter"],
        biodataresume: ["biodataresume", "resume", "biodata", "biodataresume2pcs", "2pcsbiodataresume"],
        medicalcertificate: ["medicalcertificate", "medicalcert"],
        parentguardianwaiver: ["parentguardianwaiver", "parentsconsent", "parentconsent", "guardianwaiver", "waiver"],
        certificateofregistrationenrollment: ["certificateofregistrationenrollment", "certificateofregistration", "certificateofenrollment", "registrationenrollment", "cor"],
        policeclearance: ["policeclearance"],
        moamou: ["moamou", "moa", "mou"],
        dtr: ["dtr", "dailytimerecord", "dailytimerecorddtr"],
        endorsementletterfromhostingoffice: ["endorsementletterfromhostingoffice", "hostingofficeendorsement", "endorsementfromhostingoffice"],
        dailytimerecorddtr: ["dailytimerecorddtr", "dtr", "dailytimerecord"],
        schoolperformanceevaluationform: ["schoolperformanceevaluationform", "evaluationform", "performanceevaluationform"],
        accomplishmentreport: ["accomplishmentreport", "completionreport"],
        ojtfeedbackform: ["ojtfeedbackform", "feedbackform"],
        weeklyreport: ["weeklyreport"],
        evaluationform: ["evaluationform", "schoolperformanceevaluationform", "performanceevaluationform"],
        completionreport: ["completionreport", "accomplishmentreport"],
        certificateofcompletion: ["certificateofcompletion", "completioncertificate"],
        otherdocument: ["otherdocument", "other"]
    };

    return aliases[key] || [key];
}

function getMatchingRequirementUploads(requirementName, uploads){
    const keys = getRequirementAliases(requirementName);
    return (uploads || []).filter(item => {
        const type = normalizeRequirementName(item.document_type);
        return keys.includes(type);
    });
}

function isAdminUploadedRequirement(item){
    const uploadedBy = String(item?.uploaded_by || "").trim().toLowerCase();
    const filePath = String(item?.file_path || "").toLowerCase();
    const adminRemarks = String(item?.admin_remarks || "").toLowerCase();
    const remarks = String(item?.remarks || "").trim().toLowerCase();

    return uploadedBy === "admin"
        || uploadedBy === "administrator"
        || filePath.includes("/admin_uploads/")
        || filePath.includes("admin_uploads/")
        || adminRemarks.includes("uploaded by admin")
        || remarks === "uploaded by admin";
}

function getRequirementUploadSourceLabel(matchingUploads){
    if(!matchingUploads || !matchingUploads.length){
        return "";
    }

    const latestUpload = matchingUploads[0];

    if(isAdminUploadedRequirement(latestUpload)){
        return `<small class="requirement-source-note admin-source"><i class="fa fa-user-shield"></i> Uploaded by admin</small>`;
    }

    return `<small class="requirement-source-note student-source"><i class="fa fa-user"></i> Uploaded by student</small>`;
}

function getRequirementStatus(requirementName, uploads, dtrForms){
    const req = normalizeRequirementName(requirementName);
    const matches = getMatchingRequirementUploads(requirementName, uploads);

    /*
      Admin-uploaded documents should reflect immediately in OJT Requirements.
      This also lets an admin-uploaded Daily Time Record file satisfy the DTR row.
    */
    if(matches.some(item => item.status === "Approved")){
        return "Approved";
    }

    if(matches.some(item => item.status === "Pending")){
        return "Pending";
    }

    if(matches.some(item => item.status === "Returned" || item.status === "Rejected")){
        return "Returned";
    }

    if(req === "dtr" || req === "dailytimerecord" || req === "dailytimerecorddtr"){
        const completed = Number(sessionStorage.getItem("ojt_student_completed_hours") || 0);
        const required = Number(sessionStorage.getItem("ojt_student_required_hours") || 0);
        const forms = dtrForms || [];

        const hasApprovedDtr = forms.some(item => item.status === "Approved");
        const hasPendingDtr = forms.some(item => item.status === "Pending");
        const hasRejectedDtr = forms.some(item => item.status === "Rejected" || item.status === "Returned");

        /*
          DTR requirement rule:
          Admin-approved DTR submissions alone do not complete the DTR requirement.
          The DTR checklist becomes approved only when the student has reached the
          required hours set by the admin.
        */
        if(required > 0 && completed >= required && hasApprovedDtr){
            return "Approved";
        }

        if(hasPendingDtr || hasApprovedDtr){
            return "Pending";
        }

        if(hasRejectedDtr){
            return "Returned";
        }

        return "Missing";
    }

    return "Missing";
}

function renderRequirementChecklist(uploads, dtrForms){
    const box = document.getElementById("requirementsChecklist");
    if(!box) return;

    const requirementGroups = [
        {
            title: "Pre-Deployment Requirements",
            description: "Submit these requirements before deployment or before starting OJT.",
            items: [
                "Endorsement from School",
                "Application Letter",
                "Certificate of Registration/Enrollment",
                "Biodata/Resume",
                "Medical Certificate",
                "Parent/Guardian Waiver",
                "Police Clearance",
                "MOA/MOU"
            ]
        },
        {
            title: "Post-Deployment Requirements",
            description: "Submit these requirements during or after your OJT deployment.",
            items: [
                "Endorsement Letter from Hosting Office",
                "Daily Time Record (DTR)",
                "School Performance Evaluation Form",
                "Accomplishment Report",
                "Certificate of Completion",
                "OJT Feedback Form"
            ]
        }
    ];

    box.innerHTML = requirementGroups.map(group => `
        <div class="requirement-group">
            <div class="requirement-group-header">
                <h4>${group.title}</h4>
                <p>${group.description}</p>
            </div>

            <div class="requirement-group-list">
                ${group.items.map(name => {
                    const status = getRequirementStatus(name, uploads, dtrForms);
                    const matchingUploads = getMatchingRequirementUploads(name, uploads);
                    const uploadSourceLabel = getRequirementUploadSourceLabel(matchingUploads);

                    let statusClass = "missing";
                    let statusIcon = "fa-xmark";
                    let statusText = "Not approved";
                    let checked = "";

                    if(status === "Approved"){
                        statusClass = "approved";
                        statusIcon = "fa-check";
                        statusText = "Approved";
                        checked = "checked";
                    }else if(status === "Pending"){
                        statusClass = "pending";
                        statusIcon = "fa-hourglass-half";
                        statusText = "Pending review";
                    }else if(status === "Returned"){
                        statusClass = "returned";
                        statusIcon = "fa-xmark";
                        statusText = "Returned / not approved";
                    }

                    return `
                        <div class="requirement-check-row ${statusClass}">
                            <label class="requirement-check-left">
                                <input type="checkbox" disabled ${checked}>
                                <span>${name}</span>
                            </label>

                            <div class="requirement-status-wrap">
                                <div class="requirement-status-pill ${statusClass}">
                                    <i class="fa ${statusIcon}"></i>
                                    ${statusText}
                                </div>
                                ${uploadSourceLabel}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `).join("");
}

async function loadRequirementChecklist(){
    const box = document.getElementById("requirementsChecklist");
    if(!box) return;

    if(!initSupabase()) return;

    const student = getStudent();

    box.innerHTML = `
        <div class="empty-state">
            <i class="fa fa-spinner fa-spin"></i>
            <h5>Loading requirements...</h5>
        </div>
    `;

    const { data: uploads, error: uploadError } = await supabaseClient
        .from(OJT_UPLOADS_TABLE)
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", {ascending:false});

    let dtrForms = [];

    if(typeof OJT_DTR_FORMS_TABLE !== "undefined"){
        const { data: forms } = await supabaseClient
            .from(OJT_DTR_FORMS_TABLE)
            .select("*")
            .eq("student_id", student.id)
            .order("created_at", {ascending:false});

        dtrForms = forms || [];
    }

    if(uploadError){
        box.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-triangle-exclamation"></i>
                <h5>Could not load requirements</h5>
                <p>${uploadError.message}</p>
            </div>
        `;
        return;
    }

    renderRequirementChecklist(uploads || [], dtrForms);
}


async function loadMonthlyDtrStats(){
    if(!initSupabase()) return;

    const student = getStudent();

    const { data: accountRows } = await supabaseClient
        .from(getStudentAccountsTable())
        .select("*")
        .eq("student_id", student.id)
        .limit(1);

    if(accountRows && accountRows.length){
        setStudentSession(accountRows[0]);
    }

    const fresh = getStudent();

    const { data: forms, error } = await supabaseClient
        .from(getDtrFormsTable())
        .select("*")
        .eq("student_id", fresh.id)
        .order("created_at", {ascending:false});

    if(error){
        const box = document.getElementById("studentDtrForms");
        if(box){
            box.innerHTML = `<div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Could not load DTR</h5><p>${error.message}</p></div>`;
        }
        return;
    }

    const completed = Number(sessionStorage.getItem("ojt_student_completed_hours") || 0);
    const required = Number(sessionStorage.getItem("ojt_student_required_hours") || 0);
    const remaining = required > 0 ? Math.max(0, Number((required - completed).toFixed(2))) : "Not set";
    const estimatedCompletion = getEstimatedCompletionDate(completed, required);

    const values = {
        completedHoursDisplay: completed,
        estimatedCompletionDisplay: estimatedCompletion,
        pendingDtrHoursDisplay: estimatedCompletion,
        remainingHoursDisplay: remaining
    };

    Object.entries(values).forEach(([id,value]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    });

    renderStudentMonthlyDtrForms(forms || []);
}

function renderStudentMonthlyDtrForms(forms){
    const box = document.getElementById("studentDtrForms");
    if(!box) return;

    if(!forms.length){
        box.innerHTML = `<div class="empty-state"><i class="fa fa-calendar-days"></i><h5>No DTR submitted yet</h5><p>Your submitted monthly DTR forms will appear here.</p></div>`;
        return;
    }

    box.innerHTML = forms.map(form => `
        <div class="file-row">
            <div class="file-info">
                <div class="file-icon"><i class="fa fa-calendar-days"></i></div>
                <div>
                    <strong>${form.month_label || form.month} · ${Number(form.total_hours || 0)} hour(s)</strong><br>
                    <small>${form.notes || "No notes"}</small><br>
                    <span class="badge-status badge-${String(form.status).toLowerCase()}">${form.status}</span>
                    ${form.admin_remarks ? `<small class="d-block text-danger mt-1">Admin remarks: ${form.admin_remarks}</small>` : ""}
                </div>
            </div>
        </div>
    `).join("");
}

async function submitMonthlyDtr(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const student = getStudent();
    const month = document.getElementById("dtrMonth").value;
    const notes = document.getElementById("dtrNotes").value.trim();
    const result = getMonthlyDtrEntries();

    if(!month){
        showToast("Please select the DTR month.", "error");
        return;
    }

    if(result.entries.some(item => item.invalid)){
        showToast("Please fix invalid time entries.", "error");
        return;
    }

    if(!result.entries.length || result.total <= 0){
        showToast("Please input at least one valid DTR entry.", "error");
        return;
    }

    const btn = document.getElementById("submitMonthlyDtrButton");
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Submitting...";

    const { error } = await supabaseClient.from(getDtrFormsTable()).insert([{
        student_account_id: student.accountId || null,
        student_id: student.id,
        student_name: student.name,
        course: student.course,
        office_assigned: student.office,
        month: month,
        month_label: new Date(month + "-01").toLocaleString("en-US", {month:"long", year:"numeric"}),
        regular_days: document.getElementById("regularDays").value,
        saturdays: document.getElementById("saturdays").value,
        entries: result.entries,
        total_hours: Number(result.total.toFixed(2)),
        notes: notes,
        status: "Pending"
    }]);

    btn.disabled = false;
    btn.innerHTML = old;

    if(error){
        showToast(error.message, "error");
        return;
    }

    document.getElementById("monthlyDtrForm").reset();
    setMonthlyDtrDefaults();
    createMonthlyDtrRows();
    showToast("Monthly DTR submitted. Waiting for admin approval.");
    await loadMonthlyDtrStats();
}


async function downloadJointMonthlyDtrPdf(){
    if(!initSupabase()) return;

    if(!window.jspdf || !window.jspdf.jsPDF){
        showToast("PDF library is not loaded. Please check the jsPDF scripts in dtr.html.", "error");
        return;
    }

    const student = getStudent();
    const monthInput = document.getElementById("dtrMonth");
    const selectedMonth = monthInput ? monthInput.value : "";

    if(!selectedMonth){
        showToast("Please select the DTR month first.", "error");
        return;
    }

    /*
      Compile all submitted DTRs for the selected month.
      This includes Pending, Approved, and Rejected entries because the student asked
      to combine multiple submitted DTR entries into one joint DTR PDF.
    */
    const { data: forms, error } = await supabaseClient
        .from(getDtrFormsTable())
        .select("*")
        .eq("student_id", student.id)
        .eq("month", selectedMonth)
        .order("created_at", { ascending:true });

    if(error){
        showToast(error.message, "error");
        return;
    }

    if(!forms || !forms.length){
        showToast("No DTR entries found for this month.", "error");
        return;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    const mergedEntries = {};

    forms.forEach(form => {
        (form.entries || []).forEach(entry => {
            if(!entry.day) return;

            /*
              If the student submitted multiple entries for the same day,
              the latest submitted entry replaces the older one.
            */
            mergedEntries[Number(entry.day)] = {
                day: Number(entry.day),
                am_in: entry.am_in || "",
                am_out: entry.am_out || "",
                pm_in: entry.pm_in || "",
                pm_out: entry.pm_out || "",
                undertime_hours: entry.undertime_hours || "",
                undertime_minutes: entry.undertime_minutes || "",
                hours: Number(entry.hours || 0)
            };
        });
    });

    let totalHours = 0;
    const tableBody = [];

    for(let day = 1; day <= 31; day++){
        if(day > daysInMonth){
            tableBody.push([String(day), "", "", "", "", "", ""]);
            continue;
        }

        const date = new Date(year, month - 1, day);
        const weekday = date.getDay();

        if(weekday === 0){
            tableBody.push([String(day), "SUN", "", "", "", "", ""]);
            continue;
        }

        if(weekday === 6){
            tableBody.push([String(day), "SAT", "", "", "", "", ""]);
            continue;
        }

        const entry = mergedEntries[day] || {};
        totalHours += Number(entry.hours || 0);

        tableBody.push([
            String(day),
            entry.am_in || "",
            entry.am_out || "",
            entry.pm_in || "",
            entry.pm_out || "",
            entry.undertime_hours ? String(entry.undertime_hours) : "",
            entry.undertime_minutes ? String(entry.undertime_minutes) : ""
        ]);
    }

    const monthLabel = new Date(selectedMonth + "-01").toLocaleString("en-US", {
        month:"long",
        year:"numeric"
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DAILY TIME RECORD", pageWidth / 2, 48, { align:"center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("-----o0o-----", pageWidth / 2, 64, { align:"center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(student.name || "Student", pageWidth / 2, 94, { align:"center" });
    doc.line(150, 100, pageWidth - 150, 100);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("(Name)", pageWidth / 2, 114, { align:"center" });

    doc.setFontSize(10);
    doc.text("For the month of", 45, 140);
    doc.text(monthLabel, 150, 140);
    doc.line(145, 144, 300, 144);

    doc.text("Regular days", 330, 140);
    doc.text("8:00 - 5:00", 420, 140);
    doc.line(415, 144, 520, 144);

    doc.autoTable({
        startY: 160,
        theme: "grid",
        styles: {
            font: "helvetica",
            fontSize: 7.5,
            halign: "center",
            valign: "middle",
            lineColor: [20,20,20],
            lineWidth: 0.8,
            cellPadding: 2.5
        },
        headStyles: {
            fillColor: [255,255,255],
            textColor: [0,0,0],
            fontStyle: "bold"
        },
        head: [
            [
                { content:"Day", rowSpan:2 },
                { content:"A.M.", colSpan:2 },
                { content:"P.M.", colSpan:2 },
                { content:"Undertime", colSpan:2 }
            ],
            [
                "Arrival",
                "Departure",
                "Arrival",
                "Departure",
                "Hours",
                "Minutes"
            ]
        ],
        body: tableBody,
        margin: { left:45, right:45 },
        tableWidth: "auto",
        columnStyles: {
            0: { cellWidth: 38 },
            1: { cellWidth: 70 },
            2: { cellWidth: 70 },
            3: { cellWidth: 70 },
            4: { cellWidth: 70 },
            5: { cellWidth: 60 },
            6: { cellWidth: 60 }
        }
    });

    const finalY = doc.lastAutoTable.finalY + 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total: ${Number(totalHours.toFixed(2))} hours`, pageWidth - 170, finalY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const certText = "I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.";
    doc.text(doc.splitTextToSize(certText, pageWidth - 90), 45, finalY + 28);

    doc.line(85, finalY + 92, pageWidth - 85, finalY + 92);
    doc.text("Student Signature", pageWidth / 2, finalY + 106, { align:"center" });

    doc.text("VERIFIED as to the prescribed office hours:", 45, finalY + 135);

    doc.line(85, finalY + 180, pageWidth - 85, finalY + 180);
    doc.text("In Charge", pageWidth / 2, finalY + 194, { align:"center" });

    const safeStudentId = String(student.id || "student").replace(/[^a-zA-Z0-9_-]/g, "");
    doc.save(`DTR_${safeStudentId}_${selectedMonth}.pdf`);
}


function setMonthlyDtrDefaults(){
    const student = getStudent();
    const name = document.getElementById("dtrName");
    const month = document.getElementById("dtrMonth");

    if(name) name.value = student.name || "Student";
    if(month && !month.value) month.value = new Date().toISOString().slice(0,7);

    const details = document.getElementById("dtrStudentLine");
    if(details) details.textContent = `${student.id} · ${student.course} · ${student.office}`;
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.body.dataset.page !== "monthly-dtr") return;

    setMonthlyDtrDefaults();
    createMonthlyDtrRows();

    const month = document.getElementById("dtrMonth");
    if(month) month.addEventListener("change", markMonthWeekends);

    const fill = document.getElementById("fillWeekdaysButton");
    if(fill) fill.addEventListener("click", fillMonthlyWeekdays);

    const clear = document.getElementById("clearDtrButton");
    if(clear) clear.addEventListener("click", function(event){
        event.preventDefault();
        event.stopPropagation();
        clearMonthlyDtr();
        return false;
    });

    const downloadPdf = document.getElementById("downloadJointDtrPdfButton");
    if(downloadPdf) downloadPdf.addEventListener("click", function(event){
        event.preventDefault();
        event.stopPropagation();
        if(typeof window.PGMO_DTR_PREVIEW === "function") return window.PGMO_DTR_PREVIEW(event);
        return downloadJointMonthlyDtrPdf(event);
    });

    const form = document.getElementById("monthlyDtrForm");
    if(form) form.addEventListener("submit", submitMonthlyDtr);

    loadMonthlyDtrStats();
});



window.addEventListener("load", () => {
    if(document.body.dataset.page !== "monthly-dtr") return;

    const tbody = document.getElementById("monthlyDtrRows");

    if(tbody && tbody.children.length === 0 && typeof createMonthlyDtrRows === "function"){
        setMonthlyDtrDefaults();
        createMonthlyDtrRows();
    }
});

/* MAKE TOP-RIGHT PROFILE ICON CLICKABLE */

function makeTopProfileClickable(){
    const topAvatar = document.querySelector(".top-avatar");

    if(!topAvatar) return;

    topAvatar.style.cursor = "pointer";
    topAvatar.title = "Go to Profile";

    topAvatar.addEventListener("click", () => {
        window.location.href = "profile.html";
    });
}

document.addEventListener("DOMContentLoaded", makeTopProfileClickable);


/* STUDENT NOTIFICATION SYSTEM */

function getStudentNotificationsTable(){
    return typeof OJT_NOTIFICATIONS_TABLE !== "undefined"
        ? OJT_NOTIFICATIONS_TABLE
        : "ojt_notifications";
}

function notificationSafeText(value){
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function notificationIcon(type){
    if(type === "success") return "fa-check";
    if(type === "error") return "fa-xmark";
    if(type === "warning") return "fa-triangle-exclamation";
    return "fa-bell";
}

async function loadNotificationCount(){
    if(!initSupabase()) return;

    const student = getStudent();
    if(!student.id){
        const reqDonut = document.getElementById("dashboardRequirementsDonut");
        if(reqDonut) reqDonut.classList.remove("loading");
        return;
    }

    const { data, error } = await supabaseClient
        .from(getStudentNotificationsTable())
        .select("id")
        .eq("student_id", student.id)
        .eq("is_read", false);

    if(error){
        console.error("Notification count error:", error.message);
        return;
    }

    const count = data ? data.length : 0;

    const badge = document.getElementById("notificationBadge");
    if(badge){
        badge.textContent = count;
        badge.style.display = count > 0 ? "inline-flex" : "none";
    }

    const topDot = document.getElementById("topNotificationDot");
    if(topDot){
        topDot.style.display = count > 0 ? "block" : "none";
    }
}

async function loadNotificationsPage(){
    const list = document.getElementById("notificationsList");
    if(!list) return;

    list.innerHTML = `
        <div class="notification-loading-state">
            <div class="notification-loading-logo"><i class="fa fa-bell"></i></div>
            <h5>Loading notifications...</h5>
            <p>Please wait while updates are being checked.</p>
        </div>
    `;

    if(!initSupabase()) return;

    const student = getStudent();
    if(!student.id) return;

    const { data, error } = await supabaseClient
        .from(getStudentNotificationsTable())
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending:false });

    if(error){
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-triangle-exclamation"></i>
                <h5>Could not load notifications</h5>
                <p>${notificationSafeText(error.message)}</p>
            </div>
        `;
        return;
    }

    if(!data || !data.length){
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa fa-bell"></i>
                <h5>No notifications yet</h5>
                <p>Admin updates will appear here.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = data.map(item => `
        <div class="notification-card ${item.is_read ? "read" : "unread"} ${item.type || "info"}">
            <div class="notification-icon">
                <i class="fa ${notificationIcon(item.type)}"></i>
            </div>

            <div class="notification-content">
                <strong>${notificationSafeText(item.title || "Notification")}</strong>
                <p>${notificationSafeText(item.message || "")}</p>
                <small>${new Date(item.created_at).toLocaleString()}</small>
            </div>
        </div>
    `).join("");

    await supabaseClient
        .from(getStudentNotificationsTable())
        .update({ is_read:true })
        .eq("student_id", student.id)
        .eq("is_read", false);

    await loadNotificationCount();
}

async function clearAllNotifications(){
    if(!initSupabase()) return;

    const student = getStudent();
    if(!student.id) return;

    const confirmClear = confirm("Are you sure you want to clear all notifications?");
    if(!confirmClear) return;

    const button = document.getElementById("clearNotificationsBtn");
    const originalText = button ? button.innerHTML : "";

    if(button){
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Clearing...`;
    }

    const { error } = await supabaseClient
        .from(getStudentNotificationsTable())
        .delete()
        .eq("student_id", student.id);

    if(button){
        button.disabled = false;
        button.innerHTML = originalText;
    }

    if(error){
        showToast(error.message, "error");
        return;
    }

    showToast("Notifications cleared successfully.");

    await loadNotificationsPage();
    await loadNotificationCount();
}

function renderNotifications(){
    loadNotificationsPage();
}

document.addEventListener("DOMContentLoaded", () => {
    loadNotificationCount();
    loadNotificationsPage();

    const clearBtn = document.getElementById("clearNotificationsBtn");
    if(clearBtn){
        clearBtn.addEventListener("click", clearAllNotifications);
    }
});

async function markAllNotificationsRead(){
    if(!initSupabase()) return;
    const student = getStudent();
    if(!student.id) return;
    await supabaseClient.from(getStudentNotificationsTable()).update({ is_read:true }).eq("student_id", student.id).eq("is_read", false);
    await loadNotificationsPage();
    await loadNotificationCount();
}
function renderNotifications(){
    loadNotificationsPage();
}
document.addEventListener("DOMContentLoaded", () => {
    loadNotificationCount();
    loadNotificationsPage();
    const markAll = document.getElementById("markAllNotificationsRead");
    if(markAll) markAll.addEventListener("click", markAllNotificationsRead);
});

/* NAME FORMAT HELPERS */

function formatStudentFullName(lastName, firstName, middleInitial){
    const last = String(lastName || "").trim().toUpperCase();
    const first = String(firstName || "").trim();
    const miRaw = String(middleInitial || "").trim().toUpperCase();
    const mi = miRaw ? `${miRaw.charAt(0)}.` : "";

    return `${last}, ${first}${mi ? " " + mi : ""}`.trim();
}

/* MULTI DOCUMENT UPLOAD LISTENERS */

function setupMultiDocumentUploadSlots(){
    getUploadSlotIndexes().forEach(slot => {
        const fileInput = document.getElementById(`documentFile${slot}`);
        const clearButton = document.getElementById(`clearSelectedFile${slot}`);

        if(fileInput && !fileInput.dataset.multiUploadBound){
            fileInput.addEventListener("change", () => updateSelectedFilePreview(slot));
            fileInput.dataset.multiUploadBound = "true";
        }

        if(clearButton && !clearButton.dataset.multiUploadBound){
            clearButton.addEventListener("click", () => clearSelectedFilePreview(slot));
            clearButton.dataset.multiUploadBound = "true";
        }

        updateSelectedFilePreview(slot);
    });
}

document.addEventListener("DOMContentLoaded", setupMultiDocumentUploadSlots);

/* MOBILE SIDEBAR DROPDOWN */
document.addEventListener("DOMContentLoaded", function(){
    const menuBtn = document.getElementById("mobileMenuBtn");
    const sidebar = document.querySelector(".sidebar");

    if(menuBtn && sidebar){
        menuBtn.addEventListener("click", function(){
            sidebar.classList.toggle("mobile-open");

            const icon = menuBtn.querySelector("i");

            if(sidebar.classList.contains("mobile-open")){
                icon.classList.remove("fa-bars");
                icon.classList.add("fa-xmark");
            }else{
                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");
            }
        });

        document.addEventListener("click", function(event){
            const clickedInsideMenu = sidebar.contains(event.target);
            const clickedButton = menuBtn.contains(event.target);

            if(!clickedInsideMenu && !clickedButton){
                sidebar.classList.remove("mobile-open");

                const icon = menuBtn.querySelector("i");
                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");
            }
        });
    }
});

/* FINAL PHONE DROPDOWN MENU FIX - ChatGPT */
(function(){
    function initFinalPhoneDropdown(){
        const menuBtn = document.getElementById("mobileMenuBtn");
        const sidebar = document.querySelector(".portal-sidebar");

        if(!menuBtn || !sidebar){
            return;
        }

        // Prevent duplicated listeners when scripts are reloaded.
        if(menuBtn.dataset.finalPhoneMenuReady === "true"){
            return;
        }
        menuBtn.dataset.finalPhoneMenuReady = "true";

        const icon = menuBtn.querySelector("i");
        const label = menuBtn.querySelector("span");

        function setMenuState(isOpen){
            document.body.classList.toggle("mobile-menu-open", isOpen);

            if(icon){
                icon.classList.toggle("fa-bars", !isOpen);
                icon.classList.toggle("fa-xmark", isOpen);
            }

            if(label){
                label.textContent = isOpen ? "Menu" : "Menu";
            }

            menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        }

        function toggleMenu(event){
            if(event){
                event.preventDefault();
                event.stopPropagation();
                if(typeof event.stopImmediatePropagation === "function"){
                    event.stopImmediatePropagation();
                }
            }

            const isOpen = document.body.classList.contains("mobile-menu-open");
            setMenuState(!isOpen);
        }

        function closeMenu(){
            setMenuState(false);
        }

        window.pgmoCloseStudentMobileMenu = closeMenu;

        menuBtn.addEventListener("click", toggleMenu, true);
        menuBtn.addEventListener("touchend", function(event){
            event.preventDefault();
            toggleMenu(event);
        }, { passive:false, capture:true });

        sidebar.addEventListener("click", function(event){
            event.stopPropagation();
        });

        sidebar.querySelectorAll("a").forEach(function(link){
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("click", function(event){
            if(!document.body.classList.contains("mobile-menu-open")){
                return;
            }

            if(menuBtn.contains(event.target) || sidebar.contains(event.target)){
                return;
            }

            closeMenu();
        });

        window.addEventListener("resize", function(){
            if(window.innerWidth > 900){
                closeMenu();
            }
        });

        setMenuState(false);
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", initFinalPhoneDropdown);
    }else{
        initFinalPhoneDropdown();
    }
})();


/* PGMO POLISH PATCH 2026-06: DTR half-day + OJT ID request + mobile fixes */

function getOjtIdRequestsTable(){
    return typeof OJT_ID_REQUESTS_TABLE !== "undefined" ? OJT_ID_REQUESTS_TABLE : "ojt_id_requests";
}

(function extendStudentSessionForOjtId(){
    if(typeof STUDENT_SESSION_KEYS !== "undefined" && !STUDENT_SESSION_KEYS.includes("ojt_student_id_request_allowed")){
        STUDENT_SESSION_KEYS.push("ojt_student_id_request_allowed");
    }
})();

const __originalSetStudentSessionForOjtId = typeof setStudentSession === "function" ? setStudentSession : null;
setStudentSession = function(account){
    if(__originalSetStudentSessionForOjtId){
        __originalSetStudentSessionForOjtId(account);
    }
    sessionStorage.setItem("ojt_student_id_request_allowed", account.ojt_id_request_allowed === true ? "true" : "false");
};

const __originalGetStudentForOjtId = typeof getStudent === "function" ? getStudent : null;
getStudent = function(){
    const student = __originalGetStudentForOjtId ? __originalGetStudentForOjtId() : {};
    student.idRequestAllowed = sessionStorage.getItem("ojt_student_id_request_allowed") === "true";
    return student;
};

function createMonthlyDtrRows(){
    const tbody = document.getElementById("monthlyDtrRows");
    if(!tbody) return;

    let rows = "";
    for(let day = 1; day <= 31; day++){
        rows += `
            <tr data-day="${day}">
                <td class="day-cell">${day}</td>
                <td><input data-field="am_in" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" aria-label="Day ${day} AM arrival"></td>
                <td><input data-field="am_out" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" aria-label="Day ${day} AM departure"></td>
                <td><input data-field="pm_in" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" aria-label="Day ${day} PM arrival"></td>
                <td><input data-field="pm_out" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric" aria-label="Day ${day} PM departure"></td>
                <td><input data-field="undertime_hours" data-day="${day}" class="dtr-under-input" type="number" min="0" max="12" step="1"></td>
                <td><input data-field="undertime_minutes" data-day="${day}" class="dtr-under-input" type="number" min="0" max="59" step="1"></td>
            </tr>`;
    }

    tbody.innerHTML = rows;
    tbody.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", updateMonthlyDtrTotal);
        input.addEventListener("change", updateMonthlyDtrTotal);
    });
    markMonthWeekends();
    updateMonthlyDtrTotal();
}

function markMonthWeekends(){
    const month = document.getElementById("dtrMonth")?.value;
    const tbody = document.getElementById("monthlyDtrRows");
    if(!month || !tbody) return;

    const [year, mon] = month.split("-").map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    tbody.querySelectorAll("tr").forEach(row => {
        const day = Number(row.dataset.day);
        const cells = row.querySelectorAll("td");
        row.classList.remove("inactive-day");

        if(day > daysInMonth){
            row.classList.add("inactive-day");
            row.querySelectorAll("input").forEach(input => input.value = "");
            return;
        }

        const date = new Date(year, mon - 1, day);
        const weekday = date.getDay();
        if(weekday === 0 || weekday === 6){
            cells[1].innerHTML = `<span class="weekend-label">${weekday === 0 ? "SUN" : "SAT"}</span>`;
            cells[2].innerHTML = "";
            cells[3].innerHTML = "";
            cells[4].innerHTML = "";
        }else{
            const fields = ["am_in", "am_out", "pm_in", "pm_out"];
            fields.forEach((field, index) => {
                const td = cells[index + 1];
                if(!td.querySelector("input")){
                    td.innerHTML = `<input data-field="${field}" data-day="${day}" class="dtr-time-input" type="text" inputmode="numeric">`;
                    td.querySelector("input").addEventListener("input", updateMonthlyDtrTotal);
                    td.querySelector("input").addEventListener("change", updateMonthlyDtrTotal);
                }
            });
        }
    });
    updateMonthlyDtrTotal();
}

function fillMonthlyWeekdays(){
    fillMonthlyByType("full");
}

function fillMonthlyByType(type){
    const tbody = document.getElementById("monthlyDtrRows");
    if(!tbody) return;

    tbody.querySelectorAll("tr").forEach(row => {
        if(row.classList.contains("inactive-day")) return;
        const amIn = row.querySelector('[data-field="am_in"]');
        const amOut = row.querySelector('[data-field="am_out"]');
        const pmIn = row.querySelector('[data-field="pm_in"]');
        const pmOut = row.querySelector('[data-field="pm_out"]');
        if(!amIn && !pmIn) return;

        if(amIn) amIn.value = (type === "full" || type === "am") ? "8:00" : "";
        if(amOut) amOut.value = (type === "full" || type === "am") ? "12:00" : "";
        if(pmIn) pmIn.value = (type === "full" || type === "pm") ? "1:00" : "";
        if(pmOut) pmOut.value = (type === "full" || type === "pm") ? "5:00" : "";
    });
    updateMonthlyDtrTotal();
}

function getMonthlyDtrEntries(){
    const rows = document.querySelectorAll("#monthlyDtrRows tr");
    const entries = [];
    let total = 0;

    rows.forEach(row => {
        if(row.classList.contains("inactive-day")) return;
        const day = Number(row.dataset.day);
        const amIn = row.querySelector('[data-field="am_in"]')?.value || "";
        const amOut = row.querySelector('[data-field="am_out"]')?.value || "";
        const pmIn = row.querySelector('[data-field="pm_in"]')?.value || "";
        const pmOut = row.querySelector('[data-field="pm_out"]')?.value || "";
        const undertimeHours = Number(row.querySelector('[data-field="undertime_hours"]')?.value || 0);
        const undertimeMinutes = Number(row.querySelector('[data-field="undertime_minutes"]')?.value || 0);

        const amHours = monthlyBlockHours(amIn, amOut, "am");
        const pmHours = monthlyBlockHours(pmIn, pmOut, "pm");

        if(amHours === null || pmHours === null){
            entries.push({day, invalid:true, am_in:amIn, am_out:amOut, pm_in:pmIn, pm_out:pmOut, undertime_hours:undertimeHours, undertime_minutes:undertimeMinutes, hours:0});
            return;
        }

        const hasEntry = amIn || amOut || pmIn || pmOut || undertimeHours || undertimeMinutes;
        if(!hasEntry) return;

        const worked = Number(amHours || 0) + Number(pmHours || 0);
        const undertime = undertimeHours + (undertimeMinutes / 60);
        const hours = Math.max(0, Number((worked - undertime).toFixed(2)));
        let dayType = "Custom";
        if(amHours > 0 && pmHours > 0) dayType = "Full Day";
        if(amHours > 0 && pmHours === 0) dayType = "AM Half-Day";
        if(amHours === 0 && pmHours > 0) dayType = "PM Half-Day";

        total += hours;
        entries.push({
            day,
            day_type: dayType,
            am_in: amIn,
            am_out: amOut,
            pm_in: pmIn,
            pm_out: pmOut,
            am_hours: Number(amHours || 0),
            pm_hours: Number(pmHours || 0),
            undertime_hours: undertimeHours,
            undertime_minutes: undertimeMinutes,
            hours
        });
    });

    return {entries, total:Number(total.toFixed(2))};
}

async function refreshStudentAccountForPage(){
    if(!initSupabase()) return null;
    const student = getStudent();
    if(!student.id) return null;
    const { data, error } = await supabaseClient
        .from(getStudentAccountsTable())
        .select("*")
        .eq("student_id", student.id)
        .limit(1);
    if(!error && data && data.length){
        setStudentSession(data[0]);
        return data[0];
    }
    return null;
}

async function loadOjtIdRequestPage(){
    const statusBox = document.getElementById("ojtIdAccessStatus");
    const submitBtn = document.getElementById("submitOjtIdRequestButton");
    const listBox = document.getElementById("ojtIdRequestList");
    if(!statusBox && !listBox) return;
    if(!initSupabase()) return;

    const account = await refreshStudentAccountForPage();
    const student = getStudent();
    const allowed = student.idRequestAllowed;

    if(statusBox){
        statusBox.className = `id-request-status-box ${allowed ? "allowed" : "locked"}`;
        statusBox.innerHTML = allowed ? `
            <i class="fa fa-circle-check"></i>
            <div><strong>Approved to request OJT ID</strong><p>You may now submit your OJT ID request.</p></div>
        ` : `
            <i class="fa fa-lock"></i>
            <div><strong>Waiting for coordinator approval</strong><p>Your admin must approve your ID request access before you can submit.</p></div>
        `;
    }

    if(submitBtn){
        submitBtn.disabled = !allowed;
    }

    const { data, error } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", {ascending:false});

    if(!listBox) return;
    if(error){
        listBox.innerHTML = `<div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Could not load ID requests</h5><p>${notificationSafeText ? notificationSafeText(error.message) : error.message}</p></div>`;
        return;
    }

    if(!data || !data.length){
        listBox.innerHTML = `<div class="empty-state"><i class="fa fa-id-card"></i><h5>No OJT ID request yet</h5><p>Your request history will appear here.</p></div>`;
        return;
    }

    listBox.innerHTML = data.map(item => `
        <div class="file-row">
            <div class="file-info">
                <div class="file-icon"><i class="fa fa-id-card"></i></div>
                <div>
                    <strong>OJT ID Request</strong><br>
                    <small>${notificationSafeText(item.purpose || "No notes")}</small><br>
                    <span class="badge-status badge-${String(item.status || "Pending").toLowerCase()}">${notificationSafeText(item.status || "Pending")}</span>
                    ${item.admin_remarks ? `<small class="d-block text-danger mt-1">Admin remarks: ${notificationSafeText(item.admin_remarks)}</small>` : ""}
                </div>
            </div>
            <small>${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
        </div>
    `).join("");
}

async function submitOjtIdRequest(event){
    event.preventDefault();
    if(!initSupabase()) return;
    await refreshStudentAccountForPage();
    const student = getStudent();
    if(!student.idRequestAllowed){
        showToast("Your coordinator must approve your ID request access first.", "error");
        return;
    }
    const purpose = (document.getElementById("ojtIdRequestPurpose")?.value || "").trim();
    if(!purpose){
        showToast("Please enter your request purpose or notes.", "error");
        return;
    }

    const { data: existing } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .select("id,status")
        .eq("student_id", student.id)
        .in("status", ["Pending", "Approved"])
        .limit(1);
    if(existing && existing.length){
        showToast("You already have an active OJT ID request.", "error");
        return;
    }

    const btn = document.getElementById("submitOjtIdRequestButton");
    const old = btn ? btn.innerHTML : "";
    if(btn){ btn.disabled = true; btn.innerHTML = "Submitting..."; }

    const { error } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .insert([{
            student_account_id: student.accountId || null,
            student_id: student.id,
            student_name: student.name,
            course: student.course,
            office_assigned: student.office,
            purpose: purpose,
            status: "Pending"
        }]);

    if(btn){ btn.disabled = false; btn.innerHTML = old; }
    if(error){
        showToast(error.message, "error");
        return;
    }
    document.getElementById("ojtIdRequestPurpose").value = "";
    showToast("OJT ID request submitted. Waiting for admin review.");
    await loadOjtIdRequestPage();
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.body.dataset.page === "monthly-dtr"){
        const am = document.getElementById("fillAmHalfDaysButton");
        const pm = document.getElementById("fillPmHalfDaysButton");
        if(am) am.addEventListener("click", () => fillMonthlyByType("am"));
        if(pm) pm.addEventListener("click", () => fillMonthlyByType("pm"));
    }
    if(document.body.dataset.page === "id-request"){
        const form = document.getElementById("ojtIdRequestForm");
        if(form) form.addEventListener("submit", submitOjtIdRequest);
        loadOjtIdRequestPage();
    }
});

/* PGMO PATCH 2026-06-25: cleaner OJT ID page, hour-only DTR inputs, and student change password */

function studentSafeText(value){
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* DTR time input formatter is handled by assets/js/dtr-colon-delete-fix.js.
   Keep this shim so older init calls do not create duplicate listeners. */
function initDtrHourOnlyInputs(){
    return true;
}
function initDtrHourMinuteInputs(){
    return true;
}
function initDtrSmartTimeInputs(){
    return true;
}

async function loadOjtIdRequestPage(){
    const statusBox = document.getElementById("ojtIdAccessStatus");
    const submitBtn = document.getElementById("submitOjtIdRequestButton");
    const listBox = document.getElementById("ojtIdRequestList");
    const hint = document.getElementById("ojtIdRequestHint");

    if(!statusBox && !submitBtn && !listBox) return;
    if(!initSupabase()) return;

    await refreshStudentAccountForPage();
    const student = getStudent();
    const allowed = student.idRequestAllowed === true;

    const { data, error } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending:false });

    const requests = data || [];
    const activeRequest = requests.find(item => ["Pending", "Approved"].includes(String(item.status || "Pending")));

    if(statusBox){
        if(!allowed){
            statusBox.className = "id-request-status-box clean-status locked";
            statusBox.innerHTML = `
                <i class="fa fa-lock"></i>
                <div>
                    <strong>Waiting for coordinator approval</strong>
                    <p>Your coordinator must approve your OJT ID request access first.</p>
                </div>`;
        }else if(activeRequest && String(activeRequest.status || "Pending") === "Pending"){
            statusBox.className = "id-request-status-box clean-status pending";
            statusBox.innerHTML = `
                <i class="fa fa-clock"></i>
                <div>
                    <strong>OJT ID request sent</strong>
                    <p>Your request is now waiting for admin review.</p>
                </div>`;
        }else if(activeRequest && String(activeRequest.status || "Pending") === "Approved"){
            statusBox.className = "id-request-status-box clean-status allowed";
            statusBox.innerHTML = `
                <i class="fa fa-circle-check"></i>
                <div>
                    <strong>OJT ID request approved</strong>
                    <p>Your OJT ID request has been approved by the admin.</p>
                </div>`;
        }else{
            statusBox.className = "id-request-status-box clean-status allowed";
            statusBox.innerHTML = `
                <i class="fa fa-circle-check"></i>
                <div>
                    <strong>Approved to request OJT ID</strong>
                    <p>You may now submit your OJT ID request.</p>
                </div>`;
        }
    }

    if(submitBtn){
        submitBtn.disabled = !allowed || !!activeRequest;

        if(!allowed){
            submitBtn.innerHTML = `<i class="fa fa-lock"></i> Waiting for Approval`;
        }else if(activeRequest && String(activeRequest.status || "Pending") === "Pending"){
            submitBtn.innerHTML = `<i class="fa fa-clock"></i> Request Pending`;
        }else if(activeRequest && String(activeRequest.status || "Pending") === "Approved"){
            submitBtn.innerHTML = `<i class="fa fa-circle-check"></i> Request Approved`;
        }else{
            submitBtn.innerHTML = `<i class="fa fa-id-card"></i> Request OJT ID`;
        }
    }

    if(hint){
        if(!allowed){
            hint.textContent = "Your request button will unlock after coordinator approval.";
        }else if(activeRequest){
            hint.textContent = "You already have an active OJT ID request.";
        }else{
            hint.textContent = "Click once to send your OJT ID request to the admin.";
        }
    }

    if(!listBox) return;

    if(error){
        listBox.innerHTML = `<div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Could not load ID requests</h5><p>${studentSafeText(error.message)}</p></div>`;
        return;
    }

    if(!requests.length){
        listBox.innerHTML = `<div class="empty-state compact-empty"><i class="fa fa-id-card"></i><h5>No request yet</h5><p>Your OJT ID request history will appear here.</p></div>`;
        return;
    }

    listBox.innerHTML = requests.map(item => {
        const status = String(item.status || "Pending");
        return `
            <div class="id-request-history-row">
                <div class="id-history-icon ${status.toLowerCase()}">
                    <i class="fa fa-id-card"></i>
                </div>
                <div class="id-history-main">
                    <strong>OJT ID Request</strong>
                    <small>${item.created_at ? new Date(item.created_at).toLocaleString() : ""}</small>
                    ${item.admin_remarks ? `<p>Admin remarks: ${studentSafeText(item.admin_remarks)}</p>` : ""}
                </div>
                <span class="badge-status badge-${status.toLowerCase()}">${studentSafeText(status)}</span>
            </div>`;
    }).join("");
}

async function submitOjtIdRequest(event){
    if(event && typeof event.preventDefault === "function") event.preventDefault();

    if(!initSupabase()) return;

    await refreshStudentAccountForPage();
    const student = getStudent();

    if(!student.idRequestAllowed){
        showToast("Your coordinator must approve your ID request access first.", "error");
        return;
    }

    const { data: existing, error: existingError } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .select("id,status")
        .eq("student_id", student.id)
        .in("status", ["Pending", "Approved"])
        .limit(1);

    if(existingError){
        showToast(existingError.message, "error");
        return;
    }

    if(existing && existing.length){
        showToast("You already have an active OJT ID request.", "error");
        await loadOjtIdRequestPage();
        return;
    }

    const btn = document.getElementById("submitOjtIdRequestButton");
    const old = btn ? btn.innerHTML : "";

    if(btn){
        btn.disabled = true;
        btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Sending...`;
    }

    const { error } = await supabaseClient
        .from(getOjtIdRequestsTable())
        .insert([{
            student_account_id: student.accountId || null,
            student_id: student.id,
            student_name: student.name,
            course: student.course,
            office_assigned: student.office,
            purpose: "Requesting OJT ID for office entry and identification.",
            status: "Pending"
        }]);

    if(btn){
        btn.disabled = false;
        btn.innerHTML = old;
    }

    if(error){
        showToast(error.message, "error");
        return;
    }

    showToast("OJT ID request sent. Waiting for admin review.");
    await loadOjtIdRequestPage();
}

function initStudentPasswordToggles(){
    document.querySelectorAll(".student-password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const targetId = button.getAttribute("data-target");
            const input = document.getElementById(targetId);
            const icon = button.querySelector("i");
            if(!input || !icon) return;

            if(input.type === "password"){
                input.type = "text";
                icon.classList.remove("fa-eye-slash");
                icon.classList.add("fa-eye");
            }else{
                input.type = "password";
                icon.classList.remove("fa-eye");
                icon.classList.add("fa-eye-slash");
            }
        });
    });
}

async function changeStudentPassword(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const currentPassword = getInputValue("currentPasswordInput");
    const newPassword = getInputValue("newPasswordInput");
    const confirmPassword = getInputValue("confirmNewPasswordInput");

    if(!currentPassword || !newPassword || !confirmPassword){
        showToast("Please complete all password fields.", "error");
        return;
    }

    if(newPassword.length < 4){
        showToast("New password must be at least 4 characters.", "error");
        return;
    }

    if(newPassword !== confirmPassword){
        showToast("New password and confirm password do not match.", "error");
        return;
    }

    if(currentPassword === newPassword){
        showToast("New password must be different from your current password.", "error");
        return;
    }

    const student = getStudent();
    const button = document.getElementById("changePasswordButton");
    const originalText = button ? button.innerHTML : "";

    if(button){
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Updating...`;
    }

    let query = supabaseClient
        .from(getStudentAccountsTable())
        .select("id,password_hash")
        .limit(1);

    if(student.accountId){
        query = query.eq("id", student.accountId);
    }else{
        query = query.eq("student_id", student.id);
    }

    const { data, error } = await query;

    if(error || !data || !data.length){
        if(button){ button.disabled = false; button.innerHTML = originalText; }
        showToast(error ? error.message : "Could not verify your account.", "error");
        return;
    }

    const account = data[0];
    const currentHash = await hashPassword(currentPassword);

    if(account.password_hash !== currentHash){
        if(button){ button.disabled = false; button.innerHTML = originalText; }
        showToast("Current password is incorrect.", "error");
        return;
    }

    const newHash = await hashPassword(newPassword);

    const { error: updateError } = await supabaseClient
        .from(getStudentAccountsTable())
        .update({
            password_hash: newHash,
            updated_at: new Date().toISOString()
        })
        .eq("id", account.id);

    if(button){
        button.disabled = false;
        button.innerHTML = originalText;
    }

    if(updateError){
        showToast(updateError.message, "error");
        return;
    }

    ["currentPasswordInput", "newPasswordInput", "confirmNewPasswordInput"].forEach(id => {
        const input = document.getElementById(id);
        if(input){
            input.value = "";
            input.type = "password";
        }
    });

    document.querySelectorAll(".student-password-toggle i").forEach(icon => {
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    });

    showToast("Password changed successfully.");
}

document.addEventListener("DOMContentLoaded", () => {
    initDtrHourOnlyInputs();
    initStudentPasswordToggles();

    const idRequestButton = document.getElementById("submitOjtIdRequestButton");
    if(idRequestButton){
        idRequestButton.addEventListener("click", submitOjtIdRequest);
    }

    const changePasswordForm = document.getElementById("changePasswordForm");
    if(changePasswordForm){
        changePasswordForm.addEventListener("submit", changeStudentPassword);
    }
});


/* Removed duplicate DTR hour-minute formatter; handled by dtr-colon-delete-fix.js. */

async function changeStudentPassword(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const currentPassword = getInputValue("currentPasswordInput");
    const newPassword = getInputValue("newPasswordInput");
    const confirmPassword = getInputValue("confirmNewPasswordInput");
    const forgotMode = document.getElementById("forgotPasswordToggle")?.checked === true;

    if(!newPassword || !confirmPassword){
        showToast("Please enter and confirm your new password.", "error");
        return;
    }

    if(!currentPassword && !forgotMode){
        showToast("Enter your current password, or check 'I forgot my current password'.", "error");
        return;
    }

    if(newPassword.length < 4){
        showToast("New password must be at least 4 characters.", "error");
        return;
    }

    if(newPassword !== confirmPassword){
        showToast("New password and confirm password do not match.", "error");
        return;
    }

    if(currentPassword && currentPassword === newPassword){
        showToast("New password must be different from your current password.", "error");
        return;
    }

    const student = getStudent();
    const button = document.getElementById("changePasswordButton");
    const originalText = button ? button.innerHTML : "";

    if(button){
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Updating...`;
    }

    let query = supabaseClient
        .from(getStudentAccountsTable())
        .select("id,password_hash")
        .limit(1);

    if(student.accountId){
        query = query.eq("id", student.accountId);
    }else{
        query = query.eq("student_id", student.id);
    }

    const { data, error } = await query;

    if(error || !data || !data.length){
        if(button){ button.disabled = false; button.innerHTML = originalText; }
        showToast(error ? error.message : "Could not verify your account.", "error");
        return;
    }

    const account = data[0];

    if(currentPassword && !forgotMode){
        const currentHash = await hashPassword(currentPassword);

        if(account.password_hash !== currentHash){
            if(button){ button.disabled = false; button.innerHTML = originalText; }
            showToast("Current password is incorrect. If you forgot it, check the forgot-password option.", "error");
            return;
        }
    }

    const newHash = await hashPassword(newPassword);

    const { error: updateError } = await supabaseClient
        .from(getStudentAccountsTable())
        .update({
            password_hash: newHash,
            updated_at: new Date().toISOString()
        })
        .eq("id", account.id);

    if(button){
        button.disabled = false;
        button.innerHTML = originalText;
    }

    if(updateError){
        showToast(updateError.message, "error");
        return;
    }

    ["currentPasswordInput", "newPasswordInput", "confirmNewPasswordInput"].forEach(id => {
        const input = document.getElementById(id);
        if(input){
            input.value = "";
            input.type = "password";
        }
    });

    const forgot = document.getElementById("forgotPasswordToggle");
    if(forgot) forgot.checked = false;

    document.querySelectorAll(".student-password-toggle i").forEach(icon => {
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    });

    showToast("Password updated successfully.");
}

/* PGMO PATCH 2026-06-25: secure invite-only registration + erasable DTR smart colon */
function getRegistrationInvitesTable(){
    return typeof REGISTRATION_INVITES_TABLE !== "undefined" ? REGISTRATION_INVITES_TABLE : "registration_invites";
}

function normalizeRegistrationCode(code){
    return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function registerStudent(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const lastName = getInputValue("registerLastName").toUpperCase();
    const firstName = getInputValue("registerFirstName");
    const middleInitial = getInputValue("registerMiddleInitial").toUpperCase().charAt(0);
    const studentId = getInputValue("registerStudentId").toUpperCase();
    const registrationCode = normalizeRegistrationCode(getInputValue("registerCode"));
    const email = getInputValue("registerEmail").toLowerCase();
    const contactNumber = getInputValue("registerContact");
    const course = getInputValue("registerCourse");
    const password = getInputValue("registerPassword");
    const confirmPassword = getInputValue("confirmPassword");
    const termsCheck = document.getElementById("termsCheck") ? document.getElementById("termsCheck").checked : false;

    if(!lastName || !firstName || !studentId || !registrationCode || !email || !contactNumber || !course || !password || !confirmPassword){
        showToast("Please complete all required fields, including your registration code.", "error");
        return;
    }

    if(typeof validateSecureStudentPassword === "function" && !validateSecureStudentPassword(password).ok){
        showToast("Password must include at least 8 characters, uppercase, lowercase, and number.", "error");
        return;
    }else if(typeof validateSecureStudentPassword !== "function" && password.length < 8){
        showToast("Password must be at least 8 characters.", "error");
        return;
    }

    if(password !== confirmPassword){
        showToast("Password and confirm password do not match.", "error");
        return;
    }

    if(!termsCheck){
        showToast("Please agree to the Terms of Service and Privacy Policy.", "error");
        return;
    }

    const button = event.target.querySelector("button[type='submit']");
    const originalText = button ? button.innerHTML : "";

    if(button){
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Verifying access...`;
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await supabaseClient.rpc("secure_register_student", {
        p_student_id: studentId,
        p_email: email,
        p_registration_code: registrationCode,
        p_last_name: lastName,
        p_first_name: firstName,
        p_middle_initial: middleInitial,
        p_contact_number: contactNumber,
        p_course: course,
        p_password_hash: passwordHash
    });

    if(button){
        button.disabled = false;
        button.innerHTML = originalText;
    }

    if(error){
        const message = String(error.message || "");
        if(message.toLowerCase().includes("secure_register_student")){
            showToast("Secure registration is not installed yet. Run admin-integration/database/supabase_secure_invite_registration.sql in Supabase first.", "error");
            return;
        }
        showToast(message, "error");
        return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if(!result || result.ok !== true){
        showToast(result?.message || "Registration denied. Please check your Student ID, email, and registration code.", "error");
        return;
    }

    clearStudentSession();
    sessionStorage.setItem("registration_success", "Account created successfully. Please log in.");
    window.location.href = "index.html";
}

/* Removed duplicate DTR smart-colon formatter; handled by dtr-colon-delete-fix.js. */

/* PGMO PATCH: prefill invite registration link values */
document.addEventListener("DOMContentLoaded", () => {
    if(document.body.dataset.page !== "register") return;

    const params = new URLSearchParams(window.location.search);
    const student = params.get("student") || params.get("student_id") || "";
    const email = params.get("email") || "";
    const code = params.get("code") || params.get("registration_code") || "";
    const last = params.get("last") || params.get("last_name") || "";

    const lastNameInput = document.getElementById("registerLastName");
    const studentInput = document.getElementById("registerStudentId");
    const emailInput = document.getElementById("registerEmail");
    const codeInput = document.getElementById("registerCode");

    if(last && lastNameInput) lastNameInput.value = last.toUpperCase();
    if(student && studentInput) studentInput.value = student.toUpperCase();
    if(email && emailInput) emailInput.value = email.toLowerCase();
    if(code && codeInput) codeInput.value = normalizeRegistrationCode(code);
});


/* PGMO PATCH: student school field + school-aware profile save */
(function extendStudentSessionForSchool(){
    if(typeof STUDENT_SESSION_KEYS !== "undefined" && !STUDENT_SESSION_KEYS.includes("ojt_student_school")){
        STUDENT_SESSION_KEYS.push("ojt_student_school");
    }
})();

const __originalSetStudentSessionForSchool = typeof setStudentSession === "function" ? setStudentSession : null;
setStudentSession = function(account){
    if(__originalSetStudentSessionForSchool){
        __originalSetStudentSessionForSchool(account);
    }
    sessionStorage.setItem("ojt_student_school", account.school || account.school_name || "");
};

const __originalGetStudentForSchool = typeof getStudent === "function" ? getStudent : null;
getStudent = function(){
    const student = __originalGetStudentForSchool ? __originalGetStudentForSchool() : {};
    student.school = sessionStorage.getItem("ojt_student_school") || "";
    return student;
};

function loadProfileForm(){
    const student = getStudent();
    const computedName = formatStudentFullName(student.lastName, student.firstName, student.middleInitial);
    const finalName = computedName && computedName.includes(",") ? computedName : (student.name || computedName);

    const fields = {
        profileStudentIdInput: student.id,
        profileLastNameInput: student.lastName,
        profileFirstNameInput: student.firstName,
        profileMiddleInitialInput: student.middleInitial,
        profileSchoolInput: student.school,
        profileCourseInput: student.course,
        profileOfficeInput: student.office,
        profileEmailInput: student.email,
        profilePhoneInput: student.phone,
        profileNameInput: finalName
    };

    Object.entries(fields).forEach(([id,value]) => {
        const input = document.getElementById(id);
        if(input) input.value = value || "";
    });

    applyProfilePicture(student.profilePictureUrl);

    const profileFile = document.getElementById("profilePictureInput");
    const profileFileName = document.getElementById("profilePictureFileName");

    if(profileFile && profileFileName && !profileFile.dataset.profileListenerReady){
        profileFile.dataset.profileListenerReady = "true";
        profileFile.addEventListener("change", () => {
            if(profileFile.files && profileFile.files.length){
                profileFileName.textContent = profileFile.files[0].name;
                const previewUrl = URL.createObjectURL(profileFile.files[0]);
                applyProfilePicture(previewUrl);
            }else{
                profileFileName.textContent = "JPG, PNG, or WEBP only";
                applyProfilePicture(student.profilePictureUrl);
            }
        });
    }
}

async function saveStudentProfile(event){
    event.preventDefault();

    if(!initSupabase()) return;

    const current = getStudent();
    const oldStudentId = current.id;

    const newStudentId = getInputValue("profileStudentIdInput").toUpperCase();
    const newEmail = getInputValue("profileEmailInput").toLowerCase();
    const newPhone = getInputValue("profilePhoneInput");
    const newSchool = getInputValue("profileSchoolInput");
    const newCourse = getInputValue("profileCourseInput");
    const profilePictureInput = document.getElementById("profilePictureInput");

    if(!newStudentId || !newEmail || !newPhone || !newSchool || !newCourse){
        showToast("Please complete Student ID, School, Email, Contact Number, and Course.", "error");
        return;
    }

    const button = document.getElementById("saveProfileButton");
    const originalText = button ? button.innerHTML : "Save Profile";

    if(button){
        button.disabled = true;
        button.innerHTML = "Saving...";
    }

    let profilePictureUrl = current.profilePictureUrl || "";
    let profilePicturePath = current.profilePicturePath || "";

    if(profilePictureInput && profilePictureInput.files && profilePictureInput.files.length){
        const file = profilePictureInput.files[0];
        const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
        const allowed = ["jpg","jpeg","png","webp"];

        if(!allowed.includes(ext)){
            if(button){ button.disabled = false; button.innerHTML = originalText; }
            showToast("Profile picture must be JPG, PNG, or WEBP.", "error");
            return;
        }

        const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        profilePicturePath = `profiles/${newStudentId}/${Date.now()}_${safeName}`;

        const { error: picError } = await supabaseClient.storage.from(OJT_STORAGE_BUCKET).upload(profilePicturePath, file, {
            cacheControl: "3600",
            upsert: true
        });

        if(picError){
            if(button){ button.disabled = false; button.innerHTML = originalText; }
            showToast("Profile picture upload failed: " + picError.message, "error");
            return;
        }

        const { data: picUrlData } = supabaseClient.storage.from(OJT_STORAGE_BUCKET).getPublicUrl(profilePicturePath);
        profilePictureUrl = picUrlData.publicUrl;
    }

    const payload = {
        student_id: newStudentId,
        email: newEmail,
        phone: newPhone,
        contact_number: newPhone,
        school: newSchool,
        course: newCourse,
        profile_picture_url: profilePictureUrl,
        profile_picture_path: profilePicturePath,
        updated_at: new Date().toISOString()
    };

    let updateQuery = supabaseClient.from(getStudentAccountsTable()).update(payload);

    if(current.accountId){
        updateQuery = updateQuery.eq("id", current.accountId);
    }else{
        updateQuery = updateQuery.eq("student_id", oldStudentId);
    }

    const { data: updatedRows, error: updateError } = await updateQuery.select().limit(1);

    if(updateError){
        if(button){ button.disabled = false; button.innerHTML = originalText; }
        showToast(updateError.message + " Run the database patch if the school column is missing.", "error");
        return;
    }

    if(updatedRows && updatedRows.length){
        setStudentSession(updatedRows[0]);
    }else{
        sessionStorage.setItem("ojt_student_id", newStudentId);
        sessionStorage.setItem("ojt_student_email", newEmail);
        sessionStorage.setItem("ojt_student_phone", newPhone);
        sessionStorage.setItem("ojt_student_school", newSchool);
        sessionStorage.setItem("ojt_student_course", newCourse);
        sessionStorage.setItem("ojt_student_profile_picture_url", profilePictureUrl);
        sessionStorage.setItem("ojt_student_profile_picture_path", profilePicturePath);
    }

    setStudentHeader();
    loadProfileForm();

    if(button){
        button.disabled = false;
        button.innerHTML = originalText;
    }

    showToast("Profile updated successfully.");
}

function setStudentHeader(){
    const student = getStudent();
    const computedName = formatStudentFullName(student.lastName, student.firstName, student.middleInitial);
    const displayName = computedName && computedName.includes(",") ? computedName : (student.name || "Student");
    const schoolLabel = student.school || "School not set";

    const values = {
        studentDetailsDisplay: `${student.id || "-"} · ${schoolLabel} · ${student.course || "-"} · ${student.office || "-"}`,
        miniStudentName: displayName,
        miniStudentId: student.id || "STU-000",
        profileName: displayName,
        profileMeta: `${schoolLabel} · ${student.course || "-"} · ${student.office || "-"}`,
        profileStudentId: student.id || "-",
        profileEmail: student.email || "-",
        profileCourse: student.course || "-",
        profileOffice: student.office || "-",
        profilePhone: student.phone || "-"
    };

    Object.entries(values).forEach(([id,value]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    });
    renderSidebarProfilePicture();
}


/* =========================================================
   STUDENT FRONT-END LIVE PATCH
   - Polling-based live notifications, no Supabase realtime channels.
   - Clickable notification cards/dropdown.
   - Silent dashboard/document refreshes.
   ========================================================= */
(function(){
    const LIVE_NOTIFICATION_MS = 8000;
    const LIVE_DOCUMENT_MS = 12000;
    const LIVE_ACCOUNT_MS = 25000;
    let liveNotificationTimer = null;
    let liveDocumentTimer = null;
    let liveAccountTimer = null;
    let liveDropdownOpen = false;
    let lastUnreadCount = Number(sessionStorage.getItem("student_live_unread_count") || 0);
    let lastTopIds = (sessionStorage.getItem("student_live_top_ids") || "").split(",").filter(Boolean);

    function isStudentPortalPage(){
        const page = document.body?.dataset?.page || "";
        return !["login", "register", "secure-register"].includes(page);
    }

    function currentPage(){
        return document.body?.dataset?.page || "";
    }

    function liveCanUseSupabase(){
        return typeof initSupabase === "function" && initSupabase() && typeof supabaseClient !== "undefined" && supabaseClient;
    }

    function safe(value){
        if(typeof notificationSafeText === "function") return notificationSafeText(value);
        return String(value ?? "")
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;")
            .replaceAll('"',"&quot;")
            .replaceAll("'","&#039;");
    }

    function iconFor(item){
        const text = `${item.title || ""} ${item.message || ""} ${item.type || ""}`.toLowerCase();
        if(text.includes("approve") || text.includes("ready") || text.includes("success")) return "fa-circle-check";
        if(text.includes("reject") || text.includes("return") || text.includes("error")) return "fa-circle-xmark";
        if(text.includes("dtr")) return "fa-calendar-check";
        if(text.includes("certificate")) return "fa-award";
        if(text.includes("id")) return "fa-id-card";
        if(text.includes("document") || text.includes("upload")) return "fa-file-lines";
        return "fa-bell";
    }

    function targetFor(item){
        const text = `${item.title || ""} ${item.message || ""} ${item.type || ""}`.toLowerCase();
        if(text.includes("dtr")) return "dtr.html";
        if(text.includes("certificate")) return "documents.html";
        if(text.includes("id request") || text.includes("ojt id") || text.includes("id")) return "id-request.html";
        if(text.includes("document") || text.includes("upload") || text.includes("requirement")) return "submissions.html";
        return "notifications.html";
    }

    function createLiveShell(){
        const topActions = document.querySelector(".top-actions");
        const bell = document.querySelector(".top-actions .top-icon");
        if(!topActions || !bell || document.getElementById("liveNotificationDropdown")) return;

        bell.classList.add("live-bell-button");
        bell.setAttribute("role", "button");
        bell.setAttribute("aria-label", "Open notifications");

        const dropdown = document.createElement("div");
        dropdown.id = "liveNotificationDropdown";
        dropdown.className = "live-notification-dropdown";
        dropdown.innerHTML = `
            <div class="live-dropdown-head">
                <strong>Notifications</strong>
                <small id="liveDropdownCount">Live</small>
            </div>
            <div id="liveNotificationPreview" class="live-notification-preview">
                <div class="notification-loading-state notification-loading-compact">
                    <div class="notification-loading-logo"><i class="fa fa-bell"></i></div>
                    <p>Checking notifications...</p>
                </div>
            </div>
            <div class="live-dropdown-foot">
                <a href="notifications.html">View all notifications</a>
            </div>
        `;
        topActions.appendChild(dropdown);

        bell.addEventListener("click", function(event){
            event.preventDefault();
            event.stopPropagation();
            liveDropdownOpen = !liveDropdownOpen;
            document.body.classList.toggle("live-notification-open", liveDropdownOpen);
            if(liveDropdownOpen) fetchAndPaintNotifications({showToastForNew:false});
        });

        dropdown.addEventListener("click", function(event){
            event.stopPropagation();
        });

        document.addEventListener("click", function(){
            liveDropdownOpen = false;
            document.body.classList.remove("live-notification-open");
        });
    }

    function setLiveBadge(count){
        const normalized = Math.max(0, Number(count || 0));
        const badge = document.getElementById("notificationBadge");
        if(badge){
            badge.textContent = normalized;
            badge.style.display = normalized > 0 ? "inline-flex" : "none";
            badge.classList.toggle("badge-pulse", normalized > 0);
        }
        const dot = document.getElementById("topNotificationDot");
        if(dot){
            dot.style.display = normalized > 0 ? "block" : "none";
            dot.classList.toggle("dot-pulse", normalized > 0);
        }
        const countLabel = document.getElementById("liveDropdownCount");
        if(countLabel){
            countLabel.textContent = normalized ? `${normalized} unread` : "All clear";
        }
    }

    function renderTopNotificationPreview(items){
        const preview = document.getElementById("liveNotificationPreview");
        if(!preview) return;
        if(!items || !items.length){
            preview.innerHTML = `<div class="live-mini-empty"><i class="fa fa-bell-slash"></i><span>No notifications yet</span></div>`;
            return;
        }
        preview.innerHTML = items.slice(0, 5).map(item => {
            const id = safe(item.id || "");
            const unread = !item.is_read ? "unread" : "read";
            const target = targetFor(item);
            return `
                <button type="button" class="live-mini-notification ${unread}" data-notification-id="${id}" data-target="${target}">
                    <span class="live-mini-icon"><i class="fa ${iconFor(item)}"></i></span>
                    <span class="live-mini-text">
                        <strong>${safe(item.title || "Notification")}</strong>
                        <small>${safe(item.message || "")}</small>
                    </span>
                </button>
            `;
        }).join("");
    }

    function renderNotificationLoadingPage(){
        const list = document.getElementById("notificationsList");
        if(!list) return;
        list.dataset.notificationsLoaded = "0";
        list.innerHTML = `
            <div class="notification-loading-state pgmo-notification-circle-only" role="status" aria-live="polite">
                <div class="notification-loading-logo" aria-hidden="true"><i class="fa fa-bell"></i></div>
                <h5>Loading notifications...</h5>
                <p>Checking the latest admin updates.</p>
            </div>`;
    }

    function renderNotificationErrorPage(message){
        const list = document.getElementById("notificationsList");
        if(!list) return;
        list.dataset.notificationsLoaded = "1";
        list.innerHTML = `
            <div class="empty-state animated-empty">
                <i class="fa fa-triangle-exclamation"></i>
                <h5>Could not load notifications</h5>
                <p>${safe(message || "Please refresh the page and try again.")}</p>
            </div>`;
    }

    function renderNotificationPage(items){
        const list = document.getElementById("notificationsList");
        if(!list) return;
        list.dataset.notificationsLoaded = "1";
        if(!items || !items.length){
            list.innerHTML = `
                <div class="empty-state animated-empty">
                    <i class="fa fa-bell"></i>
                    <h5>No notifications yet</h5>
                    <p>Admin updates will appear here automatically.</p>
                </div>`;
            return;
        }
        list.innerHTML = items.map(item => {
            const id = safe(item.id || "");
            const target = targetFor(item);
            const unread = item.is_read ? "read" : "unread";
            const type = safe(item.type || "info");
            const created = item.created_at ? new Date(item.created_at).toLocaleString() : "";
            return `
                <button type="button" class="notification-card clickable-notification ${unread} ${type}" data-notification-id="${id}" data-target="${target}">
                    <div class="notification-icon"><i class="fa ${iconFor(item)}"></i></div>
                    <div class="notification-content">
                        <div class="notification-title-row">
                            <strong>${safe(item.title || "Notification")}</strong>
                            ${!item.is_read ? `<span class="new-pill">New</span>` : ""}
                        </div>
                        <p>${safe(item.message || "")}</p>
                        <small>${created}</small>
                    </div>
                    <i class="fa fa-chevron-right notification-arrow"></i>
                </button>
            `;
        }).join("");
    }

    async function markNotificationRead(id){
        if(!id || !liveCanUseSupabase()) return;
        const student = getStudent();
        if(!student.id) return;
        await supabaseClient
            .from(getStudentNotificationsTable())
            .update({ is_read:true })
            .eq("id", id)
            .eq("student_id", student.id);
    }

    async function handleNotificationClick(button){
        const id = button.getAttribute("data-notification-id");
        const target = button.getAttribute("data-target") || "notifications.html";
        button.classList.add("opening");
        await markNotificationRead(id);
        await fetchAndPaintNotifications({showToastForNew:false});
        setTimeout(() => {
            window.location.href = target;
        }, 120);
    }

    async function fetchAndPaintNotifications(options = {}){
        const { showToastForNew = true } = options;
        const pageIsNotifications = currentPage() === "notifications";
        const notificationList = document.getElementById("notificationsList");
        if(pageIsNotifications && notificationList && notificationList.dataset.notificationsLoaded !== "1") renderNotificationLoadingPage();
        if(!isStudentPortalPage() || !liveCanUseSupabase()){
            if(pageIsNotifications) renderNotificationErrorPage("Supabase is not connected.");
            return [];
        }
        const student = getStudent();
        if(!student.id){
            if(pageIsNotifications) renderNotificationErrorPage("Student session was not found. Please sign in again.");
            return [];
        }

        const { data, error } = await supabaseClient
            .from(getStudentNotificationsTable())
            .select("*")
            .eq("student_id", student.id)
            .order("created_at", { ascending:false })
            .limit(20);

        if(error){
            console.warn("Live notification refresh failed:", error.message);
            if(pageIsNotifications) renderNotificationErrorPage(error.message);
            return [];
        }

        const items = data || [];
        const unread = items.filter(item => !item.is_read).length;
        const topIds = items.slice(0, 5).map(item => String(item.id));

        setLiveBadge(unread);
        renderTopNotificationPreview(items);
        // Notifications page rendering is handled by the stable final loader below.
        if(false && currentPage() === "notifications") renderNotificationPage(items);

        if(showToastForNew && unread > lastUnreadCount){
            const newest = items.find(item => !item.is_read);
            if(newest && !lastTopIds.includes(String(newest.id))){
                const msg = newest.title ? `${newest.title}: ${newest.message || ""}` : (newest.message || "You have a new notification.");
                showToast(safe(msg), "success");
                const bell = document.querySelector(".top-actions .top-icon");
                if(bell){
                    bell.classList.remove("bell-shake");
                    void bell.offsetWidth;
                    bell.classList.add("bell-shake");
                }
            }
        }

        lastUnreadCount = unread;
        lastTopIds = topIds;
        sessionStorage.setItem("student_live_unread_count", String(unread));
        sessionStorage.setItem("student_live_top_ids", topIds.join(","));
        return items;
    }

    async function silentRefreshDocuments(){
        if(!isStudentPortalPage() || !liveCanUseSupabase()) return;
        if(typeof OJT_UPLOADS_TABLE === "undefined") return;
        const student = getStudent();
        if(!student.id) return;

        const { data, error } = await supabaseClient
            .from(OJT_UPLOADS_TABLE)
            .select("*")
            .eq("student_id", student.id)
            .order("created_at", { ascending:false });
        if(error) return;
        const before = JSON.stringify((currentUploads || []).map(item => `${item.id || item.file_path}:${item.status}:${item.admin_remarks || ""}`));
        currentUploads = data || [];
        const after = JSON.stringify(currentUploads.map(item => `${item.id || item.file_path}:${item.status}:${item.admin_remarks || ""}`));
        if(typeof updateStats === "function") updateStats();
        if(["dashboard", "submissions", "documents"].includes(currentPage()) && typeof renderStudentFiles === "function") renderStudentFiles();
        if(before !== after){
            document.body.classList.add("live-data-refreshed");
            setTimeout(() => document.body.classList.remove("live-data-refreshed"), 800);
        }
    }

    async function silentRefreshAccount(){
        if(!isStudentPortalPage()) return;
        if(typeof refreshCurrentStudentAccount !== "function") return;
        const account = await refreshCurrentStudentAccount();
        if(account && typeof setStudentHeader === "function") setStudentHeader();
    }

    function bindLiveNotificationClicks(){
        document.addEventListener("click", function(event){
            const button = event.target.closest(".clickable-notification, .live-mini-notification");
            if(!button) return;

            const isMiniDropdownItem = button.classList.contains("live-mini-notification");
            const dropdownIsOpen = document.body.classList.contains("live-notification-open");
            if(isMiniDropdownItem && !dropdownIsOpen){
                event.preventDefault();
                event.stopPropagation();
                if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            handleNotificationClick(button);
        });
    }

    function addPageTransition(){
        /* PGMO PATCH: no flicker navigation.
           Do not intercept normal page links and do not add a leaving overlay/animation. */
        document.body.classList.remove("student-page-leaving");
        document.body.classList.add("student-page-ready");
    }

    function enhanceButtonsAndCards(){
        document.querySelectorAll(".dash-card, .file-row, .requirement-item, .small-stat, .portal-welcome-card").forEach((el, index) => {
            if(el.dataset.polished === "1") return;
            el.dataset.polished = "1";
            el.style.setProperty("--stagger", `${Math.min(index, 10) * 45}ms`);
            el.classList.add("student-polish-card");
        });
    }

    function initLiveFrontendPatch(){
        if(!isStudentPortalPage()) return;
        createLiveShell();
        bindLiveNotificationClicks();
        addPageTransition();
        enhanceButtonsAndCards();

        // PERFORMANCE FIX: do not start background polling on student pages.
        // On some devices, repeated Supabase requests + DOM repainting can freeze the page.
        // Load once only, and only for pages that need it.
        const page = currentPage();
        if(page === "notifications"){
            fetchAndPaintNotifications({showToastForNew:false});
        }else{
            // Keep the top badge from showing a false 0 without forcing a request on every page.
            setLiveBadge(Number(sessionStorage.getItem("student_live_unread_count") || 0));
        }

        if(["submissions", "documents"].includes(page)){
            silentRefreshDocuments();
        }

        if(page === "profile"){
            silentRefreshAccount();
        }

        clearInterval(liveNotificationTimer);
        clearInterval(liveDocumentTimer);
        clearInterval(liveAccountTimer);
    }

    window.loadNotificationCount = async function(){
        await fetchAndPaintNotifications({showToastForNew:false});
    };

    window.loadNotificationsPage = async function(){
        await fetchAndPaintNotifications({showToastForNew:false});
    };

    window.renderNotifications = function(){
        fetchAndPaintNotifications({showToastForNew:false});
    };

    window.markAllNotificationsRead = async function(){
        if(!liveCanUseSupabase()) return;
        const student = getStudent();
        if(!student.id) return;
        await supabaseClient
            .from(getStudentNotificationsTable())
            .update({ is_read:true })
            .eq("student_id", student.id)
            .eq("is_read", false);
        await fetchAndPaintNotifications({showToastForNew:false});
        showToast("All notifications marked as read.");
    };

    document.addEventListener("DOMContentLoaded", initLiveFrontendPatch);
})();


/* PGMO PATCH 2026-06-26: secure registration, last-name invite, click guide, and 8-hour Remember Me */
(function(){
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const REMEMBER_ENABLED_KEY = "ojt_student_remember_enabled";
    const SESSION_EXPIRES_KEY = "ojt_student_session_expires_at";
    const LAST_ACTIVITY_KEY = "ojt_student_last_activity";

    function allStudentSessionKeys(){
        const keys = Array.isArray(STUDENT_SESSION_KEYS) ? [...STUDENT_SESSION_KEYS] : [];
        [LAST_ACTIVITY_KEY, SESSION_EXPIRES_KEY, REMEMBER_ENABLED_KEY].forEach(key => {
            if(!keys.includes(key)) keys.push(key);
        });
        return keys;
    }

    function rememberIsValid(){
        const enabled = localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
        const expiresAt = Number(localStorage.getItem(SESSION_EXPIRES_KEY) || 0);
        return enabled && expiresAt && Date.now() < expiresAt && localStorage.getItem("ojt_student_logged_in") === "true";
    }

    function copyStorage(from, to){
        allStudentSessionKeys().forEach(key => {
            const value = from.getItem(key);
            if(value !== null && value !== undefined){
                to.setItem(key, value);
            }
        });
    }

    function clearRememberedStudentSession(){
        allStudentSessionKeys().forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(REMEMBER_ENABLED_KEY);
        localStorage.removeItem(SESSION_EXPIRES_KEY);
        localStorage.removeItem(LAST_ACTIVITY_KEY);
    }

    function hydrateRememberedSession(){
        if(!rememberIsValid()) return false;
        copyStorage(localStorage, sessionStorage);
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, "true");
        return true;
    }

    const previousClearStudentSession = typeof clearStudentSession === "function" ? clearStudentSession : null;
    clearStudentSession = function(){
        const onLoginPage = document.body && document.body.dataset && document.body.dataset.page === "login";
        const keepValidRemember = onLoginPage && rememberIsValid() && window.__pgmoForceStudentLogout !== true;

        allStudentSessionKeys().forEach(key => sessionStorage.removeItem(key));
        sessionStorage.removeItem("student_session_expired");
        sessionStorage.removeItem("registration_success");

        if(!keepValidRemember){
            clearRememberedStudentSession();
            if(previousClearStudentSession){
                try{ previousClearStudentSession(); }catch(error){}
            }
        }
    };

    const previousSetStudentSession = typeof setStudentSession === "function" ? setStudentSession : null;
    setStudentSession = function(account){
        if(previousSetStudentSession){
            previousSetStudentSession(account);
        }

        const explicitMode = window.__pgmoStudentRememberMode === "remember" || window.__pgmoStudentRememberMode === "session";
        const rememberMode = window.__pgmoStudentRememberMode === "remember" || (!explicitMode && localStorage.getItem(REMEMBER_ENABLED_KEY) === "true");
        const existingExpiresAt = Number(sessionStorage.getItem(SESSION_EXPIRES_KEY) || localStorage.getItem(SESSION_EXPIRES_KEY) || 0);
        const expiresAt = explicitMode || !existingExpiresAt ? Date.now() + EIGHT_HOURS_MS : existingExpiresAt;

        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        sessionStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, rememberMode ? "true" : "false");

        if(rememberMode){
            copyStorage(sessionStorage, localStorage);
            localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
            localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }else{
            clearRememberedStudentSession();
        }
    };

    isLoggedIn = function(){
        if(sessionStorage.getItem("ojt_student_logged_in") === "true") return true;
        return hydrateRememberedSession();
    };

    requireActiveStudentSession = function(){
        hydrateRememberedSession();

        if(sessionStorage.getItem("ojt_student_logged_in") !== "true"){
            return false;
        }

        let expiresAt = Number(sessionStorage.getItem(SESSION_EXPIRES_KEY) || 0);
        if(!expiresAt){
            expiresAt = Date.now() + EIGHT_HOURS_MS;
            sessionStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
            if(localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"){
                localStorage.setItem(SESSION_EXPIRES_KEY, String(expiresAt));
            }
        }

        if(Date.now() > expiresAt){
            window.__pgmoForceStudentLogout = true;
            clearStudentSession();
            sessionStorage.setItem("student_session_expired", "Your 8-hour student login expired. Please log in again.");
            return false;
        }

        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        if(localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"){
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }
        return true;
    };

    startStudentAutoLogout = function(){
        if(!requireActiveStudentSession()) return;

        const updateActivity = () => {
            if(sessionStorage.getItem("ojt_student_logged_in") === "true"){
                sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
                if(localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"){
                    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
                }
            }
        };

        ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
            document.addEventListener(eventName, updateActivity, {passive:true});
        });

        clearInterval(window.__pgmoStudentAutoLogoutTimer);
        window.__pgmoStudentAutoLogoutTimer = setInterval(() => {
            if(!requireActiveStudentSession()){
                window.location.href = "index.html";
            }
        }, 30000);
    };

    const previousLogoutStudent = typeof logoutStudent === "function" ? logoutStudent : null;
    logoutStudent = function(){
        window.__pgmoForceStudentLogout = true;
        clearStudentSession();
        if(previousLogoutStudent){
            window.location.href = "index.html";
        }else{
            window.location.href = "index.html";
        }
    };

    function normalizeContactNumber(value){
        return String(value || "").replace(/\D/g, "").slice(0, 11);
    }

    function bindContactNumberLimit(){
        const input = document.getElementById("registerContact");
        if(!input || input.dataset.pgmoContactLimitBound === "1") return;
        input.dataset.pgmoContactLimitBound = "1";
        input.type = "tel";
        input.inputMode = "numeric";
        input.maxLength = 11;
        input.pattern = "[0-9]{11}";
        input.autocomplete = "tel";
        const clean = () => { input.value = normalizeContactNumber(input.value); };
        input.addEventListener("input", clean);
        input.addEventListener("paste", () => setTimeout(clean, 0));
        clean();
    }

    function passwordRules(password){
        return {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password)
        };
    }

    window.validateSecureStudentPassword = function(password){
        const rules = passwordRules(String(password || ""));
        const ok = Object.values(rules).every(Boolean);
        return { ok, rules };
    };

    function securePasswordMessage(rules){
        const missing = [];
        if(!rules.length) missing.push("at least 8 characters");
        if(!rules.uppercase) missing.push("one uppercase letter");
        if(!rules.lowercase) missing.push("one lowercase letter");
        if(!rules.number) missing.push("one number");
        return "Password must include " + missing.join(", ") + ".";
    }

    function ensurePasswordGuide(){
        const passwordInput = document.getElementById("registerPassword");
        if(!passwordInput || document.getElementById("passwordSecurityGuide")) return;

        const guide = document.createElement("div");
        guide.id = "passwordSecurityGuide";
        guide.className = "password-security-guide";
        guide.innerHTML = `
            <div class="password-security-tooltip">
                <strong>Secure password required</strong>
                <div class="password-rule-list">
                    <span data-rule="length">8+ characters</span>
                    <span data-rule="uppercase">Uppercase letter</span>
                    <span data-rule="lowercase">Lowercase letter</span>
                    <span data-rule="number">Number</span>
                </div>
            </div>
        `;

        const inputBox = passwordInput.closest(".input-box");
        if(inputBox && inputBox.parentNode){
            inputBox.parentNode.insertBefore(guide, inputBox.nextSibling);
        }

        function paint(){
            const result = validateSecureStudentPassword(passwordInput.value || "");
            Object.entries(result.rules).forEach(([key, valid]) => {
                const item = guide.querySelector(`[data-rule="${key}"]`);
                if(item) item.classList.toggle("valid", !!valid);
            });
        }

        const openGuide = () => {
            guide.classList.add("is-open");
            paint();
        };

        const closeGuide = event => {
            if(guide.contains(event.target) || passwordInput.contains(event.target)) return;
            guide.classList.remove("is-open");
        };

        passwordInput.addEventListener("input", paint);
        passwordInput.addEventListener("focus", openGuide);
        passwordInput.addEventListener("click", openGuide);
        guide.addEventListener("click", event => event.stopPropagation());
        document.addEventListener("click", closeGuide);
        document.addEventListener("keydown", event => {
            if(event.key === "Escape") guide.classList.remove("is-open");
        });
        paint();
    }

    function bindStudentIdGuideClick(){
        const input = document.getElementById("registerStudentId");
        const help = document.querySelector(".student-id-help");
        if(!input || !help || help.dataset.clickGuideBound === "1") return;
        help.dataset.clickGuideBound = "1";

        const openGuide = () => help.classList.add("is-open");
        const closeGuide = event => {
            if(help.contains(event.target) || input.contains(event.target)) return;
            help.classList.remove("is-open");
        };

        input.addEventListener("focus", openGuide);
        input.addEventListener("click", openGuide);
        help.addEventListener("click", event => {
            event.stopPropagation();
            help.classList.toggle("is-open");
        });
        document.addEventListener("click", closeGuide);
        document.addEventListener("keydown", event => {
            if(event.key === "Escape") help.classList.remove("is-open");
        });
    }

    loginStudent = async function(event){
        event.preventDefault();

        if(!initSupabase()) return;

        const loginInput = document.getElementById("loginId").value.trim();
        const password = document.getElementById("loginPassword").value.trim();
        const remember = document.getElementById("rememberMe")?.checked === true;

        if(!loginInput || !password){
            showToast("Please enter your Student ID or Email and password.", "error");
            return;
        }

        const button = event.target.querySelector("button[type='submit']");
        const originalText = button ? button.innerHTML : "";
        if(button){
            button.disabled = true;
            button.innerHTML = "Signing in...";
        }

        const table = getStudentAccountsTable();
        let query = supabaseClient.from(table).select("*").limit(1);

        if(loginInput.includes("@")){
            query = query.eq("email", loginInput.toLowerCase());
        }else{
            query = query.eq("student_id", loginInput.toUpperCase());
        }

        const { data, error } = await query;

        if(button){
            button.disabled = false;
            button.innerHTML = originalText;
        }

        if(error){
            showToast(error.message, "error");
            return;
        }

        if(!data || !data.length){
            showToast("Account not found. Please register first.", "error");
            return;
        }

        const account = data[0];
        const passwordHash = await hashPassword(password);

        if(account.password_hash !== passwordHash){
            showToast("Incorrect password.", "error");
            return;
        }

        if(account.status && account.status !== "Active"){
            showToast("Your account is not active. Please contact your coordinator.", "error");
            return;
        }

        window.__pgmoStudentRememberMode = remember ? "remember" : "session";
        setStudentSession(account);
        window.__pgmoStudentRememberMode = "";

        await supabaseClient
            .from(table)
            .update({last_login_at:new Date().toISOString()})
            .eq("id", account.id);

        if(window.pgmoStartStudentLoginAnimation){
            window.pgmoStartStudentLoginAnimation("dashboard.html");
            return;
        }

        window.location.href = "dashboard.html";
    };

    registerStudent = async function(event){
        event.preventDefault();

        if(!initSupabase()) return;

        const lastName = getInputValue("registerLastName").toUpperCase();
        const firstName = getInputValue("registerFirstName");
        const middleInitial = getInputValue("registerMiddleInitial").toUpperCase().charAt(0);
        const studentId = getInputValue("registerStudentId").toUpperCase();
        const registrationCode = normalizeRegistrationCode(getInputValue("registerCode"));
        const email = getInputValue("registerEmail").toLowerCase();
        const contactNumber = normalizeContactNumber(getInputValue("registerContact"));
        const contactInput = document.getElementById("registerContact");
        if(contactInput) contactInput.value = contactNumber;
        const course = getInputValue("registerCourse");
        const password = getInputValue("registerPassword");
        const confirmPassword = getInputValue("confirmPassword");
        const termsCheck = document.getElementById("termsCheck") ? document.getElementById("termsCheck").checked : false;

        if(!lastName || !firstName || !studentId || !registrationCode || !email || !contactNumber || !course || !password || !confirmPassword){
            showToast("Please complete all required fields, including your registration code.", "error");
            return;
        }

        if(contactNumber.length !== 11){
            showToast("Contact number must be exactly 11 digits.", "error");
            return;
        }

        const passwordResult = validateSecureStudentPassword(password);
        if(!passwordResult.ok){
            showToast(securePasswordMessage(passwordResult.rules), "error");
            return;
        }

        if(password !== confirmPassword){
            showToast("Password and confirm password do not match.", "error");
            return;
        }

        if(!termsCheck){
            showToast("Please agree to the Terms of Service and Privacy Policy.", "error");
            return;
        }

        const button = event.target.querySelector("button[type='submit']");
        const originalText = button ? button.innerHTML : "";

        if(button){
            button.disabled = true;
            button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Verifying access...`;
        }

        const passwordHash = await hashPassword(password);

        const { data, error } = await supabaseClient.rpc("secure_register_student", {
            p_student_id: studentId,
            p_email: email,
            p_registration_code: registrationCode,
            p_last_name: lastName,
            p_first_name: firstName,
            p_middle_initial: middleInitial,
            p_contact_number: contactNumber,
            p_course: course,
            p_password_hash: passwordHash
        });

        if(button){
            button.disabled = false;
            button.innerHTML = originalText;
        }

        if(error){
            const message = String(error.message || "");
            if(message.toLowerCase().includes("secure_register_student")){
                showToast("Secure registration is not installed yet. Run admin-integration/database/supabase_secure_invite_registration.sql in Supabase first.", "error");
                return;
            }
            showToast(message, "error");
            return;
        }

        const result = Array.isArray(data) ? data[0] : data;

        if(!result || result.ok !== true){
            showToast(result?.message || "Registration denied. Please check your last name, Student ID, email, and registration code.", "error");
            return;
        }

        window.__pgmoForceStudentLogout = true;
        clearStudentSession();
        window.__pgmoForceStudentLogout = false;
        sessionStorage.setItem("registration_success", "Account created successfully. Please log in.");
        window.location.href = "index.html";
    };

    document.addEventListener("DOMContentLoaded", () => {
        if(document.body.dataset.page === "register"){
            bindStudentIdGuideClick();
            ensurePasswordGuide();
            bindContactNumberLimit();
        }

        if(document.body.dataset.page === "login"){
            if(hydrateRememberedSession()){
                window.location.href = "dashboard.html";
            }
        }
    });
})();


/* PGMO PATCH 2026-06-26: mobile cards, persistent profile picture, and smooth notification dropdown */
(function(){
    function pgmoStudentSafe(value){
        if(typeof notificationSafeText === "function") return notificationSafeText(value);
        return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    }

    function getProfileUrl(){
        try{
            const student = typeof getStudent === "function" ? getStudent() : {};
            return student.profilePictureUrl || sessionStorage.getItem("ojt_student_profile_picture_url") || localStorage.getItem("ojt_student_profile_picture_url") || "";
        }catch(error){
            return sessionStorage.getItem("ojt_student_profile_picture_url") || "";
        }
    }

    function paintAvatarElement(el, url){
        if(!el) return;
        if(url){
            el.innerHTML = `<img src="${pgmoStudentSafe(url)}" alt="Profile Picture">`;
            el.classList.add("has-profile-image", "has-image");
        }else{
            el.innerHTML = `<i class="fa fa-user"></i>`;
            el.classList.remove("has-profile-image", "has-image");
        }
    }

    window.renderSidebarProfilePicture = function(){
        const url = getProfileUrl();
        document.querySelectorAll(".mini-avatar, .top-avatar, #profilePicturePreview").forEach(el => paintAvatarElement(el, url));
    };

    const originalApplyProfilePicture = typeof applyProfilePicture === "function" ? applyProfilePicture : null;
    window.applyProfilePicture = function(url){
        if(originalApplyProfilePicture) originalApplyProfilePicture(url);
        document.querySelectorAll(".mini-avatar, .top-avatar, #profilePicturePreview").forEach(el => paintAvatarElement(el, url || getProfileUrl()));
    };

    const originalSetStudentHeader = typeof setStudentHeader === "function" ? setStudentHeader : null;
    window.setStudentHeader = function(){
        if(originalSetStudentHeader) originalSetStudentHeader();
        renderSidebarProfilePicture();
        bindTopAvatarProfileAction();
    };

    function bindTopAvatarProfileAction(){
        document.querySelectorAll(".top-avatar").forEach(avatar => {
            if(avatar.dataset.profileBound === "1") return;
            avatar.dataset.profileBound = "1";
            avatar.setAttribute("role", "button");
            avatar.setAttribute("tabindex", "0");
            avatar.setAttribute("title", "View or change profile picture");
            avatar.addEventListener("click", () => {
                if((document.body.dataset.page || "") !== "profile") window.location.href = "profile.html";
            });
            avatar.addEventListener("keydown", event => {
                if(event.key === "Enter" || event.key === " "){
                    event.preventDefault();
                    if((document.body.dataset.page || "") !== "profile") window.location.href = "profile.html";
                }
            });
        });
    }

    function ensureNotificationDropdownBehavior(){
        /* PGMO FIX: notification bell is handled by createLiveShell and student-topbar-overlay-fix.js.
           This avoids duplicate document-capture toggles that made the bell work only sometimes. */
    }

    function makeNotificationFooterCardOnly(){
        const footer = document.querySelector("#liveNotificationDropdown .live-dropdown-foot");
        if(footer && footer.dataset.cardOnly !== "1"){
            footer.dataset.cardOnly = "1";
            footer.innerHTML = `<span><i class="fa fa-hand-pointer"></i> Tap a notification card to open it</span>`;
        }
    }

    document.addEventListener("DOMContentLoaded", function(){
        renderSidebarProfilePicture();
        bindTopAvatarProfileAction();
        ensureNotificationDropdownBehavior();
        setTimeout(() => {
            renderSidebarProfilePicture();
            bindTopAvatarProfileAction();
            makeNotificationFooterCardOnly();
        }, 250);
        // PERFORMANCE FIX: removed the 5-second sidebar/avatar repaint interval.
        // The avatar/header is updated when session/profile data changes instead.
    });
})();


/* PGMO PATCH 2026-06-26: clickable notification dropdown, stable loader, and 11-digit contact limit */
(function(){
    function safeTarget(target){
        const fallback = "notifications.html";
        const value = String(target || fallback).trim();
        return /^[a-z0-9_-]+\.html(#[a-z0-9_-]+)?$/i.test(value) ? value : fallback;
    }

    function cleanContactNumber(value){
        return String(value || "").replace(/\D/g, "").slice(0, 11);
    }

    function bindContactLimiter(){
        const input = document.getElementById("registerContact");
        if(!input || input.dataset.pgmoStrictContactBound === "1") return;
        input.dataset.pgmoStrictContactBound = "1";
        input.type = "tel";
        input.inputMode = "numeric";
        input.maxLength = 11;
        input.pattern = "[0-9]{11}";
        input.placeholder = "ex: 09XXXXXXXXX";
        const clean = () => { input.value = cleanContactNumber(input.value); };
        input.addEventListener("input", clean);
        input.addEventListener("paste", () => setTimeout(clean, 0));
        clean();
    }

    async function markDropdownNotificationRead(id){
        try{
            if(!id || typeof initSupabase !== "function" || !initSupabase() || typeof supabaseClient === "undefined") return;
            const student = typeof getStudent === "function" ? getStudent() : {};
            if(!student || !student.id) return;
            const table = typeof getStudentNotificationsTable === "function" ? getStudentNotificationsTable() : "ojt_notifications";
            await supabaseClient.from(table).update({is_read:true}).eq("id", id).eq("student_id", student.id);
        }catch(error){
            console.warn("Notification read update skipped:", error.message);
        }
    }

    document.addEventListener("click", function(event){
        const button = event.target.closest("#liveNotificationDropdown .live-mini-notification, #notificationsList .clickable-notification");
        if(!button) return;

        const isHiddenDropdownItem = button.closest("#liveNotificationDropdown") && !document.body.classList.contains("live-notification-open");
        if(isHiddenDropdownItem){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const id = button.getAttribute("data-notification-id") || "";
        const target = safeTarget(button.getAttribute("data-target"));
        button.classList.add("opening");

        markDropdownNotificationRead(id).finally(() => {
            document.body.classList.remove("live-notification-open");
            setTimeout(() => { window.location.href = target; }, 80);
        });
    }, true);

    document.addEventListener("DOMContentLoaded", function(){
        bindContactLimiter();
        document.querySelectorAll(".top-actions .top-icon[href='notifications.html']").forEach(bell => {
            bell.setAttribute("href", "#");
            bell.setAttribute("aria-haspopup", "true");
            bell.setAttribute("aria-expanded", "false");
        });
    });
})();


/* PGMO PATCH: Required Student ID guide acknowledgement before registration */
(function(){
    const oldRegisterStudent = typeof registerStudent === "function" ? registerStudent : null;

    function showRequiredStudentIdGuide(){
        const modal = document.getElementById("studentIdGuideModal");
        if(!modal) return;
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("student-id-guide-open");
    }

    function hideRequiredStudentIdGuide(){
        const modal = document.getElementById("studentIdGuideModal");
        if(!modal) return;
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("student-id-guide-open");
    }

    function isGuideAccepted(){
        return document.getElementById("studentIdGuideAccepted")?.value === "true";
    }

    function initRequiredStudentIdGuide(){
        if(document.body.dataset.page !== "register") return;

        const input = document.getElementById("registerStudentId");
        const trigger = document.getElementById("studentIdGuideTrigger");
        const accepted = document.getElementById("studentIdGuideAccepted");
        const checkbox = document.getElementById("acceptStudentIdGuide");
        const closeBtn = document.getElementById("closeStudentIdGuide");
        const form = document.getElementById("registerForm");
        const submitBtn = form ? form.querySelector("button[type='submit']") : null;

        if(!input || !accepted || !checkbox || !closeBtn) return;

        function setSubmitState(){
            if(submitBtn){
                submitBtn.disabled = accepted.value !== "true";
                submitBtn.classList.toggle("guide-required-disabled", accepted.value !== "true");
                submitBtn.title = accepted.value === "true" ? "" : "Read and accept the Student ID guide first.";
            }
        }

        function openIfNeeded(event){
            if(accepted.value !== "true"){
                if(event) event.stopPropagation();
                showRequiredStudentIdGuide();
            }
        }

        input.addEventListener("focus", openIfNeeded);
        input.addEventListener("click", openIfNeeded);

        if(trigger){
            trigger.addEventListener("click", function(event){
                event.preventDefault();
                event.stopPropagation();
                showRequiredStudentIdGuide();
            });
        }

        checkbox.addEventListener("change", function(){
            closeBtn.disabled = !checkbox.checked;
        });

        closeBtn.addEventListener("click", function(){
            if(!checkbox.checked) return;
            accepted.value = "true";
            hideRequiredStudentIdGuide();
            setSubmitState();
            setTimeout(() => input.focus(), 40);
        });

        document.addEventListener("keydown", function(event){
            if(event.key === "Escape" && accepted.value === "true"){
                hideRequiredStudentIdGuide();
            }
        });

        setSubmitState();
    }

    if(oldRegisterStudent){
        registerStudent = async function(event){
            if(!isGuideAccepted()){
                if(event){
                    event.preventDefault();
                    event.stopPropagation();
                }
                showRequiredStudentIdGuide();
                if(typeof showToast === "function"){
                    showToast("Please read and accept the Student ID guide before registering.", "error");
                }else{
                    alert("Please read and accept the Student ID guide before registering.");
                }
                return;
            }
            return oldRegisterStudent(event);
        };
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", initRequiredStudentIdGuide);
    }else{
        initRequiredStudentIdGuide();
    }
})();



/* PERFORMANCE FIX: requirements are loaded once by the page initializer.
   The old 30-second interval was removed to avoid freezing on low-resource devices. */

/* PGMO PATCH: final Remember Me, guide notice hide, and requirements upload route fix */
(function(){
    const REMEMBER_DAYS = 7;
    const REMEMBER_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000;
    const REMEMBER_ENABLED_KEY = "ojt_student_remember_enabled";
    const REMEMBER_UNTIL_KEY = "ojt_student_remember_until";
    const REMEMBER_LOGIN_ID_KEY = "ojt_student_remember_login_id";
    const LAST_ACTIVITY_KEY = "ojt_student_last_activity";

    function getSessionKeys(){
        const keys = Array.isArray(STUDENT_SESSION_KEYS) ? [...STUDENT_SESSION_KEYS] : [];
        [REMEMBER_ENABLED_KEY, REMEMBER_UNTIL_KEY, LAST_ACTIVITY_KEY].forEach(key => {
            if(!keys.includes(key)) keys.push(key);
        });
        return keys;
    }

    function rememberStillValid(){
        return localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"
            && localStorage.getItem("ojt_student_logged_in") === "true"
            && Number(localStorage.getItem(REMEMBER_UNTIL_KEY) || localStorage.getItem("ojt_student_session_expires_at") || 0) > Date.now();
    }

    function copyKeys(fromStorage, toStorage){
        getSessionKeys().forEach(key => {
            const value = fromStorage.getItem(key);
            if(value !== null && value !== undefined){
                toStorage.setItem(key, value);
            }
        });
    }

    function clearRememberedLogin(){
        getSessionKeys().forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(REMEMBER_ENABLED_KEY);
        localStorage.removeItem(REMEMBER_UNTIL_KEY);
        localStorage.removeItem("ojt_student_session_expires_at");
        localStorage.removeItem(REMEMBER_LOGIN_ID_KEY);
    }

    window.pgmoHydrateRememberedStudent = function(){
        if(!rememberStillValid()) return false;
        copyKeys(localStorage, sessionStorage);
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, "true");
        sessionStorage.setItem(REMEMBER_UNTIL_KEY, localStorage.getItem(REMEMBER_UNTIL_KEY) || localStorage.getItem("ojt_student_session_expires_at") || String(Date.now() + REMEMBER_MS));
        return true;
    };

    const baseClearStudentSession = typeof clearStudentSession === "function" ? clearStudentSession : null;
    clearStudentSession = function(){
        const forceLogout = window.__pgmoForceStudentLogout === true;
        const onLoginPage = document.body?.dataset?.page === "login";
        const keepRemember = !forceLogout && onLoginPage && rememberStillValid();

        getSessionKeys().forEach(key => sessionStorage.removeItem(key));
        sessionStorage.removeItem("student_session_expired");
        sessionStorage.removeItem("registration_success");

        if(!keepRemember){
            if(forceLogout){
                clearRememberedLogin();
            }else if(baseClearStudentSession){
                try{ baseClearStudentSession(); }catch(error){}
            }
        }
    };

    const baseSetStudentSession = typeof setStudentSession === "function" ? setStudentSession : null;
    setStudentSession = function(account){
        if(baseSetStudentSession){
            baseSetStudentSession(account);
        }

        const rememberMode = window.__pgmoStudentRememberMode === "remember";
        const until = Date.now() + REMEMBER_MS;

        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, rememberMode ? "true" : "false");
        sessionStorage.setItem(REMEMBER_UNTIL_KEY, String(until));
        sessionStorage.setItem("ojt_student_session_expires_at", String(until));

        if(rememberMode){
            copyKeys(sessionStorage, localStorage);
            localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
            localStorage.setItem(REMEMBER_UNTIL_KEY, String(until));
            localStorage.setItem("ojt_student_session_expires_at", String(until));
        }else{
            clearRememberedLogin();
        }
    };

    isLoggedIn = function(){
        return sessionStorage.getItem("ojt_student_logged_in") === "true" || window.pgmoHydrateRememberedStudent();
    };

    const baseRequireActiveStudentSession = typeof requireActiveStudentSession === "function" ? requireActiveStudentSession : null;
    requireActiveStudentSession = function(){
        window.pgmoHydrateRememberedStudent();

        if(sessionStorage.getItem("ojt_student_logged_in") !== "true") return false;

        const rememberMode = sessionStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
        const rememberUntil = Number(sessionStorage.getItem(REMEMBER_UNTIL_KEY) || localStorage.getItem(REMEMBER_UNTIL_KEY) || 0);

        if(rememberMode && rememberUntil && Date.now() > rememberUntil){
            window.__pgmoForceStudentLogout = true;
            clearStudentSession();
            window.__pgmoForceStudentLogout = false;
            sessionStorage.setItem("student_session_expired", "Your remembered login expired. Please log in again.");
            return false;
        }

        if(!rememberMode && baseRequireActiveStudentSession){
            return baseRequireActiveStudentSession();
        }

        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        if(rememberMode){
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }
        return true;
    };

    const baseLogoutStudent = typeof logoutStudent === "function" ? logoutStudent : null;
    logoutStudent = function(){
        window.__pgmoForceStudentLogout = true;
        clearStudentSession();
        clearRememberedLogin();
        window.location.href = "index.html";
    };

    const baseLoginStudent = typeof loginStudent === "function" ? loginStudent : null;
    if(baseLoginStudent){
        loginStudent = async function(event){
            const remember = document.getElementById("rememberMe")?.checked === true;
            const loginIdValue = document.getElementById("loginId")?.value?.trim() || "";
            window.__pgmoStudentRememberMode = remember ? "remember" : "session";
            try{
                const result = await baseLoginStudent(event);
                if(remember && loginIdValue){
                    localStorage.setItem(REMEMBER_LOGIN_ID_KEY, loginIdValue);
                }else{
                    localStorage.removeItem(REMEMBER_LOGIN_ID_KEY);
                }
                return result;
            }finally{
                window.__pgmoStudentRememberMode = "";
            }
        };
    }

    function applyRememberLoginPage(){
        if(document.body?.dataset?.page !== "login") return;

        const rememberedLogin = localStorage.getItem(REMEMBER_LOGIN_ID_KEY) || "";
        const loginInput = document.getElementById("loginId");
        const rememberBox = document.getElementById("rememberMe");

        if(rememberedLogin && loginInput && !loginInput.value){
            loginInput.value = rememberedLogin;
        }
        if(rememberBox){
            rememberBox.checked = rememberStillValid() || localStorage.getItem(REMEMBER_ENABLED_KEY) === "true";
        }

        if(window.pgmoHydrateRememberedStudent()){
            window.location.href = "dashboard.html";
        }
    }

    function hideAcceptedStudentIdGuideNotice(){
        const accepted = document.getElementById("studentIdGuideAccepted")?.value === "true" || sessionStorage.getItem("studentIdGuideAccepted") === "true";
        const notice = document.getElementById("studentIdGuideTrigger") || document.getElementById("studentIdGuideNotice");
        if(notice && accepted){
            notice.classList.add("is-hidden");
        }
    }

    function bindAcceptedGuideNotice(){
        if(document.body?.dataset?.page !== "register") return;

        const acceptedInput = document.getElementById("studentIdGuideAccepted");
        const checkbox = document.getElementById("acceptStudentIdGuide");
        const closeBtn = document.getElementById("closeStudentIdGuide");
        const notice = document.getElementById("studentIdGuideTrigger") || document.getElementById("studentIdGuideNotice");

        if(sessionStorage.getItem("studentIdGuideAccepted") === "true" && acceptedInput){
            acceptedInput.value = "true";
        }
        hideAcceptedStudentIdGuideNotice();

        if(closeBtn && checkbox && notice && closeBtn.dataset.pgmoHideNoticeBound !== "1"){
            closeBtn.dataset.pgmoHideNoticeBound = "1";
            closeBtn.addEventListener("click", function(){
                if(checkbox.checked){
                    sessionStorage.setItem("studentIdGuideAccepted", "true");
                    if(acceptedInput) acceptedInput.value = "true";
                    notice.classList.add("is-hidden");
                }
            });
        }
    }

    function fixRequirementsUploadButton(){
        if(document.body?.dataset?.page !== "requirements") return;
        document.querySelectorAll("#requirementsUploadButton, .requirements-upload-btn, .card-title .section-btn").forEach(button => {
            const text = (button.textContent || "").toLowerCase();
            if(text.includes("upload")){
                button.setAttribute("href", "submissions.html");
                const icon = button.querySelector("i");
                if(icon){
                    icon.className = "fa fa-folder-open";
                }
                const textNodes = Array.from(button.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                if(textNodes.length){
                    textNodes[textNodes.length - 1].nodeValue = " My Uploads";
                }else{
                    button.appendChild(document.createTextNode(" My Uploads"));
                }
                button.addEventListener("click", function(event){
                    event.preventDefault();
                    event.stopPropagation();
                    document.body.classList.remove("student-page-leaving");
                    window.location.href = "submissions.html";
                }, true);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", function(){
        applyRememberLoginPage();
        bindAcceptedGuideNotice();
        fixRequirementsUploadButton();
    });
})();


/* PGMO PATCH: make Student ID guide notice disappear immediately after agreement */
(function(){
    function hideGuideNotice(){
        const notice = document.getElementById("studentIdGuideTrigger") || document.getElementById("studentIdGuideNotice");
        if(notice){
            notice.classList.add("is-hidden");
        }
    }

    function showGuideNoticeIfNeeded(){
        const acceptedInput = document.getElementById("studentIdGuideAccepted");
        const accepted = acceptedInput?.value === "true" || sessionStorage.getItem("studentIdGuideAccepted") === "true";
        if(accepted){
            if(acceptedInput) acceptedInput.value = "true";
            hideGuideNotice();
        }
    }

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page !== "register") return;

        const notice = document.getElementById("studentIdGuideTrigger") || document.getElementById("studentIdGuideNotice");
        const checkbox = document.getElementById("acceptStudentIdGuide");
        const closeBtn = document.getElementById("closeStudentIdGuide");
        const acceptedInput = document.getElementById("studentIdGuideAccepted");

        showGuideNoticeIfNeeded();

        if(notice && notice.dataset.pgmoOpenGuideBound !== "1"){
            notice.dataset.pgmoOpenGuideBound = "1";
            notice.addEventListener("click", function(){
                const modal = document.getElementById("studentIdGuideModal");
                if(modal){
                    modal.classList.add("show");
                    modal.setAttribute("aria-hidden", "false");
                    document.body.classList.add("student-id-guide-open");
                }
            });
        }

        if(closeBtn && closeBtn.dataset.pgmoFinalHideGuideNoticeBound !== "1"){
            closeBtn.dataset.pgmoFinalHideGuideNoticeBound = "1";
            closeBtn.addEventListener("click", function(){
                if(checkbox && checkbox.checked){
                    sessionStorage.setItem("studentIdGuideAccepted", "true");
                    if(acceptedInput) acceptedInput.value = "true";
                    hideGuideNotice();
                }
            });
        }
    });
})();

/* PGMO PATCH: stable DTR print, two-month PDF, and automatic undertime calculation */
(function(){
    function pgmoPad2(value){
        return String(value).padStart(2, "0");
    }

    function pgmoAddMonths(monthValue, offset){
        if(!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return "";
        const [year, month] = monthValue.split("-").map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        return `${date.getFullYear()}-${pgmoPad2(date.getMonth() + 1)}`;
    }

    function pgmoMonthLabel(monthValue){
        if(!monthValue) return "Month not set";
        return new Date(monthValue + "-01").toLocaleString("en-US", { month:"long", year:"numeric" });
    }

    function pgmoNormalizeTimeForBlock(value, blockType){
        let minutes = monthlyMinutes(value);
        if(minutes === null) return null;

        if(blockType === "pm" && minutes < 720){
            minutes += 720;
        }

        return minutes;
    }

    function pgmoComputeDtrBlock(start, end, blockType){
        const hasStart = String(start || "").trim() !== "";
        const hasEnd = String(end || "").trim() !== "";

        if(!hasStart && !hasEnd){
            return { invalid:false, expected:0, worked:0, undertime:0 };
        }

        if(!hasStart || !hasEnd){
            return { invalid:true, expected:0, worked:0, undertime:0 };
        }

        const officialStart = blockType === "am" ? 8 * 60 : 13 * 60;
        const officialEnd = blockType === "am" ? 12 * 60 : 17 * 60;
        const expected = officialEnd - officialStart;
        const a = pgmoNormalizeTimeForBlock(start, blockType);
        const b = pgmoNormalizeTimeForBlock(end, blockType);

        if(a === null || b === null || b <= a){
            return { invalid:true, expected, worked:0, undertime:0 };
        }

        const countedStart = Math.max(a, officialStart);
        const countedEnd = Math.min(b, officialEnd);
        const worked = Math.max(0, countedEnd - countedStart);
        const undertime = Math.max(0, expected - worked);

        return { invalid:false, expected, worked, undertime };
    }

    function pgmoUndertimeParts(totalMinutes){
        const safe = Math.max(0, Math.round(Number(totalMinutes || 0)));
        return {
            hours: Math.floor(safe / 60),
            minutes: safe % 60
        };
    }

    function pgmoValueOrBlank(value){
        if(value === null || value === undefined || value === "") return "";
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? String(number) : "";
    }

    window.getMonthlyDtrEntries = function(){
        const rows = document.querySelectorAll("#monthlyDtrRows tr");
        const entries = [];
        let total = 0;

        rows.forEach(row => {
            if(row.classList.contains("inactive-day")) return;

            const day = Number(row.dataset.day);
            const amIn = row.querySelector('[data-field="am_in"]')?.value || "";
            const amOut = row.querySelector('[data-field="am_out"]')?.value || "";
            const pmIn = row.querySelector('[data-field="pm_in"]')?.value || "";
            const pmOut = row.querySelector('[data-field="pm_out"]')?.value || "";
            const manualUnderHours = Number(row.querySelector('[data-field="undertime_hours"]')?.value || 0);
            const manualUnderMinutes = Number(row.querySelector('[data-field="undertime_minutes"]')?.value || 0);
            const hasEntry = amIn || amOut || pmIn || pmOut || manualUnderHours || manualUnderMinutes;

            if(!hasEntry) return;

            const am = pgmoComputeDtrBlock(amIn, amOut, "am");
            const pm = pgmoComputeDtrBlock(pmIn, pmOut, "pm");

            if(am.invalid || pm.invalid){
                entries.push({
                    day,
                    invalid:true,
                    am_in:amIn,
                    am_out:amOut,
                    pm_in:pmIn,
                    pm_out:pmOut,
                    undertime_hours:manualUnderHours,
                    undertime_minutes:manualUnderMinutes,
                    hours:0
                });
                return;
            }

            const expectedMinutes = am.expected + pm.expected;
            const workedMinutes = am.worked + pm.worked;
            const automaticUndertimeMinutes = Math.max(0, expectedMinutes - workedMinutes);
            const manualUndertimeMinutes = (manualUnderHours * 60) + manualUnderMinutes;
            const totalUndertimeMinutes = automaticUndertimeMinutes + manualUndertimeMinutes;
            const countedMinutes = Math.max(0, expectedMinutes - totalUndertimeMinutes);
            const hours = Number((countedMinutes / 60).toFixed(2));
            const automaticParts = pgmoUndertimeParts(automaticUndertimeMinutes);
            const totalParts = pgmoUndertimeParts(totalUndertimeMinutes);

            let dayType = "Custom";
            if(am.expected > 0 && pm.expected > 0) dayType = "Full Day";
            if(am.expected > 0 && pm.expected === 0) dayType = "AM Half-Day";
            if(am.expected === 0 && pm.expected > 0) dayType = "PM Half-Day";

            total += hours;
            entries.push({
                day,
                day_type: dayType,
                am_in:amIn,
                am_out:amOut,
                pm_in:pmIn,
                pm_out:pmOut,
                am_hours: Number((am.worked / 60).toFixed(2)),
                pm_hours: Number((pm.worked / 60).toFixed(2)),
                automatic_undertime_hours: automaticParts.hours,
                automatic_undertime_minutes: automaticParts.minutes,
                manual_undertime_hours: manualUnderHours,
                manual_undertime_minutes: manualUnderMinutes,
                undertime_hours: totalParts.hours,
                undertime_minutes: totalParts.minutes,
                hours
            });
        });

        return { entries, total:Number(total.toFixed(2)) };
    };

    function pgmoCurrentVisibleDtrAsForm(student, selectedMonth){
        const result = getMonthlyDtrEntries();
        if(!selectedMonth || !result.entries.length || result.entries.some(item => item.invalid)) return null;
        return {
            student_id: student.id,
            student_name: student.name,
            month: selectedMonth,
            month_label: pgmoMonthLabel(selectedMonth),
            entries: result.entries,
            total_hours: result.total,
            notes: document.getElementById("dtrNotes")?.value || "",
            status: "Draft"
        };
    }

    function pgmoCompileMonthDtr(forms, monthValue){
        const [year, month] = monthValue.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthForms = (forms || []).filter(form => form.month === monthValue);
        const mergedEntries = {};

        monthForms.forEach(form => {
            (form.entries || []).forEach(entry => {
                if(!entry || !entry.day) return;
                mergedEntries[Number(entry.day)] = {
                    day: Number(entry.day),
                    am_in: entry.am_in || "",
                    am_out: entry.am_out || "",
                    pm_in: entry.pm_in || "",
                    pm_out: entry.pm_out || "",
                    undertime_hours: entry.undertime_hours || "",
                    undertime_minutes: entry.undertime_minutes || "",
                    hours: Number(entry.hours || 0)
                };
            });
        });

        const body = [];
        let totalHours = 0;

        for(let day = 1; day <= 31; day++){
            if(day > daysInMonth){
                body.push([String(day), "", "", "", "", "", ""]);
                continue;
            }

            const date = new Date(year, month - 1, day);
            const weekday = date.getDay();

            if(weekday === 0){
                body.push([String(day), "SUN", "", "", "", "", ""]);
                continue;
            }

            if(weekday === 6){
                body.push([String(day), "SAT", "", "", "", "", ""]);
                continue;
            }

            const entry = mergedEntries[day] || {};
            totalHours += Number(entry.hours || 0);

            body.push([
                String(day),
                entry.am_in || "",
                entry.am_out || "",
                entry.pm_in || "",
                entry.pm_out || "",
                pgmoValueOrBlank(entry.undertime_hours),
                pgmoValueOrBlank(entry.undertime_minutes)
            ]);
        }

        return {
            month: monthValue,
            monthLabel: pgmoMonthLabel(monthValue),
            forms: monthForms,
            body,
            totalHours:Number(totalHours.toFixed(2))
        };
    }

    function pgmoDrawDtrPanel(doc, panel, x, y, width, student){
        const center = x + (width / 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text("DAILY TIME RECORD", center, y, { align:"center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("-----o0o-----", center, y + 11, { align:"center" });

        doc.setFontSize(7);
        doc.text("For the month of:", x + 8, y + 29);
        doc.setFont("helvetica", "bold");
        doc.text(panel.monthLabel, x + 78, y + 29);

        doc.autoTable({
            startY: y + 39,
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 5.6,
                halign: "center",
                valign: "middle",
                lineColor: [35,35,35],
                lineWidth: 0.45,
                cellPadding: 1.25,
                minCellHeight: 8.6,
                overflow: "linebreak"
            },
            headStyles: {
                fillColor: [255,255,255],
                textColor: [0,0,0],
                fontStyle: "bold"
            },
            head: [[
                { content:"Day", rowSpan:2 },
                { content:"A.M.", colSpan:2 },
                { content:"P.M.", colSpan:2 },
                { content:"Undertime", colSpan:2 }
            ],[
                "Arr.", "Dep.", "Arr.", "Dep.", "Hr", "Min"
            ]],
            body: panel.body,
            margin: { left:x + 5, right:842 - (x + width - 5) },
            tableWidth: width - 10,
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 36 },
                2: { cellWidth: 36 },
                3: { cellWidth: 36 },
                4: { cellWidth: 36 },
                5: { cellWidth: 28 },
                6: { cellWidth: 28 }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 9;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(`Total: ${panel.totalHours} hour(s)`, x + width - 10, finalY, { align:"right" });
        return finalY;
    }

    function pgmoDrawSharedDtrName(doc, student, pageWidth){
        const center = pageWidth / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.text(student.name || "Student", center, 54, { align:"center", maxWidth: 420 });
        doc.setDrawColor(25, 25, 25);
        doc.line(center - 185, 59, center + 185, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("(Name)", center, 67, { align:"center" });
    }

    function pgmoDrawSharedDtrSignatureArea(doc, pageWidth){
        const center = pageWidth / 2;
        const left = 55;
        const right = pageWidth - 55;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        const certText = "I certify on my honor that the above is a true and correct report of the hours of work performed.";
        doc.text(certText, left, 448);

        doc.setDrawColor(25, 25, 25);
        doc.line(center - 160, 496, center + 160, 496);
        doc.text("Student Signature", center, 505, { align:"center" });

        doc.text("VERIFIED as to prescribed office hours:", left, 528);
        doc.line(center - 160, 558, center + 160, 558);
        doc.text("In Charge", center, 567, { align:"center" });
    }

    window.downloadJointMonthlyDtrPdf = async function(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
        }

        if(!initSupabase()) return;

        if(!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable){
            showToast("PDF library is not loaded. Please reload the DTR page.", "error");
            return;
        }

        const student = getStudent();
        const monthInput = document.getElementById("dtrMonth");
        const selectedMonth = monthInput ? monthInput.value : "";

        if(!selectedMonth){
            showToast("Please select the DTR month first.", "error");
            return;
        }

        const previousMonth = pgmoAddMonths(selectedMonth, -1);
        const nextMonth = pgmoAddMonths(selectedMonth, 1);

        const { data: savedForms, error } = await supabaseClient
            .from(getDtrFormsTable())
            .select("*")
            .eq("student_id", student.id)
            .in("month", [previousMonth, selectedMonth, nextMonth])
            .order("created_at", { ascending:true });

        if(error){
            showToast(error.message, "error");
            return;
        }

        const forms = [...(savedForms || [])];
        const currentDraft = pgmoCurrentVisibleDtrAsForm(student, selectedMonth);
        if(currentDraft){
            forms.push(currentDraft);
        }

        if(!forms.length){
            showToast("No DTR entries found to print.", "error");
            return;
        }

        let monthsToPrint = [selectedMonth];
        const hasNext = forms.some(form => form.month === nextMonth);
        const hasPrevious = forms.some(form => form.month === previousMonth);

        if(hasNext){
            monthsToPrint.push(nextMonth);
        }else if(hasPrevious){
            monthsToPrint.unshift(previousMonth);
        }

        monthsToPrint = Array.from(new Set(monthsToPrint)).sort().slice(0, 2);

        const panels = monthsToPrint
            .map(month => pgmoCompileMonthDtr(forms, month))
            .filter(panel => panel.forms.length || panel.totalHours > 0);

        if(!panels.length){
            showToast("No DTR entries found for the selected or adjacent month.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("l", "pt", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("PGMO OJT DAILY TIME RECORD", pageWidth / 2, 26, { align:"center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const subtitle = panels.length === 2
            ? `${panels[0].monthLabel} and ${panels[1].monthLabel} · ${student.id || ""}`
            : `${panels[0].monthLabel} · ${student.id || ""}`;
        doc.text(subtitle, pageWidth / 2, 39, { align:"center" });

        pgmoDrawSharedDtrName(doc, student, pageWidth);

        if(panels.length === 1){
            pgmoDrawDtrPanel(doc, panels[0], 155, 78, 532, student);
        }else{
            pgmoDrawDtrPanel(doc, panels[0], 26, 78, 386, student);
            doc.setDrawColor(180, 180, 180);
            doc.line(pageWidth / 2, 76, pageWidth / 2, 432);
            pgmoDrawDtrPanel(doc, panels[1], 430, 78, 386, student);
        }

        pgmoDrawSharedDtrSignatureArea(doc, pageWidth);

        const safeStudentId = String(student.id || "student").replace(/[^a-zA-Z0-9_-]/g, "");
        const safeMonths = panels.map(panel => panel.month).join("_");
        doc.save(`DTR_${safeStudentId}_${safeMonths}.pdf`);
    };

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page !== "monthly-dtr") return;

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.setAttribute("type", "button");
            button.removeAttribute("href");
            button.innerHTML = '<i class="fa fa-print"></i> Print DTR';
            button.addEventListener("click", function(event){
                event.preventDefault();
                event.stopImmediatePropagation();
                downloadJointMonthlyDtrPdf(event);
            }, true);
        }
    });
})();

/* PGMO PATCH: hard-fix Print DTR button and add preview before download */
(function(){
    const PREVIEW_STATE_KEY = "__pgmoDtrPreviewState";

    function pad2(value){
        return String(value).padStart(2, "0");
    }

    function addMonths(monthValue, offset){
        if(!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) return "";
        const [year, month] = monthValue.split("-").map(Number);
        const date = new Date(year, month - 1 + offset, 1);
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    }

    function monthLabel(monthValue){
        if(!monthValue) return "Month not set";
        return new Date(monthValue + "-01").toLocaleString("en-US", { month:"long", year:"numeric" });
    }

    function safeText(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function valueOrBlank(value){
        if(value === null || value === undefined || value === "") return "";
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? String(number) : "";
    }

    function notify(message, type){
        if(typeof showToast === "function"){
            showToast(message, type || "info");
        }else{
            alert(message);
        }
    }

    function currentVisibleDtrAsForm(student, selectedMonth){
        if(typeof getMonthlyDtrEntries !== "function") return null;
        const result = getMonthlyDtrEntries();
        if(!selectedMonth || !result.entries.length) return null;
        if(result.entries.some(item => item.invalid)){
            notify("Please fix invalid time entries before previewing your DTR.", "error");
            return "invalid";
        }
        return {
            student_id: student.id,
            student_name: student.name,
            month: selectedMonth,
            month_label: monthLabel(selectedMonth),
            entries: result.entries,
            total_hours: Number(result.total || 0),
            notes: document.getElementById("dtrNotes")?.value || "",
            status: "Draft"
        };
    }

    function compileMonthDtr(forms, monthValue){
        const [year, month] = monthValue.split("-").map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthForms = (forms || []).filter(form => form.month === monthValue);
        const mergedEntries = {};

        monthForms.forEach(form => {
            (form.entries || []).forEach(entry => {
                if(!entry || !entry.day) return;
                mergedEntries[Number(entry.day)] = {
                    day: Number(entry.day),
                    am_in: entry.am_in || "",
                    am_out: entry.am_out || "",
                    pm_in: entry.pm_in || "",
                    pm_out: entry.pm_out || "",
                    undertime_hours: entry.undertime_hours || "",
                    undertime_minutes: entry.undertime_minutes || "",
                    hours: Number(entry.hours || 0)
                };
            });
        });

        const body = [];
        let totalHours = 0;

        for(let day = 1; day <= 31; day++){
            if(day > daysInMonth){
                body.push([String(day), "", "", "", "", "", ""]);
                continue;
            }

            const date = new Date(year, month - 1, day);
            const weekday = date.getDay();

            if(weekday === 0){
                body.push([String(day), "SUN", "", "", "", "", ""]);
                continue;
            }

            if(weekday === 6){
                body.push([String(day), "SAT", "", "", "", "", ""]);
                continue;
            }

            const entry = mergedEntries[day] || {};
            totalHours += Number(entry.hours || 0);

            body.push([
                String(day),
                entry.am_in || "",
                entry.am_out || "",
                entry.pm_in || "",
                entry.pm_out || "",
                valueOrBlank(entry.undertime_hours),
                valueOrBlank(entry.undertime_minutes)
            ]);
        }

        return {
            month: monthValue,
            monthLabel: monthLabel(monthValue),
            forms: monthForms,
            body,
            totalHours: Number(totalHours.toFixed(2))
        };
    }

    async function buildDtrPreviewState(){
        if(typeof getStudent !== "function"){
            notify("Student session was not found. Please log in again.", "error");
            return null;
        }

        const student = getStudent();
        const monthInput = document.getElementById("dtrMonth");
        const selectedMonth = monthInput ? monthInput.value : "";

        if(!selectedMonth){
            notify("Please select the DTR month first.", "error");
            return null;
        }

        const previousMonth = addMonths(selectedMonth, -1);
        const nextMonth = addMonths(selectedMonth, 1);
        let savedForms = [];

        /*
          Do not block the DTR preview when Supabase is slow, unavailable, or still
          loading. The student's current visible DTR must still preview/print.
          Saved adjacent months are loaded only when Supabase is ready.
        */
        const canLoadSavedForms = typeof initSupabase === "function"
            && typeof supabase !== "undefined"
            && typeof getDtrFormsTable === "function"
            && initSupabase();

        if(canLoadSavedForms && typeof supabaseClient !== "undefined" && supabaseClient){
            try{
                const { data, error } = await supabaseClient
                    .from(getDtrFormsTable())
                    .select("*")
                    .eq("student_id", student.id)
                    .in("month", [previousMonth, selectedMonth, nextMonth])
                    .order("created_at", { ascending:true });

                if(error){
                    console.warn("Saved DTR lookup failed:", error.message);
                }else{
                    savedForms = data || [];
                }
            }catch(error){
                console.warn("Saved DTR lookup failed:", error);
            }
        }

        const forms = [...savedForms];
        const draft = currentVisibleDtrAsForm(student, selectedMonth);
        if(draft === "invalid") return null;
        if(draft) forms.push(draft);

        if(!forms.length){
            notify("Input at least one DTR entry before printing.", "error");
            return null;
        }

        let monthsToPrint = [selectedMonth];
        const hasNext = forms.some(form => form.month === nextMonth);
        const hasPrevious = forms.some(form => form.month === previousMonth);

        if(hasNext){
            monthsToPrint.push(nextMonth);
        }else if(hasPrevious){
            monthsToPrint.unshift(previousMonth);
        }

        monthsToPrint = Array.from(new Set(monthsToPrint)).sort().slice(0, 2);

        const panels = monthsToPrint
            .map(month => compileMonthDtr(forms, month))
            .filter(panel => panel.forms.length || panel.totalHours > 0);

        if(!panels.length){
            notify("No printable DTR entries found for the selected or adjacent month.", "error");
            return null;
        }

        return { student, panels };
    }

    function renderPreviewTable(panel){
        return `
            <div class="dtr-preview-panel">
                <div class="dtr-preview-panel-head">
                    <h4>${safeText(panel.monthLabel)}</h4>
                    <span>${safeText(panel.totalHours)} hour(s)</span>
                </div>
                <div class="dtr-preview-table-wrap">
                    <table class="dtr-preview-table">
                        <thead>
                            <tr>
                                <th rowspan="2">Day</th>
                                <th colspan="2">A.M.</th>
                                <th colspan="2">P.M.</th>
                                <th colspan="2">Undertime</th>
                            </tr>
                            <tr>
                                <th>Arr.</th>
                                <th>Dep.</th>
                                <th>Arr.</th>
                                <th>Dep.</th>
                                <th>Hr</th>
                                <th>Min</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${panel.body.map(row => `
                                <tr>
                                    ${row.map(cell => `<td>${safeText(cell)}</td>`).join("")}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function showDtrPreviewModal(state){
        const modal = document.getElementById("dtrPreviewModal");
        const body = document.getElementById("dtrPreviewBody");
        const title = document.getElementById("dtrPreviewTitle");
        const subtitle = document.getElementById("dtrPreviewSubtitle");

        if(!modal || !body){
            generateDtrPreviewPdf(state);
            return;
        }

        window[PREVIEW_STATE_KEY] = state;

        if(title){
            title.textContent = state.panels.length === 2 ? "DTR Preview · Two Months" : "DTR Preview";
        }

        if(subtitle){
            subtitle.textContent = state.panels.length === 2
                ? `${state.panels[0].monthLabel} and ${state.panels[1].monthLabel} · ${state.student.id || ""}`
                : `${state.panels[0].monthLabel} · ${state.student.id || ""}`;
        }

        body.innerHTML = `
            <div class="dtr-preview-student">
                <strong>${safeText(state.student.name || "Student")}</strong>
                <span>${safeText(state.student.id || "")}</span>
            </div>
            <div class="dtr-preview-grid ${state.panels.length === 2 ? "two-months" : "one-month"}">
                ${state.panels.map(renderPreviewTable).join("")}
            </div>
        `;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("dtr-preview-open");
    }

    function closeDtrPreviewModal(){
        const modal = document.getElementById("dtrPreviewModal");
        if(modal){
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("dtr-preview-open");
    }

    function drawDtrPanel(doc, panel, x, y, width, student){
        const center = x + (width / 2);
        const tableWidth = Math.min(310, width - 34);
        const tableLeft = center - (tableWidth / 2);
        const tableRight = center + (tableWidth / 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text("DAILY TIME RECORD", center, y, { align:"center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("-----o0o-----", center, y + 11, { align:"center" });

        doc.setFontSize(7);
        doc.text("For the month of:", tableLeft, y + 29);
        doc.setFont("helvetica", "bold");
        doc.text(panel.monthLabel, tableLeft + 72, y + 29);

        doc.autoTable({
            startY: y + 39,
            theme: "grid",
            styles: {
                font: "helvetica",
                fontSize: 5.6,
                halign: "center",
                valign: "middle",
                lineColor: [35,35,35],
                lineWidth: 0.45,
                cellPadding: 1.15,
                minCellHeight: 8.6,
                overflow: "linebreak"
            },
            headStyles: {
                fillColor: [255,255,255],
                textColor: [0,0,0],
                fontStyle: "bold"
            },
            head: [[
                { content:"Day", rowSpan:2 },
                { content:"A.M.", colSpan:2 },
                { content:"P.M.", colSpan:2 },
                { content:"Undertime", colSpan:2 }
            ],[
                "Arr.", "Dep.", "Arr.", "Dep.", "Hr", "Min"
            ]],
            body: panel.body,
            margin: { left: tableLeft, right: doc.internal.pageSize.getWidth() - tableRight },
            tableWidth: tableWidth,
            columnStyles: {
                0: { cellWidth: 26 },
                1: { cellWidth: 48 },
                2: { cellWidth: 48 },
                3: { cellWidth: 48 },
                4: { cellWidth: 48 },
                5: { cellWidth: 46 },
                6: { cellWidth: 46 }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 9;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(`Total: ${panel.totalHours} hour(s)`, tableRight, finalY, { align:"right" });
        return finalY;
    }

    function drawSharedDtrName(doc, student, pageWidth){
        const center = pageWidth / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.text(student.name || "Student", center, 54, { align:"center", maxWidth: 430 });
        doc.setDrawColor(25, 25, 25);
        doc.line(center - 190, 59, center + 190, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("(Name)", center, 67, { align:"center" });
    }

    function drawSharedDtrSignatureArea(doc, pageWidth){
        const center = pageWidth / 2;
        const signatureLineHalf = 170;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        const certText = "I certify on my honor that the above is a true and correct report of the hours of work performed.";
        doc.text(certText, center, 448, { align:"center", maxWidth: 680 });

        doc.setDrawColor(25, 25, 25);
        doc.line(center - signatureLineHalf, 496, center + signatureLineHalf, 496);
        doc.text("Student Signature", center, 505, { align:"center" });

        doc.text("VERIFIED as to prescribed office hours:", center, 528, { align:"center" });
        doc.line(center - signatureLineHalf, 558, center + signatureLineHalf, 558);
        doc.text("In Charge", center, 567, { align:"center" });
    }

    function generateDtrPreviewPdf(state){
        if(!state || !state.panels || !state.panels.length){
            notify("No DTR preview data found.", "error");
            return;
        }

        if(!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable){
            notify("PDF library is not loaded. Please reload the DTR page.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("l", "pt", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageCenter = pageWidth / 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("PGMO OJT DAILY TIME RECORD", pageCenter, 26, { align:"center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const subtitle = state.panels.length === 2
            ? `${state.panels[0].monthLabel} and ${state.panels[1].monthLabel} · ${state.student.id || ""}`
            : `${state.panels[0].monthLabel} · ${state.student.id || ""}`;
        doc.text(subtitle, pageCenter, 39, { align:"center" });

        drawSharedDtrName(doc, state.student, pageWidth);

        if(state.panels.length === 1){
            const singleWidth = 430;
            drawDtrPanel(doc, state.panels[0], pageCenter - (singleWidth / 2), 78, singleWidth, state.student);
        }else{
            const pageMargin = 46;
            const panelGap = 34;
            const panelWidth = (pageWidth - (pageMargin * 2) - panelGap) / 2;
            const leftX = pageMargin;
            const rightX = pageMargin + panelWidth + panelGap;

            drawDtrPanel(doc, state.panels[0], leftX, 78, panelWidth, state.student);
            doc.setDrawColor(180, 180, 180);
            doc.line(pageCenter, 76, pageCenter, 432);
            drawDtrPanel(doc, state.panels[1], rightX, 78, panelWidth, state.student);
        }

        drawSharedDtrSignatureArea(doc, pageWidth);

        const safeStudentId = String(state.student.id || "student").replace(/[^a-zA-Z0-9_-]/g, "");
        const safeMonths = state.panels.map(panel => panel.month).join("_");
        doc.save(`DTR_${safeStudentId}_${safeMonths}.pdf`);
    }

    async function openDtrPreview(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.disabled = true;
            button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Preparing preview...';
        }

        const state = await buildDtrPreviewState();

        if(button){
            button.disabled = false;
            button.innerHTML = '<i class="fa fa-print"></i> Print DTR';
        }

        if(state){
            showDtrPreviewModal(state);
        }
    }

    window.PGMO_DTR_PREVIEW = openDtrPreview;

    function bindDtrPreviewModalControls(){
        if(document.body?.dataset?.page !== "monthly-dtr") return;

        document.querySelectorAll("[data-close-dtr-preview]").forEach(button => {
            if(button.dataset.pgmoDtrPreviewCloseBound === "1") return;
            button.dataset.pgmoDtrPreviewCloseBound = "1";
            button.addEventListener("click", closeDtrPreviewModal);
        });

        const downloadButton = document.getElementById("downloadDtrFromPreviewButton");
        if(downloadButton && downloadButton.dataset.pgmoDtrDownloadBound !== "1"){
            downloadButton.dataset.pgmoDtrDownloadBound = "1";
            downloadButton.addEventListener("click", function(event){
                event.preventDefault();
                event.stopPropagation();
                generateDtrPreviewPdf(window[PREVIEW_STATE_KEY]);
            });
        }

        const modal = document.getElementById("dtrPreviewModal");
        if(modal && modal.dataset.pgmoDtrModalBound !== "1"){
            modal.dataset.pgmoDtrModalBound = "1";
            modal.addEventListener("click", function(event){
                if(event.target === modal){
                    closeDtrPreviewModal();
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", bindDtrPreviewModalControls);
})();


/* Removed duplicate DTR print rebinding block during deploy cleanup. */

/* PGMO PATCH 2026-06-30: force password change after admin reset */
(function(){
    const MUST_CHANGE_KEY = "ojt_student_must_change_password";
    const RESET_NOTICE_KEY = "ojt_student_password_reset_notice";
    const REMEMBER_ENABLED_KEY = "ojt_student_remember_enabled";
    const REMEMBER_LOGIN_ID_KEY = "ojt_student_remember_login_id";

    function resetStudentSafe(value){
        return String(value ?? "")
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;")
            .replaceAll('"',"&quot;")
            .replaceAll("'","&#039;");
    }

    function setMustChangeSession(account){
        const mustChange = account?.must_change_password === true || String(account?.must_change_password) === "true";
        sessionStorage.setItem(MUST_CHANGE_KEY, mustChange ? "true" : "false");
        if(localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"){
            localStorage.setItem(MUST_CHANGE_KEY, mustChange ? "true" : "false");
        }
        return mustChange;
    }

    async function fetchCurrentStudentPasswordFlag(){
        if(!initSupabase || !initSupabase()) return false;
        const student = typeof getStudent === "function" ? getStudent() : {};
        if(!student.accountId && !student.id) return false;

        let query = supabaseClient
            .from(getStudentAccountsTable())
            .select("id,must_change_password")
            .limit(1);

        if(student.accountId){
            query = query.eq("id", student.accountId);
        }else{
            query = query.eq("student_id", student.id);
        }

        const { data, error } = await query;
        if(error || !data || !data.length) return false;
        return setMustChangeSession(data[0]);
    }

    loginStudent = async function(event){
        event.preventDefault();
        if(!initSupabase()) return;

        const loginInput = document.getElementById("loginId")?.value.trim() || "";
        const password = document.getElementById("loginPassword")?.value.trim() || "";
        const remember = document.getElementById("rememberMe")?.checked === true;

        if(!loginInput || !password){
            showToast("Please enter your Student ID or Email and password.", "error");
            return;
        }

        const button = event.target.querySelector("button[type='submit']");
        const originalText = button ? button.innerHTML : "";
        if(button){
            button.disabled = true;
            button.innerHTML = "Signing in...";
        }

        const table = getStudentAccountsTable();
        let query = supabaseClient.from(table).select("*").limit(1);
        query = loginInput.includes("@")
            ? query.eq("email", loginInput.toLowerCase())
            : query.eq("student_id", loginInput.toUpperCase());

        const { data, error } = await query;

        if(button){
            button.disabled = false;
            button.innerHTML = originalText;
        }

        if(error){ showToast(error.message, "error"); return; }
        if(!data || !data.length){ showToast("Account not found. Please register first.", "error"); return; }

        const account = data[0];
        const passwordHash = await hashPassword(password);
        if(account.password_hash !== passwordHash){
            showToast("Incorrect password.", "error");
            return;
        }

        if(account.status && account.status !== "Active"){
            showToast("Your account is not active. Please contact your coordinator.", "error");
            return;
        }

        window.__pgmoStudentRememberMode = remember ? "remember" : "session";
        setStudentSession(account);
        const mustChange = setMustChangeSession(account);
        if(remember && loginInput){
            localStorage.setItem(REMEMBER_LOGIN_ID_KEY, loginInput);
        }else{
            localStorage.removeItem(REMEMBER_LOGIN_ID_KEY);
        }
        window.__pgmoStudentRememberMode = "";

        await supabaseClient
            .from(table)
            .update({last_login_at:new Date().toISOString()})
            .eq("id", account.id);

        if(mustChange){
            sessionStorage.setItem(RESET_NOTICE_KEY, "Your password was reset by the admin. Please create a new password before using the portal.");
            if(window.pgmoStartStudentLoginAnimation){
                window.pgmoStartStudentLoginAnimation("profile.html");
                return;
            }

            window.location.href = "profile.html";
            return;
        }

        if(window.pgmoStartStudentLoginAnimation){
            window.pgmoStartStudentLoginAnimation("dashboard.html");
            return;
        }

        window.location.href = "dashboard.html";
    };

    changeStudentPassword = async function(event){
        event.preventDefault();
        if(!initSupabase()) return;

        const currentPassword = getInputValue("currentPasswordInput");
        const newPassword = getInputValue("newPasswordInput");
        const confirmPassword = getInputValue("confirmNewPasswordInput");
        const forgotMode = document.getElementById("forgotPasswordToggle")?.checked === true;
        const forcedMode = sessionStorage.getItem(MUST_CHANGE_KEY) === "true" || localStorage.getItem(MUST_CHANGE_KEY) === "true";

        if(!newPassword || !confirmPassword){ showToast("Please enter and confirm your new password.", "error"); return; }
        if(!currentPassword && !forgotMode){ showToast("Enter your current or temporary password first.", "error"); return; }

        const passwordResult = typeof validateSecureStudentPassword === "function" ? validateSecureStudentPassword(newPassword) : {ok:newPassword.length >= 8, rules:{}};
        if(!passwordResult.ok){
            if(typeof securePasswordMessage === "function"){
                showToast(securePasswordMessage(passwordResult.rules), "error");
            }else{
                showToast("New password must include at least 8 characters, uppercase, lowercase, and number.", "error");
            }
            return;
        }

        if(newPassword !== confirmPassword){ showToast("New password and confirm password do not match.", "error"); return; }
        if(currentPassword && currentPassword === newPassword){ showToast("New password must be different from your current password.", "error"); return; }

        const student = getStudent();
        const button = document.getElementById("changePasswordButton");
        const originalText = button ? button.innerHTML : "";
        if(button){ button.disabled = true; button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Updating...`; }

        let query = supabaseClient.from(getStudentAccountsTable()).select("id,password_hash").limit(1);
        if(student.accountId){ query = query.eq("id", student.accountId); }
        else{ query = query.eq("student_id", student.id); }

        const { data, error } = await query;
        if(error || !data || !data.length){
            if(button){ button.disabled = false; button.innerHTML = originalText; }
            showToast(error ? error.message : "Could not verify your account.", "error");
            return;
        }

        const account = data[0];
        if(currentPassword && !forgotMode){
            const currentHash = await hashPassword(currentPassword);
            if(account.password_hash !== currentHash){
                if(button){ button.disabled = false; button.innerHTML = originalText; }
                showToast(forcedMode ? "Temporary password is incorrect." : "Current password is incorrect.", "error");
                return;
            }
        }

        const newHash = await hashPassword(newPassword);
        const { error: updateError } = await supabaseClient
            .from(getStudentAccountsTable())
            .update({
                password_hash: newHash,
                must_change_password: false,
                password_changed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", account.id);

        if(button){ button.disabled = false; button.innerHTML = originalText; }
        if(updateError){ showToast(updateError.message, "error"); return; }

        ["currentPasswordInput", "newPasswordInput", "confirmNewPasswordInput"].forEach(id => {
            const input = document.getElementById(id);
            if(input){ input.value = ""; input.type = "password"; }
        });
        const forgot = document.getElementById("forgotPasswordToggle");
        if(forgot) forgot.checked = false;

        sessionStorage.setItem(MUST_CHANGE_KEY, "false");
        localStorage.setItem(MUST_CHANGE_KEY, "false");
        sessionStorage.removeItem(RESET_NOTICE_KEY);
        document.querySelector(".forced-password-banner")?.remove();
        showToast("Password updated successfully.");
    };

    function showForcedPasswordBanner(){
        if(document.body?.dataset?.page !== "profile") return;
        const notice = sessionStorage.getItem(RESET_NOTICE_KEY);
        const forced = sessionStorage.getItem(MUST_CHANGE_KEY) === "true" || localStorage.getItem(MUST_CHANGE_KEY) === "true";
        if(!notice && !forced) return;
        if(document.querySelector(".forced-password-banner")) return;

        const target = document.querySelector(".profile-edit-card") || document.querySelector(".portal-main");
        if(!target) return;
        const banner = document.createElement("div");
        banner.className = "dash-card forced-password-banner";
        banner.innerHTML = `
            <div class="forced-password-icon"><i class="fa fa-shield-halved"></i></div>
            <div>
                <h3>Password Change Required</h3>
                <p>${resetStudentSafe(notice || "Your password was reset. Please create a new password before continuing.")}</p>
                <small>Use the temporary password from your admin as your current password, then enter your new password below.</small>
            </div>`;
        target.parentNode.insertBefore(banner, target);

        const forgotWrap = document.querySelector(".forgot-password-option");
        const forgotBox = document.getElementById("forgotPasswordToggle");
        if(forgotWrap && forgotBox){
            forgotBox.checked = false;
            forgotBox.disabled = true;
            forgotWrap.style.display = "none";
        }
    }

    async function guardForcedPasswordChange(){
        if(!document.body || ["login","register"].includes(document.body.dataset.page)) return;
        const mustChange = await fetchCurrentStudentPasswordFlag();
        if(mustChange && document.body.dataset.page !== "profile"){
            sessionStorage.setItem(RESET_NOTICE_KEY, "Your password was reset by the admin. Please create a new password before using the portal.");
            window.location.href = "profile.html";
            return;
        }
        showForcedPasswordBanner();
    }

    document.addEventListener("DOMContentLoaded", function(){
        setTimeout(guardForcedPasswordChange, 350);
        setTimeout(showForcedPasswordBanner, 700);
    });
})();


/* PGMO FINAL PATCH 2026-07-01: 8-hour Remember Me + DTR preview guard */
(function(){
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const REMEMBER_ENABLED_KEY = "ojt_student_remember_enabled";
    const REMEMBER_LOGIN_ID_KEY = "ojt_student_remember_login_id";
    const EXPIRES_KEY = "ojt_student_session_expires_at";
    const LAST_ACTIVITY_KEY = "ojt_student_last_activity";

    function sessionKeyList(storage){
        const base = Array.isArray(window.STUDENT_SESSION_KEYS) ? window.STUDENT_SESSION_KEYS : (Array.isArray(STUDENT_SESSION_KEYS) ? STUDENT_SESSION_KEYS : []);
        const keys = new Set(base.concat([
            "ojt_student_logged_in",
            "ojt_student_school",
            "ojt_student_id_request_allowed",
            "ojt_student_must_change_password",
            REMEMBER_ENABLED_KEY,
            EXPIRES_KEY,
            LAST_ACTIVITY_KEY
        ]));
        if(storage){
            for(let i = 0; i < storage.length; i++){
                const key = storage.key(i);
                if(key && (key.startsWith("ojt_student_") || key === "student_live_unread_count")){
                    keys.add(key);
                }
            }
        }
        return Array.from(keys);
    }

    function copyStudentSession(fromStorage, toStorage){
        sessionKeyList(fromStorage).forEach(key => {
            const value = fromStorage.getItem(key);
            if(value !== null && value !== undefined){
                toStorage.setItem(key, value);
            }
        });
    }

    function clearRememberedStudent(){
        sessionKeyList(localStorage).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(REMEMBER_ENABLED_KEY);
        localStorage.removeItem(REMEMBER_LOGIN_ID_KEY);
        localStorage.removeItem(EXPIRES_KEY);
        localStorage.removeItem("ojt_student_remember_until");
    }

    function rememberedSessionIsValid(){
        return localStorage.getItem(REMEMBER_ENABLED_KEY) === "true"
            && localStorage.getItem("ojt_student_logged_in") === "true"
            && Number(localStorage.getItem(EXPIRES_KEY) || 0) > Date.now();
    }

    window.pgmoHydrateRememberedStudent = function(){
        if(!rememberedSessionIsValid()) return false;
        copyStudentSession(localStorage, sessionStorage);
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, "true");
        return true;
    };

    const previousSetStudentSession = typeof setStudentSession === "function" ? setStudentSession : null;
    setStudentSession = function(account){
        if(previousSetStudentSession){
            previousSetStudentSession(account);
        }

        const rememberMode = window.__pgmoStudentRememberMode === "remember";
        const expiresAt = Date.now() + EIGHT_HOURS_MS;

        sessionStorage.setItem("ojt_student_logged_in", "true");
        sessionStorage.setItem(REMEMBER_ENABLED_KEY, rememberMode ? "true" : "false");
        sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));

        if(rememberMode){
            copyStudentSession(sessionStorage, localStorage);
            localStorage.setItem(REMEMBER_ENABLED_KEY, "true");
            localStorage.setItem(EXPIRES_KEY, String(expiresAt));
        }else{
            clearRememberedStudent();
        }
    };

    const previousClearStudentSession = typeof clearStudentSession === "function" ? clearStudentSession : null;
    clearStudentSession = function(){
        const forceLogout = window.__pgmoForceStudentLogout === true;
        sessionKeyList(sessionStorage).forEach(key => sessionStorage.removeItem(key));
        sessionStorage.removeItem("student_session_expired");
        if(forceLogout || !rememberedSessionIsValid()){
            clearRememberedStudent();
        }
        if(previousClearStudentSession && forceLogout){
            try{ previousClearStudentSession(); }catch(error){}
        }
    };

    isLoggedIn = function(){
        if(sessionStorage.getItem("ojt_student_logged_in") === "true") return true;
        return window.pgmoHydrateRememberedStudent();
    };

    requireActiveStudentSession = function(){
        window.pgmoHydrateRememberedStudent();

        if(sessionStorage.getItem("ojt_student_logged_in") !== "true"){
            return false;
        }

        const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) || localStorage.getItem(EXPIRES_KEY) || 0);
        if(expiresAt && Date.now() > expiresAt){
            window.__pgmoForceStudentLogout = true;
            clearStudentSession();
            window.__pgmoForceStudentLogout = false;
            sessionStorage.setItem("student_session_expired", "Your session expired after 8 hours. Please log in again.");
            return false;
        }

        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        if(sessionStorage.getItem(REMEMBER_ENABLED_KEY) === "true"){
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        }
        return true;
    };

    const previousLogoutStudent = typeof logoutStudent === "function" ? logoutStudent : null;
    logoutStudent = function(){
        window.__pgmoForceStudentLogout = true;
        clearStudentSession();
        clearRememberedStudent();
        window.__pgmoForceStudentLogout = false;
        window.location.href = "index.html";
    };

    const previousLoginStudent = typeof loginStudent === "function" ? loginStudent : null;
    if(previousLoginStudent){
        loginStudent = async function(event){
            const remember = document.getElementById("rememberMe")?.checked === true;
            const loginIdValue = document.getElementById("loginId")?.value?.trim() || "";
            window.__pgmoStudentRememberMode = remember ? "remember" : "session";
            try{
                const result = await previousLoginStudent(event);
                if(remember && loginIdValue){
                    localStorage.setItem(REMEMBER_LOGIN_ID_KEY, loginIdValue);
                }else if(!remember){
                    localStorage.removeItem(REMEMBER_LOGIN_ID_KEY);
                }
                return result;
            }finally{
                window.__pgmoStudentRememberMode = "";
            }
        };
    }

    function applyRememberMeOnLoginPage(){
        if(document.body?.dataset?.page !== "login") return;
        const loginInput = document.getElementById("loginId");
        const rememberBox = document.getElementById("rememberMe");
        const rememberedLogin = localStorage.getItem(REMEMBER_LOGIN_ID_KEY) || "";

        if(rememberedLogin && loginInput && !loginInput.value){
            loginInput.value = rememberedLogin;
        }
        if(rememberBox){
            rememberBox.checked = rememberedSessionIsValid();
        }
        if(window.pgmoHydrateRememberedStudent()){
            window.location.href = "dashboard.html";
        }
    }

    document.addEventListener("DOMContentLoaded", applyRememberMeOnLoginPage);
})();

/* PGMO FINAL PATCH 2026-07-01: remove DTR auto-fill controls and force preview modal */
(function(){
    function removeDtrAutofillControls(){
        if(document.body?.dataset?.page !== "monthly-dtr") return;
        ["fillWeekdaysButton", "fillAmHalfDaysButton", "fillPmHalfDaysButton"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.remove();
        });
        document.querySelectorAll(".dtr-halfday-note").forEach(el => el.remove());
    }

    function finalBindPrintDtrPreview(){
        if(document.body?.dataset?.page !== "monthly-dtr") return;
        removeDtrAutofillControls();
        const oldButton = document.getElementById("downloadJointDtrPdfButton");
        if(!oldButton || oldButton.dataset.pgmoDtrFinalPreviewBound === "1") return;

        const button = oldButton.cloneNode(true);
        button.type = "button";
        button.removeAttribute("onclick");
        button.removeAttribute("href");
        button.removeAttribute("formaction");
        button.removeAttribute("formmethod");
        button.dataset.pgmoDtrFinalPreviewBound = "1";
        button.innerHTML = '<i class="fa fa-print"></i> Print DTR';
        oldButton.replaceWith(button);

        button.addEventListener("click", function(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            if(typeof window.PGMO_DTR_PREVIEW === "function"){
                window.PGMO_DTR_PREVIEW(event);
            }else if(typeof showToast === "function"){
                showToast("DTR preview is still loading. Please wait a moment and try again.", "warning");
            }else{
                alert("DTR preview is still loading. Please wait a moment and try again.");
            }
            return false;
        }, true);
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", finalBindPrintDtrPreview);
    }else{
        finalBindPrintDtrPreview();
    }
    window.addEventListener("load", finalBindPrintDtrPreview);
})();

/* PGMO FIX 2026-07-01: final DTR print guard, no refresh, preview first */
(function(){
    let lastPrintClick = 0;

    function isDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function hardNotify(message, type){
        if(typeof showToast === "function"){
            showToast(message, type || "info");
        }else{
            console.warn(message);
        }
    }

    function removeOldDtrShortcutControls(){
        ["fillWeekdaysButton", "fillAmHalfDaysButton", "fillPmHalfDaysButton"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.remove();
        });
        document.querySelectorAll(".dtr-halfday-note, .dtr-autofill-note").forEach(el => el.remove());
    }

    async function runDtrPreview(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }

        lastPrintClick = Date.now();
        removeOldDtrShortcutControls();

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.type = "button";
            button.removeAttribute("href");
            button.removeAttribute("formaction");
            button.removeAttribute("formmethod");
        }

        if(typeof window.PGMO_DTR_PREVIEW === "function"){
            try{
                await window.PGMO_DTR_PREVIEW();
            }catch(error){
                console.error("DTR preview failed:", error);
                hardNotify("DTR preview failed. Please reload the page and try again.", "error");
            }
        }else{
            hardNotify("DTR preview is still loading. Please wait a moment and try again.", "warning");
        }
        return false;
    }

    window.PGMO_DTR_HARD_PREVIEW = runDtrPreview;

    function bindHardDtrButton(){
        if(!isDtrPage()) return;
        removeOldDtrShortcutControls();

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.type = "button";
            button.removeAttribute("onclick");
            button.removeAttribute("href");
            button.removeAttribute("formaction");
            button.removeAttribute("formmethod");
            button.dataset.pgmoNoRefreshPreview = "1";
            button.innerHTML = '<i class="fa fa-print"></i> Print DTR';
            button.onclick = function(event){
                return runDtrPreview(event);
            };
        }
    }

    document.addEventListener("click", function(event){
        const button = event.target && event.target.closest ? event.target.closest("#downloadJointDtrPdfButton") : null;
        if(!button || !isDtrPage()) return;
        runDtrPreview(event);
    }, true);

    document.addEventListener("submit", function(event){
        if(!isDtrPage()) return;
        const isRecentPrint = Date.now() - lastPrintClick < 1500;
        const submitter = event.submitter;
        if(isRecentPrint || (submitter && submitter.id === "downloadJointDtrPdfButton")){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            return false;
        }
    }, true);

    const previousDownloadJointMonthlyDtrPdf = typeof window.downloadJointMonthlyDtrPdf === "function" ? window.downloadJointMonthlyDtrPdf : null;
    window.downloadJointMonthlyDtrPdf = function(event){
        return runDtrPreview(event);
    };

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", bindHardDtrButton);
    }else{
        bindHardDtrButton();
    }
    window.addEventListener("load", bindHardDtrButton);
})();

/* PGMO REMOVED: old DTR time formatter. Deletable-colon formatter is in dtr-colon-delete-fix.js. */

/* PGMO FINAL PATCH 2026-07-01: absolute Print DTR no-refresh guard */
(function(){
    const FINAL_BOUND_KEY = "pgmoDtrNoRefreshFinal20260701";

    function isMonthlyDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function notifyDtr(message, type){
        if(typeof showToast === "function"){
            showToast(message, type || "info");
        }else{
            console.warn(message);
        }
    }

    async function openDtrPreviewNoRefresh(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.type = "button";
            button.removeAttribute("form");
            button.removeAttribute("formaction");
            button.removeAttribute("formmethod");
            button.removeAttribute("href");
        }

        if(typeof window.PGMO_DTR_PREVIEW === "function"){
            await window.PGMO_DTR_PREVIEW(event || window.event);
        }else{
            notifyDtr("DTR preview is still loading. Please wait a moment and try again.", "warning");
        }
        return false;
    }

    window.PGMO_DTR_NO_REFRESH_PREVIEW = openDtrPreviewNoRefresh;

    function normalizePrintButton(){
        if(!isMonthlyDtrPage()) return;

        ["fillWeekdaysButton", "fillAmHalfDaysButton", "fillPmHalfDaysButton"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.remove();
        });
        document.querySelectorAll(".dtr-halfday-note, .dtr-autofill-note").forEach(el => el.remove());

        let button = document.getElementById("downloadJointDtrPdfButton");
        if(!button) return;

        if(button.dataset[FINAL_BOUND_KEY] !== "1"){
            const cleanButton = button.cloneNode(true);
            cleanButton.id = "downloadJointDtrPdfButton";
            cleanButton.className = button.className || "outline-green-btn";
            cleanButton.type = "button";
            cleanButton.removeAttribute("href");
            cleanButton.removeAttribute("form");
            cleanButton.removeAttribute("formaction");
            cleanButton.removeAttribute("formmethod");
            cleanButton.dataset[FINAL_BOUND_KEY] = "1";
            cleanButton.innerHTML = '<i class="fa fa-print"></i> Print DTR';
            cleanButton.setAttribute("onclick", "event.preventDefault(); event.stopPropagation(); if(window.PGMO_DTR_NO_REFRESH_PREVIEW){ window.PGMO_DTR_NO_REFRESH_PREVIEW(event); } return false;");
            button.replaceWith(cleanButton);
            button = cleanButton;
        }

        button.onclick = function(event){
            return openDtrPreviewNoRefresh(event);
        };
    }

    document.addEventListener("click", function(event){
        if(!isMonthlyDtrPage()) return;
        const button = event.target && event.target.closest ? event.target.closest("#downloadJointDtrPdfButton") : null;
        if(!button) return;
        openDtrPreviewNoRefresh(event);
    }, true);

    document.addEventListener("submit", function(event){
        if(!isMonthlyDtrPage()) return;
        const submitter = event.submitter || document.activeElement;
        if(submitter && submitter.id === "downloadJointDtrPdfButton"){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            openDtrPreviewNoRefresh(event);
            return false;
        }
    }, true);

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", function(){
            normalizePrintButton();
            setTimeout(normalizePrintButton, 0);
            setTimeout(normalizePrintButton, 250);
        });
    }else{
        normalizePrintButton();
        setTimeout(normalizePrintButton, 0);
        setTimeout(normalizePrintButton, 250);
    }

    window.addEventListener("load", function(){
        normalizePrintButton();
        setTimeout(normalizePrintButton, 250);
    });
})();


/* PGMO FINAL REPAIR 2026-07-01: Clear/Print DTR never refresh, and keep smart colon typing */
(function(){
    function isDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function toast(message, type){
        if(typeof showToast === "function") showToast(message, type || "info");
        else console.warn(message);
    }

    function forceClearDtr(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }
        if(typeof clearMonthlyDtr === "function") clearMonthlyDtr();
        return false;
    }

    async function forcePrintPreview(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }

        const button = document.getElementById("downloadJointDtrPdfButton");
        if(button){
            button.type = "button";
            button.removeAttribute("form");
            button.removeAttribute("href");
            button.removeAttribute("formaction");
            button.removeAttribute("formmethod");
        }

        if(typeof window.PGMO_DTR_PREVIEW === "function"){
            await window.PGMO_DTR_PREVIEW(event || null);
        }else if(typeof downloadJointMonthlyDtrPdf === "function"){
            await downloadJointMonthlyDtrPdf(event || null);
        }else{
            toast("DTR preview is still loading. Please wait a moment and try again.", "warning");
        }
        return false;
    }

    window.PGMO_DTR_FORCE_CLEAR = forceClearDtr;
    window.PGMO_DTR_FORCE_PRINT_PREVIEW = forcePrintPreview;
    window.PGMO_DTR_NO_REFRESH_PREVIEW = forcePrintPreview;
    window.PGMO_DTR_HARD_PREVIEW = forcePrintPreview;

    function normalizeDtrButtons(){
        if(!isDtrPage()) return;

        const clearButton = document.getElementById("clearDtrButton");
        if(clearButton){
            clearButton.type = "button";
            clearButton.removeAttribute("form");
            clearButton.setAttribute("onclick", "return window.PGMO_DTR_FORCE_CLEAR ? window.PGMO_DTR_FORCE_CLEAR(event) : false;");
        }

        const printButton = document.getElementById("downloadJointDtrPdfButton");
        if(printButton){
            printButton.type = "button";
            printButton.removeAttribute("form");
            printButton.removeAttribute("href");
            printButton.removeAttribute("formaction");
            printButton.removeAttribute("formmethod");
            printButton.innerHTML = '<i class="fa fa-print"></i> Print DTR';
            printButton.setAttribute("onclick", "return window.PGMO_DTR_FORCE_PRINT_PREVIEW ? window.PGMO_DTR_FORCE_PRINT_PREVIEW(event) : false;");
        }
    }

    document.addEventListener("click", function(event){
        if(!isDtrPage()) return;
        const clearButton = event.target.closest && event.target.closest("#clearDtrButton");
        if(clearButton) return forceClearDtr(event);

        const printButton = event.target.closest && event.target.closest("#downloadJointDtrPdfButton");
        if(printButton) return forcePrintPreview(event);
    }, true);

    document.addEventListener("submit", function(event){
        if(!isDtrPage()) return;
        const submitter = event.submitter || document.activeElement;
        if(submitter && (submitter.id === "clearDtrButton" || submitter.id === "downloadJointDtrPdfButton")){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            return false;
        }
    }, true);

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", normalizeDtrButtons);
    else normalizeDtrButtons();
    window.addEventListener("load", normalizeDtrButtons);
    setTimeout(normalizeDtrButtons, 50);
    setTimeout(normalizeDtrButtons, 500);
})();


/* PGMO FINAL BACKUP 2026-07-01: expose DTR clear/print helpers for dtr.html early guard */
(function(){
    window.PGMO_CLEAR_DTR_NOW = window.PGMO_CLEAR_DTR_NOW || function(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }
        document.querySelectorAll("#monthlyDtrRows input").forEach(input => input.value = "");
        if(typeof updateMonthlyDtrTotal === "function") updateMonthlyDtrTotal();
        return false;
    };

    window.PGMO_PRINT_DTR_PREVIEW_NOW = window.PGMO_PRINT_DTR_PREVIEW_NOW || async function(event){
        if(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        }
        if(typeof window.PGMO_DTR_PREVIEW === "function"){
            await window.PGMO_DTR_PREVIEW(event || null);
        }else if(typeof showToast === "function"){
            showToast("DTR preview is still loading. Please wait a moment and try again.", "warning");
        }
        return false;
    };
})();


/* PGMO PATCH 2026-07-01: Notification action buttons no-redirect guard
   Fixes Mark All Read / Clear All redirecting to DTR when a notification click layer overlaps. */
(function(){
    "use strict";

    function isNotificationsPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "notifications";
    }

    function stopActionEvent(event){
        if(!event) return;
        event.preventDefault();
        event.stopPropagation();
        if(typeof event.stopImmediatePropagation === "function"){
            event.stopImmediatePropagation();
        }
    }

    function getActionButton(event){
        if(!event || !event.target || typeof event.target.closest !== "function") return null;
        return event.target.closest("#markAllNotificationsRead, #clearNotificationsBtn, .notification-command-btn");
    }

    function setActionButtonsSafe(){
        if(!isNotificationsPage()) return;

        const markAll = document.getElementById("markAllNotificationsRead");
        const clearAll = document.getElementById("clearNotificationsBtn");

        [markAll, clearAll].forEach(function(button){
            if(!button) return;
            button.type = "button";
            button.classList.add("notification-command-btn");
            button.style.position = "relative";
            button.style.zIndex = "10001";
            button.style.pointerEvents = "auto";
        });
    }

    async function runNotificationAction(button){
        if(!button || button.dataset.pgmoActionRunning === "1") return;

        button.dataset.pgmoActionRunning = "1";

        try{
            if(button.id === "markAllNotificationsRead"){
                if(typeof window.markAllNotificationsRead === "function"){
                    await window.markAllNotificationsRead();
                }
            }

            if(button.id === "clearNotificationsBtn"){
                if(typeof window.clearAllNotifications === "function"){
                    await window.clearAllNotifications();
                }
            }
        }finally{
            setTimeout(function(){
                if(button) button.dataset.pgmoActionRunning = "0";
            }, 250);
        }
    }

    ["pointerdown", "mousedown", "touchstart"].forEach(function(eventName){
        document.addEventListener(eventName, function(event){
            if(!isNotificationsPage()) return;
            const button = getActionButton(event);
            if(!button) return;
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function"){
                event.stopImmediatePropagation();
            }
        }, true);
    });

    document.addEventListener("click", function(event){
        if(!isNotificationsPage()) return;

        const button = getActionButton(event);
        if(!button) return;

        stopActionEvent(event);
        runNotificationAction(button);
        return false;
    }, true);

    document.addEventListener("DOMContentLoaded", setActionButtonsSafe);
    window.addEventListener("load", setActionButtonsSafe);
    setTimeout(setActionButtonsSafe, 300);
    setTimeout(setActionButtonsSafe, 1000);
})();


/* PGMO PATCH 2026-07-02: gender registration/profile for certificate pronouns */
(function(){
    "use strict";

    function normalizeStudentGender(value){
        const raw = String(value || "").trim().toLowerCase();
        if(raw === "m" || raw === "male") return "Male";
        if(raw === "f" || raw === "female") return "Female";
        return "";
    }

    if(typeof STUDENT_SESSION_KEYS !== "undefined" && Array.isArray(STUDENT_SESSION_KEYS) && !STUDENT_SESSION_KEYS.includes("ojt_student_gender")){
        STUDENT_SESSION_KEYS.push("ojt_student_gender");
    }

    const previousSetStudentSessionForGender = typeof setStudentSession === "function" ? setStudentSession : null;
    if(previousSetStudentSessionForGender){
        setStudentSession = function(account){
            previousSetStudentSessionForGender(account);
            const gender = normalizeStudentGender(account?.gender || account?.sex || "");
            sessionStorage.setItem("ojt_student_gender", gender);
            try{
                if(localStorage.getItem("ojt_student_logged_in") === "true"){
                    localStorage.setItem("ojt_student_gender", gender);
                }
            }catch(error){}
        };
    }

    const previousGetStudentForGender = typeof getStudent === "function" ? getStudent : null;
    if(previousGetStudentForGender){
        getStudent = function(){
            const student = previousGetStudentForGender();
            student.gender = normalizeStudentGender(sessionStorage.getItem("ojt_student_gender") || localStorage.getItem("ojt_student_gender") || "");
            return student;
        };
    }

    const previousLoadProfileFormForGender = typeof loadProfileForm === "function" ? loadProfileForm : null;
    if(previousLoadProfileFormForGender){
        loadProfileForm = function(){
            previousLoadProfileFormForGender();
            const genderInput = document.getElementById("profileGenderInput");
            if(genderInput){
                const student = typeof getStudent === "function" ? getStudent() : {};
                genderInput.value = normalizeStudentGender(student.gender || "");
            }
        };
    }

    const previousSaveStudentProfileForGender = typeof saveStudentProfile === "function" ? saveStudentProfile : null;
    if(previousSaveStudentProfileForGender){
        saveStudentProfile = async function(event){
            const gender = normalizeStudentGender(document.getElementById("profileGenderInput")?.value || "");
            if(!gender){
                if(event){ event.preventDefault(); event.stopPropagation(); }
                if(typeof showToast === "function") showToast("Please select your gender.", "error");
                else alert("Please select your gender.");
                return;
            }

            await previousSaveStudentProfileForGender(event);

            if(typeof initSupabase !== "function" || !initSupabase()) return;
            const current = typeof getStudent === "function" ? getStudent() : {};
            const update = { gender, updated_at: new Date().toISOString() };
            let query = supabaseClient.from(getStudentAccountsTable()).update(update);
            if(current.accountId) query = query.eq("id", current.accountId);
            else query = query.eq("student_id", current.id || document.getElementById("profileStudentIdInput")?.value || "");
            const { error } = await query;
            if(error){
                if(typeof showToast === "function") showToast("Gender was not saved. Run the gender SQL patch first. " + error.message, "error");
                return;
            }
            sessionStorage.setItem("ojt_student_gender", gender);
            try{ if(localStorage.getItem("ojt_student_logged_in") === "true") localStorage.setItem("ojt_student_gender", gender); }catch(error){}
            if(typeof showToast === "function") showToast("Profile updated successfully.");
        };
    }

    const previousRegisterStudentForGender = typeof registerStudent === "function" ? registerStudent : null;
    if(previousRegisterStudentForGender){
        registerStudent = async function(event){
            if(event){ event.preventDefault(); }
            if(typeof initSupabase !== "function" || !initSupabase()) return;

            const guideAcceptedInput = document.getElementById("studentIdGuideAccepted");
            if(guideAcceptedInput && guideAcceptedInput.value !== "true"){
                if(typeof showRequiredStudentIdGuide === "function") showRequiredStudentIdGuide();
                if(typeof showToast === "function") showToast("Please read and accept the Student ID guide before registering.", "error");
                else alert("Please read and accept the Student ID guide before registering.");
                return;
            }

            const lastName = getInputValue("registerLastName").toUpperCase();
            const firstName = getInputValue("registerFirstName");
            const middleInitial = getInputValue("registerMiddleInitial").toUpperCase().charAt(0);
            const studentId = getInputValue("registerStudentId").toUpperCase();
            const registrationCode = typeof normalizeRegistrationCode === "function" ? normalizeRegistrationCode(getInputValue("registerCode")) : getInputValue("registerCode").toUpperCase();
            const email = getInputValue("registerEmail").toLowerCase();
            const contactNumber = typeof normalizeContactNumber === "function" ? normalizeContactNumber(getInputValue("registerContact")) : getInputValue("registerContact");
            const contactInput = document.getElementById("registerContact");
            if(contactInput) contactInput.value = contactNumber;
            const course = getInputValue("registerCourse");
            const gender = normalizeStudentGender(document.getElementById("registerGender")?.value || "");
            const password = getInputValue("registerPassword");
            const confirmPassword = getInputValue("confirmPassword");
            const termsCheck = document.getElementById("termsCheck") ? document.getElementById("termsCheck").checked : false;

            if(!lastName || !firstName || !studentId || !registrationCode || !email || !contactNumber || !course || !gender || !password || !confirmPassword){
                if(typeof showToast === "function") showToast("Please complete all required fields, including gender and your registration code.", "error");
                return;
            }

            if(contactNumber.length !== 11){
                if(typeof showToast === "function") showToast("Contact number must be exactly 11 digits.", "error");
                return;
            }

            if(typeof validateSecureStudentPassword === "function"){
                const passwordResult = validateSecureStudentPassword(password);
                if(!passwordResult.ok){
                    if(typeof showToast === "function") showToast(securePasswordMessage(passwordResult.rules), "error");
                    return;
                }
            }else if(password.length < 8){
                if(typeof showToast === "function") showToast("Password must be at least 8 characters.", "error");
                return;
            }

            if(password !== confirmPassword){
                if(typeof showToast === "function") showToast("Password and confirm password do not match.", "error");
                return;
            }

            if(!termsCheck){
                if(typeof showToast === "function") showToast("Please agree to the Terms of Service and Privacy Policy.", "error");
                return;
            }

            const button = event?.target?.querySelector("button[type='submit']");
            const originalText = button ? button.innerHTML : "";
            if(button){
                button.disabled = true;
                button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Verifying access...`;
            }

            const passwordHash = await hashPassword(password);
            const { data, error } = await supabaseClient.rpc("secure_register_student", {
                p_student_id: studentId,
                p_email: email,
                p_registration_code: registrationCode,
                p_last_name: lastName,
                p_first_name: firstName,
                p_middle_initial: middleInitial,
                p_contact_number: contactNumber,
                p_course: course,
                p_password_hash: passwordHash
            });

            if(error){
                if(button){ button.disabled = false; button.innerHTML = originalText; }
                const message = String(error.message || "");
                if(message.toLowerCase().includes("secure_register_student")){
                    if(typeof showToast === "function") showToast("Secure registration is not installed yet. Run admin-integration/database/supabase_secure_invite_registration.sql in Supabase first.", "error");
                    return;
                }
                if(typeof showToast === "function") showToast(message, "error");
                return;
            }

            const result = Array.isArray(data) ? data[0] : data;
            if(!result || result.ok !== true){
                if(button){ button.disabled = false; button.innerHTML = originalText; }
                if(typeof showToast === "function") showToast(result?.message || "Registration denied. Please check your last name, Student ID, email, and registration code.", "error");
                return;
            }

            const { error: genderError } = await supabaseClient
                .from(getStudentAccountsTable())
                .update({ gender, updated_at: new Date().toISOString() })
                .eq("student_id", studentId)
                .eq("email", email);

            if(button){ button.disabled = false; button.innerHTML = originalText; }

            if(genderError){
                if(typeof showToast === "function") showToast("Account was created, but gender was not saved. Run database/supabase_gender_certificate_patch.sql, then update your profile gender.", "error");
                return;
            }

            window.__pgmoForceStudentLogout = true;
            if(typeof clearStudentSession === "function") clearStudentSession();
            window.__pgmoForceStudentLogout = false;
            sessionStorage.setItem("registration_success", "Account created successfully. Please log in.");
            window.location.href = "index.html";
        };
    }
})();


/* PGMO PATCH 2026-07-02: live header without 0/avatar flash + polished loaders
   No invisible buttons are added here. This only updates visible text, badges, avatars,
   and loading animations. */
(function(){
    "use strict";

    const AVATAR_SELECTOR = ".mini-avatar, .top-avatar, #profilePicturePreview";
    const FAILED_AVATAR_URLS = new Set();

    function esc(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function storageValue(key){
        return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
    }

    function preferredAvatarUrl(){
        return storageValue("ojt_student_profile_picture_url");
    }

    function storedDisplayName(){
        const last = storageValue("ojt_student_last_name");
        const first = storageValue("ojt_student_first_name");
        const middle = storageValue("ojt_student_middle_initial");
        if(typeof formatStudentFullName === "function"){
            const formatted = formatStudentFullName(last, first, middle);
            if(formatted) return formatted;
        }
        return storageValue("ojt_student_name") || "Student";
    }

    function paintStableAvatarElement(el, url){
        if(!el) return;

        const currentUrl = el.getAttribute("data-avatar-url") || "";
        if(url && currentUrl === url && (el.classList.contains("has-profile-image") || el.classList.contains("avatar-loading"))){
            return;
        }

        if(!url || FAILED_AVATAR_URLS.has(url)){
            const alreadyFallback = !currentUrl && !el.querySelector("img") && !!el.querySelector("i.fa-user");
            if(alreadyFallback) return;
            el.removeAttribute("data-avatar-url");
            el.classList.remove("has-profile-image", "has-image", "avatar-loading");
            el.innerHTML = '<i class="fa fa-user"></i>';
            return;
        }

        el.setAttribute("data-avatar-url", url);
        el.classList.add("avatar-loading");
        el.innerHTML = `
            <i class="fa fa-user avatar-fallback-icon"></i>
            <img src="${esc(url)}" alt="Profile Picture" loading="eager" decoding="async">
        `;

        const img = el.querySelector("img");
        if(!img) return;

        const markLoaded = () => {
            el.classList.add("has-profile-image", "has-image");
            el.classList.remove("avatar-loading");
        };

        const markError = () => {
            FAILED_AVATAR_URLS.add(url);
            el.removeAttribute("data-avatar-url");
            el.classList.remove("has-profile-image", "has-image", "avatar-loading");
            el.innerHTML = '<i class="fa fa-user"></i>';
        };

        img.addEventListener("load", markLoaded, {once:true});
        img.addEventListener("error", markError, {once:true});

        if(img.complete && img.naturalWidth > 0) markLoaded();
    }

    function paintStableAvatar(url = preferredAvatarUrl()){
        document.querySelectorAll(AVATAR_SELECTOR).forEach(el => paintStableAvatarElement(el, url));
    }

    function hideZeroNotificationBadge(){
        const badge = document.getElementById("notificationBadge");
        if(!badge) return;
        const count = Number(sessionStorage.getItem("student_live_unread_count") || "0");
        if(count > 0){
            badge.textContent = String(count);
            badge.style.display = "inline-flex";
            badge.classList.add("badge-pulse");
        }else{
            badge.textContent = "";
            badge.style.display = "none";
            badge.classList.remove("badge-pulse");
        }
    }

    function hydrateHeaderInstantly(){
        const name = storedDisplayName();
        const id = storageValue("ojt_student_id") || "STU-000";
        const school = storageValue("ojt_student_school");
        const course = storageValue("ojt_student_course");
        const office = storageValue("ojt_student_office");

        const nameEl = document.getElementById("miniStudentName");
        if(nameEl) nameEl.textContent = name || "Student";

        const idEl = document.getElementById("miniStudentId");
        if(idEl) idEl.textContent = id;

        const detailsEl = document.getElementById("studentDetailsDisplay");
        if(detailsEl && id){
            const pieces = [id, school, course, office].filter(Boolean);
            if(pieces.length > 1) detailsEl.textContent = pieces.join(" · ");
        }

        hideZeroNotificationBadge();
        paintStableAvatar();
        document.body?.classList.add("student-live-hydrated");
    }

    const previousSetStudentSession = typeof setStudentSession === "function" ? setStudentSession : null;
    if(previousSetStudentSession){
        setStudentSession = function(account){
            const oldProfileUrl = preferredAvatarUrl();
            if(account && !account.profile_picture_url && oldProfileUrl){
                account = Object.assign({}, account, {profile_picture_url: oldProfileUrl});
            }
            previousSetStudentSession(account);
            hydrateHeaderInstantly();
        };
    }

    const previousUpdateStats = typeof updateStats === "function" ? updateStats : null;
    if(previousUpdateStats){
        updateStats = function(){
            previousUpdateStats();
            hideZeroNotificationBadge();
        };
    }

    const previousRenderSidebarProfilePicture = typeof renderSidebarProfilePicture === "function" ? renderSidebarProfilePicture : null;
    window.renderSidebarProfilePicture = function(){
        paintStableAvatar();
        if(previousRenderSidebarProfilePicture){
            // Repaint after the old function in case it rewrites the avatar.
            setTimeout(() => paintStableAvatar(), 0);
        }
    };

    const previousApplyProfilePicture = typeof applyProfilePicture === "function" ? applyProfilePicture : null;
    window.applyProfilePicture = function(url){
        const finalUrl = url || preferredAvatarUrl();
        if(previousApplyProfilePicture) previousApplyProfilePicture(finalUrl);
        paintStableAvatar(finalUrl);
    };

    function polishExistingLoadingStates(){
        document.querySelectorAll(".empty-state, .notification-loading-state").forEach((el, index) => {
            if(el.dataset.liveAnimated === "1") return;
            el.dataset.liveAnimated = "1";
            el.style.setProperty("--stagger", `${Math.min(index, 8) * 50}ms`);
            el.classList.add("pgmo-live-loader");
        });
    }

    function observeNewLoaders(){
        // PERFORMANCE FIX: throttle loader polishing and do not repaint avatars on every DOM mutation.
        // Repainting avatars inside a body-wide MutationObserver can loop forever if an image URL fails.
        let pending = false;
        const observer = new MutationObserver(() => {
            if(pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                hideZeroNotificationBadge();
                polishExistingLoadingStates();
            });
        });
        observer.observe(document.body, {childList:true, subtree:true});
        setTimeout(() => observer.disconnect(), 10000);
    }

    document.addEventListener("DOMContentLoaded", function(){
        hydrateHeaderInstantly();
        polishExistingLoadingStates();
        observeNewLoaders();
    });

    window.addEventListener("pageshow", hydrateHeaderInstantly);
})();

document.addEventListener("click", async function(event){
    const button = event.target.closest(".support-copy-btn");
    if(!button) return;

    const email = button.dataset.email || "";
    if(!email) return;

    try{
        await navigator.clipboard.writeText(email);

        const originalText = button.innerHTML;
        button.classList.add("copied");
        button.innerHTML = `<i class="fa fa-check"></i> Copied`;

        if(typeof showToast === "function"){
            showToast("Email copied: " + email);
        }

        setTimeout(() => {
            button.classList.remove("copied");
            button.innerHTML = originalText;
        }, 1500);
    }catch(error){
        if(typeof showToast === "function"){
            showToast("Email: " + email);
        }else{
            alert("Email: " + email);
        }
    }
});

/* PGMO DOCUMENT PREVIEW MODAL - Student side */
function pgmoDocumentPreviewAttr(value){
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function pgmoDocumentPreviewExtension(fileUrl, fileName){
    const cleanName = String(fileName || fileUrl || "").split("?")[0].split("#")[0].toLowerCase();
    const parts = cleanName.split(".");
    return parts.length > 1 ? parts.pop() : "";
}

function pgmoEnsureDocumentPreviewModal(){
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
        if(typeof showToast === "function") showToast("Document link is not available.", "error");
        return;
    }

    const modal = pgmoEnsureDocumentPreviewModal();
    const title = document.getElementById("pgmoDocumentPreviewTitle");
    const subtitle = document.getElementById("pgmoDocumentPreviewSubtitle");
    const body = document.getElementById("pgmoDocumentPreviewBody");
    const openLink = document.getElementById("pgmoDocumentPreviewOpen");
    const ext = pgmoDocumentPreviewExtension(fileUrl, fileName);
    const safeFileName = pgmoDocumentPreviewAttr(fileName || "Document");
    const safeType = pgmoDocumentPreviewAttr(fileType || ext.toUpperCase() || "Document");
    const encodedUrl = encodeURI(fileUrl);

    if(title) title.textContent = fileName || "Document Preview";
    if(subtitle) subtitle.textContent = safeType.replace(/&amp;/g, "&");
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

function setupPgmoDocumentPreviewButtons(){
    if(window.__pgmoDocumentPreviewButtonsReady) return;
    window.__pgmoDocumentPreviewButtonsReady = true;

    document.addEventListener("click", function(event){
        const originalLink = event.target.closest('[data-open-original="true"]');
        if(originalLink){
            const href = originalLink.getAttribute("href") || "";
            if(!href || href === "#"){
                event.preventDefault();
                if(typeof showToast === "function") showToast("Document link is not available.", "error");
            }
            return;
        }

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

setupPgmoDocumentPreviewButtons();

/* PGMO LIVE DASHBOARD REQUIREMENTS GRAPH
   Counts the full checklist, including requirements that are still missing.
   No hour-based progress is used on the dashboard card. */

const DASHBOARD_REQUIRED_DOCUMENTS = [
    "Endorsement from School",
    "Application Letter",
    "Certificate of Registration/Enrollment",
    "Biodata/Resume",
    "Medical Certificate",
    "Parent/Guardian Waiver",
    "Police Clearance",
    "MOA/MOU",
    "Endorsement Letter from Hosting Office",
    "Daily Time Record (DTR)",
    "School Performance Evaluation Form",
    "Accomplishment Report",
    "Certificate of Completion",
    "OJT Feedback Form"
];

function pgmoDashboardSetText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
}

function getDashboardRequirementStatus(files, dtrForms, requirement){
    if(typeof getRequirementStatus === "function"){
        return getRequirementStatus(requirement, files || [], dtrForms || []);
    }

    const matching = (files || []).filter(file =>
        String(file.document_type || "").trim().toLowerCase() === String(requirement || "").trim().toLowerCase()
    );

    if(!matching.length) return "Missing";

    if(matching.some(file => String(file.status || "").toLowerCase() === "approved")){
        return "Approved";
    }

    if(matching.some(file => String(file.status || "").toLowerCase() === "pending")){
        return "Pending";
    }

    if(matching.some(file => ["returned", "rejected"].includes(String(file.status || "").toLowerCase()))){
        return "Returned";
    }

    return "Missing";
}

function updateRequirementsDonut(approved, pending, returned, missing){
    const donut = document.getElementById("dashboardRequirementsDonut");
    if(!donut) return;

    const total = approved + pending + returned + missing;

    if(total <= 0){
        donut.style.background = "#e5e7eb";
        return;
    }

    const approvedDeg = (approved / total) * 360;
    const pendingDeg = approvedDeg + ((pending / total) * 360);
    const returnedDeg = pendingDeg + ((returned / total) * 360);

    donut.style.background = `
        conic-gradient(
            #16a34a 0deg ${approvedDeg}deg,
            #f59e0b ${approvedDeg}deg ${pendingDeg}deg,
            #ef4444 ${pendingDeg}deg ${returnedDeg}deg,
            #d1d5db ${returnedDeg}deg 360deg
        )
    `;
}

async function loadDashboardRequirementsGraph(){
    if(document.body?.dataset?.page !== "dashboard") return;
    if(!initSupabase()) return;

    const student = getStudent();
    if(!student.id) return;

    const uploadsTable = typeof OJT_UPLOADS_TABLE !== "undefined" ? OJT_UPLOADS_TABLE : "ojt_uploads";
    const dtrTable = typeof OJT_DTR_FORMS_TABLE !== "undefined" ? OJT_DTR_FORMS_TABLE : "ojt_dtr_forms";

    const { data: files, error } = await supabaseClient
        .from(uploadsTable)
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", {ascending:false});

    if(error){
        console.error("Dashboard requirements graph error:", error);
        const reqDonut = document.getElementById("dashboardRequirementsDonut");
        if(reqDonut) reqDonut.classList.remove("loading");
        pgmoDashboardSetText("dashboardRequirementMessage", "Could not load requirement status.");
        return;
    }

    let dtrForms = [];

    try{
        const { data: forms } = await supabaseClient
            .from(dtrTable)
            .select("*")
            .eq("student_id", student.id)
            .order("created_at", {ascending:false});

        dtrForms = forms || [];
    }catch(dtrError){
        console.warn("Dashboard DTR requirement status fallback:", dtrError?.message || dtrError);
    }

    let approved = 0;
    let pending = 0;
    let returned = 0;
    let missing = 0;

    DASHBOARD_REQUIRED_DOCUMENTS.forEach(requirement => {
        const status = getDashboardRequirementStatus(files || [], dtrForms, requirement);

        if(status === "Approved") approved++;
        else if(status === "Pending") pending++;
        else if(status === "Returned") returned++;
        else missing++;
    });

    const total = DASHBOARD_REQUIRED_DOCUMENTS.length;
    const missingPercent = total > 0 ? Math.round((missing / total) * 100) : 0;

    pgmoDashboardSetText("dashboardApprovedRequirements", approved);
    pgmoDashboardSetText("dashboardPendingRequirements", pending);
    pgmoDashboardSetText("dashboardReturnedRequirements", returned);
    pgmoDashboardSetText("dashboardMissingRequirements", missing);
    pgmoDashboardSetText("dashboardMissingFocus", missing);

    const oldPercent = document.getElementById("dashboardRequirementPercent");
    if(oldPercent) oldPercent.textContent = `${missingPercent}%`;

    updateRequirementsDonut(approved, pending, returned, missing);

    let message = `${missing} of ${total} requirements are still missing. This graph includes missing items, not only submitted files.`;

    if(approved === total){
        message = "All requirements are approved. You are ready for final checking.";
    }else if(returned > 0){
        message = `${returned} requirement(s) were returned. Please review the admin remarks.`;
    }else if(pending > 0){
        message = `${pending} submitted requirement(s) are waiting for admin review. Missing items are still counted.`;
    }else if(missing > 0){
        message = `You still need to upload ${missing} missing requirement(s).`;
    }

    pgmoDashboardSetText("dashboardRequirementMessage", message);
}

document.addEventListener("DOMContentLoaded", loadDashboardRequirementsGraph);

/* PGMO LIVE DASHBOARD HOURS GRAPH
   Replaces the old upload shortcut card with approved DTR hours progress.
   This does not change DTR logic. It only reads the saved student hour totals. */

function pgmoFormatDashboardHourValue(value){
    const number = Number(value || 0);
    if(!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.00$/, "");
}

function pgmoAnimateConicDonut(donut, options){
    if(!donut) return;

    const config = Object.assign({
        percent: 0,
        primary: "#16a34a",
        secondary: "#d1d5db",
        duration: 900,
        centerId: "",
        centerSuffix: "%"
    }, options || {});

    const targetPercent = Math.max(0, Math.min(Number(config.percent || 0), 100));
    const startTime = performance.now();

    donut.classList.remove("loading");

    function frame(now){
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / config.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentPercent = targetPercent * eased;
        const currentDeg = (currentPercent / 100) * 360;

        donut.style.background = `conic-gradient(${config.primary} 0deg ${currentDeg}deg, ${config.secondary} ${currentDeg}deg 360deg)`;

        if(config.centerId){
            const center = document.getElementById(config.centerId);
            if(center) center.textContent = `${Math.round(currentPercent)}${config.centerSuffix}`;
        }

        if(progress < 1){
            requestAnimationFrame(frame);
        }else if(config.centerId){
            const center = document.getElementById(config.centerId);
            if(center) center.textContent = `${Math.round(targetPercent)}${config.centerSuffix}`;
        }
    }

    requestAnimationFrame(frame);
}

function updateDashboardHoursDonut(completedHours, requiredHours){
    const donut = document.getElementById("dashboardHoursDonut");
    const percent = requiredHours > 0 ? Math.min((completedHours / requiredHours) * 100, 100) : 0;

    if(requiredHours <= 0){
        if(donut){
            donut.classList.remove("loading");
            donut.style.background = "#e5e7eb";
        }
        pgmoDashboardSetText("dashboardHoursPercent", "0%");
        return;
    }

    pgmoAnimateConicDonut(donut, {
        percent,
        primary: "#16a34a",
        secondary: "#d1d5db",
        duration: 950,
        centerId: "dashboardHoursPercent",
        centerSuffix: "%"
    });
}

async function loadDashboardHoursGraph(){
    if(document.body?.dataset?.page !== "dashboard") return;
    if(!initSupabase()) return;

    const student = getStudent();
    if(!student.id && !student.accountId) return;

    const donut = document.getElementById("dashboardHoursDonut");
    if(donut) donut.classList.add("loading");

    let account = null;

    try{
        let query = supabaseClient
            .from(getStudentAccountsTable())
            .select("*")
            .limit(1);

        if(student.accountId){
            query = query.eq("id", student.accountId);
        }else{
            query = query.eq("student_id", student.id);
        }

        const { data, error } = await query;

        if(error){
            throw new Error(error.message);
        }

        account = data && data.length ? data[0] : null;

        if(account && typeof setStudentSession === "function"){
            setStudentSession(account);
        }
    }catch(error){
        console.error("Dashboard hours graph error:", error);
        pgmoDashboardSetText("dashboardHoursMessage", "Could not load your approved DTR hours.");
        if(donut) donut.classList.remove("loading");
        return;
    }

    const liveStudent = getStudent();
    const completedHours = Number(account?.completed_hours ?? liveStudent.completedHours ?? 0);
    const requiredHours = Number(account?.required_hours ?? liveStudent.requiredHours ?? 0);
    const remainingHours = requiredHours > 0 ? Math.max(requiredHours - completedHours, 0) : 0;
    const percent = requiredHours > 0 ? Math.min(Math.round((completedHours / requiredHours) * 100), 100) : 0;
    const estimatedDate = typeof getEstimatedCompletionDate === "function"
        ? getEstimatedCompletionDate(completedHours, requiredHours)
        : (requiredHours > 0 && remainingHours <= 0 ? "Completed" : "Not set");
    const statusText = requiredHours > 0 && completedHours >= requiredHours
        ? "Completed"
        : completedHours > 0
            ? "Ongoing"
            : "Pending";

    pgmoDashboardSetText("dashboardCompletedHours", pgmoFormatDashboardHourValue(completedHours));
    pgmoDashboardSetText("dashboardRequiredHours", requiredHours > 0 ? pgmoFormatDashboardHourValue(requiredHours) : "Not set");
    pgmoDashboardSetText("dashboardEstimatedDate", estimatedDate);
    pgmoDashboardSetText("dashboardHoursStatus", statusText);

    const statusDot = document.querySelector(".hour-status.status");
    if(statusDot){
        statusDot.classList.toggle("completed", statusText === "Completed");
    }

    let message = "Your approved DTR hours will appear here once your coordinator approves them.";

    if(requiredHours <= 0){
        message = "Required hours are not set yet. Please contact your coordinator.";
    }else if(statusText === "Completed"){
        message = `You completed ${pgmoFormatDashboardHourValue(completedHours)} of ${pgmoFormatDashboardHourValue(requiredHours)} required hours.`;
    }else{
        message = `${percent}% completed. Estimated completion: ${estimatedDate}.`;
    }

    pgmoDashboardSetText("dashboardHoursMessage", message);
    updateDashboardHoursDonut(completedHours, requiredHours);
}

/* Override requirements donut so it also animates when the dashboard loads. */
function updateRequirementsDonut(approved, pending, returned, missing){
    const donut = document.getElementById("dashboardRequirementsDonut");
    if(!donut) return;

    const total = approved + pending + returned + missing;

    donut.classList.remove("loading");

    if(total <= 0){
        donut.style.background = "#e5e7eb";
        return;
    }

    const targetApproved = (approved / total) * 360;
    const targetPending = targetApproved + ((pending / total) * 360);
    const targetReturned = targetPending + ((returned / total) * 360);
    const startTime = performance.now();
    const duration = 900;

    function frame(now){
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const approvedDeg = targetApproved * eased;
        const pendingDeg = targetPending * eased;
        const returnedDeg = targetReturned * eased;

        donut.style.background = `
            conic-gradient(
                #16a34a 0deg ${approvedDeg}deg,
                #f59e0b ${approvedDeg}deg ${pendingDeg}deg,
                #ef4444 ${pendingDeg}deg ${returnedDeg}deg,
                #d1d5db ${returnedDeg}deg 360deg
            )
        `;

        if(progress < 1){
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}

document.addEventListener("DOMContentLoaded", loadDashboardHoursGraph);

/* PGMO STUDENT LIVE SIGN-IN LOADING ANIMATION */
(function(){
    const LOGIN_TOTAL_DURATION = 1700;
    const LOGIN_REDIRECT_DELAY = 180;
    let loginAnimationStarted = false;

    function createLoginOverlay(){
        let overlay = document.getElementById("pgmoLoginOverlay");
        if(overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "pgmoLoginOverlay";
        overlay.className = "pgmo-logout-overlay pgmo-login-overlay";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");
        overlay.innerHTML = `
            <div class="pgmo-logout-particles" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
            </div>

            <div class="pgmo-logout-card pgmo-login-card">
                <div class="pgmo-logout-seal-wrap" aria-hidden="true">
                    <span class="pgmo-logout-orbit orbit-one"></span>
                    <span class="pgmo-logout-orbit orbit-two"></span>
                    <span class="pgmo-logout-orbit orbit-three"></span>
                    <div class="pgmo-logout-ring"></div>
                    <img class="pgmo-logout-seal" src="assets/img/pgmoseal.png" alt="PGMO Seal">
                </div>

                <h2>Signing you in</h2>
                <p id="pgmoLoginStatus">Verifying your student access...</p>

                <div class="pgmo-logout-meter" aria-label="Sign in loading progress">
                    <span id="pgmoLoginMeterFill"></span>
                </div>

                <div class="pgmo-logout-bottomline">
                    <small id="pgmoLoginPercent">0%</small>
                    <small id="pgmoLoginStep">Starting</small>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function updateLoginText(progress){
        const status = document.getElementById("pgmoLoginStatus");
        const step = document.getElementById("pgmoLoginStep");

        if(!status || !step) return;

        if(progress < 30){
            status.textContent = "Verifying your student access...";
            step.textContent = "Checking account";
        }else if(progress < 62){
            status.textContent = "Preparing your portal session...";
            step.textContent = "Loading records";
        }else if(progress < 88){
            status.textContent = "Opening your dashboard...";
            step.textContent = "Almost ready";
        }else{
            status.textContent = "Welcome back. Redirecting...";
            step.textContent = "Complete";
        }
    }

    window.pgmoStartStudentLoginAnimation = function(redirectUrl = "dashboard.html"){
        if(loginAnimationStarted || window.__pgmoStudentLoginRunning){
            return;
        }

        loginAnimationStarted = true;
        window.__pgmoStudentLoginRunning = true;

        const loginButton = document.querySelector("#loginForm button[type='submit']");
        if(loginButton){
            loginButton.disabled = true;
            loginButton.setAttribute("aria-busy", "true");
            loginButton.classList.add("is-signing-in");
        }

        const overlay = createLoginOverlay();
        const fill = overlay.querySelector("#pgmoLoginMeterFill");
        const percentLabel = overlay.querySelector("#pgmoLoginPercent");

        document.body.classList.add("pgmo-login-active");

        requestAnimationFrame(() => {
            overlay.classList.add("show");
        });

        const start = performance.now();

        function animate(now){
            const elapsed = now - start;
            const rawProgress = Math.min(elapsed / LOGIN_TOTAL_DURATION, 1);
            const eased = 1 - Math.pow(1 - rawProgress, 3);
            const progress = Math.round(eased * 100);

            if(fill) fill.style.width = progress + "%";
            if(percentLabel) percentLabel.textContent = progress + "%";
            updateLoginText(progress);

            if(rawProgress < 1){
                requestAnimationFrame(animate);
            }else{
                setTimeout(() => {
                    window.location.href = redirectUrl;
                }, LOGIN_REDIRECT_DELAY);
            }
        }

        requestAnimationFrame(animate);
    };
})();


/* PGMO STUDENT LIVE LOGOUT LOADING ANIMATION */
(function(){
    const LOGOUT_TOTAL_DURATION = 1900;
    const LOGOUT_REDIRECT_DELAY = 220;
    let logoutAnimationStarted = false;

    function createLogoutOverlay(){
        let overlay = document.getElementById("pgmoLogoutOverlay");
        if(overlay) return overlay;

        overlay = document.createElement("div");
        overlay.id = "pgmoLogoutOverlay";
        overlay.className = "pgmo-logout-overlay";
        overlay.setAttribute("role", "status");
        overlay.setAttribute("aria-live", "polite");
        overlay.innerHTML = `
            <div class="pgmo-logout-particles" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span>
            </div>

            <div class="pgmo-logout-card">
                <div class="pgmo-logout-seal-wrap" aria-hidden="true">
                    <span class="pgmo-logout-orbit orbit-one"></span>
                    <span class="pgmo-logout-orbit orbit-two"></span>
                    <span class="pgmo-logout-orbit orbit-three"></span>
                    <div class="pgmo-logout-ring"></div>
                    <img class="pgmo-logout-seal" src="assets/img/pgmoseal.png" alt="PGMO Seal">
                </div>

                <h2>Signing you out</h2>
                <p id="pgmoLogoutStatus">Preparing secure logout...</p>

                <div class="pgmo-logout-meter" aria-label="Logout loading progress">
                    <span id="pgmoLogoutMeterFill"></span>
                </div>

                <div class="pgmo-logout-bottomline">
                    <small id="pgmoLogoutPercent">0%</small>
                    <small id="pgmoLogoutStep">Starting</small>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function updateLogoutText(progress){
        const status = document.getElementById("pgmoLogoutStatus");
        const step = document.getElementById("pgmoLogoutStep");

        if(!status || !step) return;

        if(progress < 28){
            status.textContent = "Preparing secure logout...";
            step.textContent = "Checking session";
        }else if(progress < 58){
            status.textContent = "Clearing your student session...";
            step.textContent = "Securing data";
        }else if(progress < 86){
            status.textContent = "Closing portal access...";
            step.textContent = "Almost done";
        }else{
            status.textContent = "Redirecting to login...";
            step.textContent = "Complete";
        }
    }

    function safelyClearStudentData(){
        window.__pgmoForceStudentLogout = true;

        if(typeof clearStudentSession === "function"){
            try{ clearStudentSession(); }catch(error){ console.warn("Student session clear warning:", error); }
        }

        try{
            Object.keys(localStorage).forEach(key => {
                if(key.startsWith("ojt_student_") || key === "student_live_unread_count"){
                    localStorage.removeItem(key);
                }
            });
        }catch(error){}

        try{
            Object.keys(sessionStorage).forEach(key => {
                if(key.startsWith("ojt_student_") || key === "student_live_unread_count"){
                    sessionStorage.removeItem(key);
                }
            });
        }catch(error){}
    }

    function closeMobileChromeForLogout(){
        document.body.classList.remove("mobile-menu-open");

        if(typeof window.pgmoCloseStudentMobileMenu === "function"){
            try{ window.pgmoCloseStudentMobileMenu(); }catch(error){}
        }

        const menuBtn = document.getElementById("mobileMenuBtn");
        const icon = menuBtn ? menuBtn.querySelector("i") : null;

        if(menuBtn){
            menuBtn.setAttribute("aria-expanded", "false");
        }

        if(icon){
            icon.classList.add("fa-bars");
            icon.classList.remove("fa-xmark");
        }
    }

    window.pgmoStartStudentLogoutAnimation = function(){
        if(logoutAnimationStarted || window.__pgmoStudentLogoutRunning){
            return;
        }

        logoutAnimationStarted = true;
        window.__pgmoStudentLogoutRunning = true;
        closeMobileChromeForLogout();

        const logoutButton = document.getElementById("logoutButton");
        if(logoutButton){
            logoutButton.disabled = true;
            logoutButton.setAttribute("aria-busy", "true");
            logoutButton.classList.add("is-logging-out");
        }

        const overlay = createLogoutOverlay();
        const fill = overlay.querySelector("#pgmoLogoutMeterFill");
        const percentLabel = overlay.querySelector("#pgmoLogoutPercent");

        document.body.classList.add("pgmo-logout-active");

        requestAnimationFrame(() => {
            overlay.classList.add("show");
        });

        const start = performance.now();
        let sessionCleared = false;

        function animate(now){
            const elapsed = now - start;
            const rawProgress = Math.min(elapsed / LOGOUT_TOTAL_DURATION, 1);
            const eased = 1 - Math.pow(1 - rawProgress, 3);
            const progress = Math.round(eased * 100);

            if(fill) fill.style.width = progress + "%";
            if(percentLabel) percentLabel.textContent = progress + "%";
            updateLogoutText(progress);

            if(progress >= 62 && !sessionCleared){
                sessionCleared = true;
                safelyClearStudentData();
            }

            if(rawProgress < 1){
                requestAnimationFrame(animate);
            }else{
                if(!sessionCleared){
                    safelyClearStudentData();
                }

                setTimeout(() => {
                    window.location.href = "index.html";
                }, LOGOUT_REDIRECT_DELAY);
            }
        }

        requestAnimationFrame(animate);
    };

    /* Capture the click first so old logout handlers cannot instantly redirect before the animation. */
    document.addEventListener("click", function(event){
        const button = event.target.closest("#logoutButton");
        if(!button) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        window.pgmoStartStudentLogoutAnimation();
    }, true);
})();

/* PGMO PATCH 2026-07-16: stable notifications page loader + no card repaint flicker */
(function(){
    let notificationLoadStarted = false;
    let notificationLoadPromise = null;
    let notificationItemsCache = null;

    function pageIsNotifications(){
        return document.body && document.body.dataset && document.body.dataset.page === "notifications";
    }

    function safeText(value){
        if(typeof notificationSafeText === "function") return notificationSafeText(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function iconForNotification(item){
        if(typeof notificationIcon === "function") return notificationIcon(item.type);
        const text = `${item.title || ""} ${item.message || ""} ${item.type || ""}`.toLowerCase();
        if(text.includes("approve") || text.includes("ready") || text.includes("success")) return "fa-circle-check";
        if(text.includes("return") || text.includes("reject") || text.includes("error")) return "fa-circle-xmark";
        if(text.includes("dtr")) return "fa-calendar-check";
        if(text.includes("id")) return "fa-id-card";
        if(text.includes("document") || text.includes("requirement")) return "fa-file-lines";
        return "fa-bell";
    }

    function targetForNotification(item){
        const text = `${item.title || ""} ${item.message || ""} ${item.type || ""}`.toLowerCase();
        if(text.includes("dtr")) return "dtr.html";
        if(text.includes("ojt id") || text.includes("id request") || text.includes("id")) return "id-request.html";
        if(text.includes("document") || text.includes("requirement") || text.includes("upload")) return "submissions.html";
        return "notifications.html";
    }

    function renderStableNotificationLoader(){
        const list = document.getElementById("notificationsList");
        if(!list || list.dataset.pgmoStableLoaderShown === "1") return;
        list.dataset.pgmoStableLoaderShown = "1";
        list.innerHTML = `
            <div class="notification-loading-state pgmo-notification-circle-only" role="status" aria-live="polite">
                <div class="notification-loading-logo" aria-hidden="true"><i class="fa fa-bell"></i></div>
                <h5>Loading notifications...</h5>
                <p>Checking the latest admin updates.</p>
            </div>
        `;
    }

    function renderStableNotificationList(items){
        const list = document.getElementById("notificationsList");
        if(!list) return;
        list.dataset.pgmoStableLoaderShown = "1";
        list.dataset.notificationsLoaded = "1";

        if(!items || !items.length){
            list.innerHTML = `
                <div class="empty-state notification-empty-clean">
                    <i class="fa fa-bell"></i>
                    <h5>No notifications yet</h5>
                    <p>Admin updates will appear here automatically.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = items.map(item => {
            const target = targetForNotification(item);
            const unread = item.is_read ? "read" : "unread";
            const type = safeText(item.type || "info");
            const id = safeText(item.id || "");
            const created = item.created_at ? new Date(item.created_at).toLocaleString() : "";
            return `
                <button type="button" class="notification-card clickable-notification stable-notification-card ${unread} ${type}" data-notification-id="${id}" data-target="${target}">
                    <div class="notification-icon"><i class="fa ${iconForNotification(item)}"></i></div>
                    <div class="notification-content">
                        <div class="notification-title-row">
                            <strong>${safeText(item.title || "Notification")}</strong>
                            ${!item.is_read ? `<span class="new-pill">New</span>` : ""}
                        </div>
                        <p>${safeText(item.message || "")}</p>
                        <small>${created}</small>
                    </div>
                    <i class="fa fa-chevron-right notification-arrow"></i>
                </button>
            `;
        }).join("");
    }

    function renderStableNotificationError(message){
        const list = document.getElementById("notificationsList");
        if(!list) return;
        list.dataset.pgmoStableLoaderShown = "1";
        list.dataset.notificationsLoaded = "1";
        list.innerHTML = `
            <div class="empty-state notification-empty-clean">
                <i class="fa fa-triangle-exclamation"></i>
                <h5>Could not load notifications</h5>
                <p>${safeText(message || "Please try again.")}</p>
            </div>
        `;
    }

    async function fetchStableNotifications(options = {}){
        const force = options.force === true;
        if(!pageIsNotifications()) return notificationItemsCache || [];
        if(notificationLoadPromise && !force) return notificationLoadPromise;
        if(notificationLoadStarted && notificationItemsCache && !force){
            renderStableNotificationList(notificationItemsCache);
            return notificationItemsCache;
        }

        notificationLoadStarted = true;
        renderStableNotificationLoader();

        notificationLoadPromise = (async () => {
            if(typeof initSupabase !== "function" || !initSupabase() || typeof supabaseClient === "undefined"){
                renderStableNotificationError("Supabase is not connected.");
                return [];
            }

            const student = typeof getStudent === "function" ? getStudent() : {};
            if(!student.id){
                renderStableNotificationError("Student session was not found. Please sign in again.");
                return [];
            }

            const table = typeof getStudentNotificationsTable === "function" ? getStudentNotificationsTable() : "ojt_notifications";
            const { data, error } = await supabaseClient
                .from(table)
                .select("*")
                .eq("student_id", student.id)
                .order("created_at", { ascending:false })
                .limit(50);

            if(error){
                renderStableNotificationError(error.message);
                return [];
            }

            notificationItemsCache = data || [];
            renderStableNotificationList(notificationItemsCache);

            const unread = notificationItemsCache.filter(item => !item.is_read).length;
            sessionStorage.setItem("student_live_unread_count", String(unread));
            const badge = document.getElementById("notificationBadge");
            if(badge){
                badge.textContent = unread > 0 ? String(unread) : "";
                badge.style.display = unread > 0 ? "inline-flex" : "none";
            }
            const topDot = document.getElementById("topNotificationDot");
            if(topDot) topDot.style.display = unread > 0 ? "block" : "none";

            if(unread > 0){
                await supabaseClient.from(table).update({is_read:true}).eq("student_id", student.id).eq("is_read", false);
            }

            return notificationItemsCache;
        })().finally(() => {
            notificationLoadPromise = null;
        });

        return notificationLoadPromise;
    }

    window.loadNotificationsPage = function(){
        return fetchStableNotifications({force:false});
    };

    window.renderNotifications = function(){
        if(pageIsNotifications()) return fetchStableNotifications({force:false});
        return Promise.resolve([]);
    };

    window.markAllNotificationsRead = async function(){
        if(typeof initSupabase !== "function" || !initSupabase()) return;
        const student = typeof getStudent === "function" ? getStudent() : {};
        if(!student.id) return;
        const table = typeof getStudentNotificationsTable === "function" ? getStudentNotificationsTable() : "ojt_notifications";
        const button = document.getElementById("markAllNotificationsRead");
        const oldText = button ? button.innerHTML : "";
        if(button){
            button.disabled = true;
            button.innerHTML = `<i class="fa fa-circle-notch fa-spin"></i> Marking...`;
        }
        const { error } = await supabaseClient.from(table).update({is_read:true}).eq("student_id", student.id).eq("is_read", false);
        if(button){
            button.disabled = false;
            button.innerHTML = oldText;
        }
        if(error){
            if(typeof showToast === "function") showToast(error.message, "error");
            return;
        }
        notificationItemsCache = null;
        await fetchStableNotifications({force:true});
        if(typeof showToast === "function") showToast("All notifications marked as read.");
    };

    window.clearAllNotifications = async function(){
        if(typeof initSupabase !== "function" || !initSupabase()) return;
        const student = typeof getStudent === "function" ? getStudent() : {};
        if(!student.id) return;
        if(!confirm("Are you sure you want to clear all notifications?")) return;
        const table = typeof getStudentNotificationsTable === "function" ? getStudentNotificationsTable() : "ojt_notifications";
        const button = document.getElementById("clearNotificationsBtn");
        const oldText = button ? button.innerHTML : "";
        if(button){
            button.disabled = true;
            button.innerHTML = `<i class="fa fa-circle-notch fa-spin"></i> Clearing...`;
        }
        const { error } = await supabaseClient.from(table).delete().eq("student_id", student.id);
        if(button){
            button.disabled = false;
            button.innerHTML = oldText;
        }
        if(error){
            if(typeof showToast === "function") showToast(error.message, "error");
            return;
        }
        notificationItemsCache = [];
        renderStableNotificationList([]);
        if(typeof showToast === "function") showToast("Notifications cleared successfully.");
    };

    document.addEventListener("click", function(event){
        const actionButton = event.target.closest("#markAllNotificationsRead, #clearNotificationsBtn");
        if(!actionButton || !pageIsNotifications()) return;
        event.preventDefault();
        event.stopPropagation();
        if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
        if(actionButton.id === "markAllNotificationsRead") window.markAllNotificationsRead();
        if(actionButton.id === "clearNotificationsBtn") window.clearAllNotifications();
    }, true);

    document.addEventListener("DOMContentLoaded", function(){
        if(!pageIsNotifications()) return;
        fetchStableNotifications({force:false});
    });
})();


/* PGMO PATCH 2026-07-16B: final notifications loader ownership
   Prevents older notification refresh code from repainting square/cards during the loading state. */
(function(){
    function isNotificationsPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "notifications";
    }

    function showOnlyCircleLoader(){
        if(!isNotificationsPage()) return;
        const list = document.getElementById("notificationsList");
        if(!list || list.dataset.finalListRendered === "1") return;
        list.dataset.pgmoStableLoaderShown = "1";
        list.innerHTML = `
            <div class="notification-loading-state pgmo-notification-circle-only" role="status" aria-live="polite">
                <div class="notification-loading-logo" aria-hidden="true"><i class="fa fa-bell"></i></div>
                <h5>Loading notifications...</h5>
                <p>Checking the latest admin updates.</p>
            </div>`;
    }

    async function finalLoadNotifications(){
        if(!isNotificationsPage()) return;
        showOnlyCircleLoader();
        if(typeof window.loadNotificationsPage === "function"){
            await window.loadNotificationsPage();
            const list = document.getElementById("notificationsList");
            if(list) list.dataset.finalListRendered = "1";
        }
    }

    document.addEventListener("DOMContentLoaded", function(){
        if(!isNotificationsPage()) return;
        setTimeout(showOnlyCircleLoader, 0);
        setTimeout(finalLoadNotifications, 120);
    });
})();
