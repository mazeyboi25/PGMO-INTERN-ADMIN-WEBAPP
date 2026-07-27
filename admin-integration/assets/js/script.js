const CERTIFICATE_DEFAULT_SIGNATORY_NAME = "JESSICA B. GALINDO";

/* ADMIN NOTIFICATION TABLE ALIAS */
function getAdminNotificationsTable(){
    return typeof OJT_NOTIFICATIONS_TABLE !== "undefined" ? OJT_NOTIFICATIONS_TABLE : "ojt_notifications";
}

const STORAGE_KEY = "interntrack_admin_supabase_empty_v1";

const seedData = {
    students:[],
    applications:[],
    documents:[],
    reports:[]
};

function requireLogin(){
    if(typeof requireAdminLogin === "function"){
        return requireAdminLogin();
    }

    if(sessionStorage.getItem("interntrack_logged_in") !== "true"){
        window.location.href = "login.html";
        return false;
    }

    return true;
}

function initData(){
    if(!localStorage.getItem(STORAGE_KEY)){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
    }
}

function getData(){
    initData();
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function saveData(data){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function badge(status){
    return `<span class="badge-soft badge-${String(status).toLowerCase()}">${status}</span>`;
}

function progressBar(done,total){
    const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return `<div class="progress"><div class="progress-bar bg-primary" style="width:${percent}%"></div></div><small>${done} / ${total} hrs</small>`;
}

function emptyRow(cols, icon, title, text){
    return `<tr><td colspan="${cols}"><div class="empty-state"><i class="${icon}"></i><h5>${title}</h5><p>${text}</p></div></td></tr>`;
}

document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;

    if(page !== "login" && page !== "register" && page !== "logout"){
        if(requireLogin() === false) return;
        if(typeof startAdminAutoLogout === "function") startAdminAutoLogout();
        initData();
    }

    if(page === "dashboard") renderDashboard();
    if(page === "students") renderStudents();
    if(page === "id-requests"){
        renderOjtIdAccessAdmin();
        renderOjtIdRequestsAdmin();
    }
    if(page === "applications") renderApplications();
    if(page === "documents") renderDocuments();
    if(page === "certificates") renderCertificates();
    if(page === "reports") renderReports();

    const user = document.querySelector("#currentUser");
    if(user) user.textContent = (typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : (sessionStorage.getItem("interntrack_username") || "admin"));
});

function renderDashboard(){
    if(document.body.dataset.page !== "dashboard"){
        return;
    }

    const totalStudentsEl = document.querySelector("#totalStudents");
    const pendingApplicationsEl = document.querySelector("#pendingApplications");
    const ongoingOjtEl = document.querySelector("#ongoingOjt");
    const completedOjtEl = document.querySelector("#completedOjt");
    const recentStudentsEl = document.querySelector("#recentStudents");
    const recentDocsEl = document.querySelector("#recentDocs");

    if(!totalStudentsEl || !pendingApplicationsEl || !ongoingOjtEl || !completedOjtEl || !recentStudentsEl || !recentDocsEl){
        return;
    }

    const data = getData();
    const students = data.students || [];

    totalStudentsEl.textContent = students.length;
    pendingApplicationsEl.textContent = (data.applications || []).filter(a => a.status === "Pending").length;
    ongoingOjtEl.textContent = students.filter(s => s.status === "Ongoing").length;
    completedOjtEl.textContent = students.filter(s => s.status === "Completed").length;

    recentStudentsEl.innerHTML = students.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.office}</td>
            <td>${progressBar(s.completed,s.required)}</td>
            <td>${badge(s.status)}</td>
            <td><a class="btn btn-sm btn-outline-primary" href="students.html">View</a></td>
        </tr>
    `).join("");

    recentDocsEl.innerHTML = (data.documents || []).map(d => `
        <tr>
            <td>${d.student}</td>
            <td>${d.file}</td>
            <td>${badge(d.status)}</td>
        </tr>
    `).join("");
}

let editingStudentId = null;

function renderStudents(){
    const data = getData();
    const tbody = document.querySelector("#studentsTableBody");
    const search = (document.querySelector("#studentSearch").value || "").toLowerCase();
    const status = document.querySelector("#studentStatus").value;
    const office = document.querySelector("#studentOfficeFilter").value;

    const list = data.students.filter(s => {
        return JSON.stringify(s).toLowerCase().includes(search)
        && (status === "All" || s.status === status)
        && (office === "All" || s.office === office);
    });

    tbody.innerHTML = list.length ? list.map(s => `
        <tr>
            <td><strong>${s.id}</strong></td>
            <td>${s.name}<br><small class="text-secondary">${s.email}</small></td>
            <td>${s.course}</td>
            <td>${s.office}</td>
            <td>${progressBar(s.completed,s.required)}</td>
            <td>${badge(s.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${s.id}')">View</button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editStudent('${s.id}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join("") : emptyRow(7,"fa fa-user-graduate","No students found","Add a student to start tracking OJT.");
}

function openStudentAdd(){
    editingStudentId = null;
    document.querySelector("#studentModalTitle").textContent = "Add Student";
    document.querySelector("#studentForm").reset();

    if(document.querySelector("#studentLastName")) document.querySelector("#studentLastName").value = "";
    if(document.querySelector("#studentFirstName")) document.querySelector("#studentFirstName").value = "";
    if(document.querySelector("#studentMiddleInitial")) document.querySelector("#studentMiddleInitial").value = "";
    document.querySelector("#studentRequired").value = 240;
    document.querySelector("#studentCompleted").value = 0;
    new bootstrap.Modal(document.querySelector("#studentModal")).show();
}

function editStudent(id){
    const s = getData().students.find(x => x.id === id);
    editingStudentId = id;

    document.querySelector("#studentModalTitle").textContent = "Edit Student";
    document.querySelector("#studentLastName").value = s.lastName || splitAdminStudentFullName(s.name).lastName;
    document.querySelector("#studentFirstName").value = s.firstName || splitAdminStudentFullName(s.name).firstName;
    document.querySelector("#studentMiddleInitial").value = s.middleInitial || splitAdminStudentFullName(s.name).middleInitial;
    document.querySelector("#studentCourseInput").value = s.course;
    document.querySelector("#studentOffice").value = s.office;
    document.querySelector("#studentStatusInput").value = s.status;
    document.querySelector("#studentCompleted").value = s.completed;
    document.querySelector("#studentRequired").value = 240;
    document.querySelector("#studentEmail").value = s.email;
    document.querySelector("#studentPhone").value = s.phone;

    new bootstrap.Modal(document.querySelector("#studentModal")).show();
}

function saveStudent(){
    const data = getData();
    const record = {
        id: editingStudentId || `STU-${String(data.students.length + 1).padStart(3,"0")}`,
        name: document.querySelector("#studentName").value || "Unnamed Student",
        course: document.querySelector("#studentCourseInput").value,
        office: document.querySelector("#studentOffice").value,
        status: document.querySelector("#studentStatusInput").value,
        completed: Math.min(30, Number(document.querySelector("#studentCompleted").value || 0)),
        required: 240,
        email: document.querySelector("#studentEmail").value || "student@email.com",
        phone: document.querySelector("#studentPhone").value || "No phone",
        supervisor: document.querySelector("#studentOffice").value + " Supervisor"
    };

    if(editingStudentId){
        data.students = data.students.map(s => s.id === editingStudentId ? record : s);
    }else{
        data.students.push(record);
    }

    saveData(data);
    renderStudents();
    bootstrap.Modal.getInstance(document.querySelector("#studentModal")).hide();
}

function viewStudent(id){
    const s = getData().students.find(x => x.id === id);
    document.querySelector("#studentViewBody").innerHTML = `
        <p><strong>Name:</strong> ${s.name}</p>
        <p><strong>Course:</strong> ${s.course}</p>
        <p><strong>Office Assigned:</strong> ${s.office}</p>
        <p><strong>Status:</strong> ${badge(s.status)}</p>
        <p><strong>Progress:</strong> ${s.completed} / ${s.required} hours</p>
        <p><strong>Email:</strong> ${s.email}</p>
        <p><strong>Phone:</strong> ${s.phone}</p>
    `;
    new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
}



function renderApplications(){
    const data = getData();
    const search = (document.querySelector("#applicationSearch").value || "").toLowerCase();
    const status = document.querySelector("#applicationStatus").value;

    const list = data.applications.filter(a => {
        return JSON.stringify(a).toLowerCase().includes(search)
        && (status === "All" || a.status === status);
    });

    document.querySelector("#appPending").textContent = data.applications.filter(a => a.status === "Pending").length;
    document.querySelector("#appApproved").textContent = data.applications.filter(a => a.status === "Approved").length;
    document.querySelector("#appRejected").textContent = data.applications.filter(a => a.status === "Rejected").length;

    document.querySelector("#applicationsTableBody").innerHTML = list.length ? list.map(a => `
        <tr>
            <td>${a.id}</td>
            <td>${a.student}</td>
            <td>${a.course}</td>
            <td>${a.office}</td>
            <td>${a.date}</td>
            <td>${badge(a.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewApplication('${a.id}')">View</button>
                    <button class="btn btn-sm btn-outline-success" onclick="setApplicationStatus('${a.id}','Approved')">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="setApplicationStatus('${a.id}','Rejected')">Reject</button>
                </div>
            </td>
        </tr>
    `).join("") : emptyRow(7,"fa fa-file-signature","No applications found","Applications will appear here.");
}

function viewApplication(id){
    const a = getData().applications.find(x => x.id === id);
    document.querySelector("#applicationViewBody").innerHTML = `
        <p><strong>Student:</strong> ${a.student}</p>
        <p><strong>Course:</strong> ${a.course}</p>
        <p><strong>Office Assigned:</strong> ${a.office}</p>
        <p><strong>Status:</strong> ${badge(a.status)}</p>
        <p><strong>Requirements:</strong></p>
        <ul>${a.requirements.map(r => `<li>${r}</li>`).join("")}</ul>
    `;
    new bootstrap.Modal(document.querySelector("#applicationViewModal")).show();
}

function setApplicationStatus(id,status){
    const data = getData();
    data.applications = data.applications.map(a => a.id === id ? {...a,status} : a);
    saveData(data);
    renderApplications();
}

function getNotificationsTable(){
    return typeof OJT_NOTIFICATIONS_TABLE !== "undefined"
        ? OJT_NOTIFICATIONS_TABLE
        : "ojt_notifications";
}

async function createStudentNotification(studentId, title, message, type = "info", relatedType = "", relatedId = null){
    const client = initSupabaseAdmin();

    if(!client || !studentId){
        return;
    }

    const { error } = await client
        .from(getNotificationsTable())
        .insert([
            {
                student_id: studentId,
                title: title,
                message: message,
                type: type,
                related_type: relatedType,
                related_id: relatedId,
                is_read: false
            }
        ]);

    if(error){
        console.error("Notification error:", error.message);
    }
}
let supabaseAdminClient = null;
let selectedReturnedUploadId = null;

function hasSupabaseConfig(){
    return typeof SUPABASE_URL !== "undefined"
        && typeof SUPABASE_ANON_KEY !== "undefined"
        && !SUPABASE_URL.includes("PASTE_")
        && !SUPABASE_ANON_KEY.includes("PASTE_");
}

function initSupabaseAdmin(){
    if(!hasSupabaseConfig()){
        return null;
    }

    if(!supabaseAdminClient){
        supabaseAdminClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    return supabaseAdminClient;
}

function showAdminSupabaseMessage(message){
    const table = document.querySelector("#documentsTableBody");
    if(table){
        table.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase Connection Needed</h5><p>${message}</p></div></td></tr>`;
    }
}

async function renderDocuments(){
    const statusFilter = document.querySelector("#documentStatus") ? document.querySelector("#documentStatus").value : "All";
    const searchValue = document.querySelector("#documentSearch") ? document.querySelector("#documentSearch").value.toLowerCase() : "";
    const tbody = document.querySelector("#documentsTableBody");

    if(!tbody) return;

    const client = initSupabaseAdmin();

    if(!client){
        document.querySelector("#docTotal").textContent = "0";
        document.querySelector("#docApproved").textContent = "0";
        document.querySelector("#docPending").textContent = "0";
        document.querySelector("#docReturned").textContent = "0";

        showAdminSupabaseMessage("Open assets/js/supabase-config.js and paste your Supabase Project URL and Publishable/Anon key.");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading student uploads...</h5><p>Please wait while documents are loaded from Supabase.</p></div></td></tr>`;

    const { data, error } = await client
        .from(OJT_UPLOADS_TABLE)
        .select("*")
        .order("created_at", { ascending:false });

    if(error){
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load uploads</h5><p>${error.message}</p></div></td></tr>`;
        return;
    }

    const uploads = data || [];

    document.querySelector("#docTotal").textContent = uploads.length;
    document.querySelector("#docApproved").textContent = uploads.filter(d => d.status === "Approved").length;
    document.querySelector("#docPending").textContent = uploads.filter(d => d.status === "Pending").length;
    document.querySelector("#docReturned").textContent = uploads.filter(d => d.status === "Returned").length;

    let list = uploads.filter(d => {
        const matchesSearch = JSON.stringify(d).toLowerCase().includes(searchValue);
        const matchesStatus = statusFilter === "All" || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if(!list.length){
        tbody.innerHTML = emptyRow(6,"fa fa-folder-open","No uploaded documents found","Student uploads from Supabase will appear here.");
        return;
    }

    tbody.innerHTML = list.map(d => `
        <tr>
            <td>
                <strong>${d.student_name || "Unknown Student"}</strong><br>
                <small class="text-secondary">${d.student_id || ""} · ${d.course || ""} · ${d.office_assigned || ""}</small>
            </td>
            <td>
                <div class="file-pill">
                    <div class="file-icon"><i class="fa fa-file-lines"></i></div>
                    <div>
                        ${d.file_name || "Uploaded File"}<br>
                        <small class="text-secondary">${d.remarks ? "Student remarks: " + d.remarks : "No student remarks"}</small>
                    </div>
                </div>
            </td>
            <td>${d.document_type || "Document"}</td>
            <td>${badge(d.status || "Pending")}</td>
            <td>${d.created_at ? new Date(d.created_at).toLocaleString() : "Unknown date"}</td>
            <td>
                <div class="action-group">
                    <button type="button" class="btn btn-sm btn-outline-primary pgmo-document-preview-btn" data-file-url="${pgmoAdminDocumentPreviewAttr(d.file_url || "")}" data-file-name="${pgmoAdminDocumentPreviewAttr(d.file_name || d.document_type || "Document")}" data-file-type="${pgmoAdminDocumentPreviewAttr(d.document_type || "Document")}">View</button>
                    <button class="btn btn-sm btn-outline-success" onclick="setDocumentStatus('${d.id}','Approved')">Approve</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="returnDocument('${d.id}')">Return</button>
                        <button class="btn btn-sm btn-outline-dark" onclick="deleteAdminDocument('${d.id}')"><i class="fa fa-trash"></i> Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

async function setDocumentStatus(id,status){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const uploadsTable = typeof OJT_UPLOADS_TABLE !== "undefined" ? OJT_UPLOADS_TABLE : "ojt_uploads";
    const { data: rows } = await client.from(uploadsTable).select("*").eq("id", id).limit(1);
    const doc = rows && rows.length ? rows[0] : null;
    const { error } = await client.from(uploadsTable).update({
        status: status,
        admin_remarks: status === "Approved" ? "Approved by admin" : null
    }).eq("id", id);
    if(error){ alert(error.message); return; }
    if(doc && status === "Approved"){
        await createStudentNotification(doc.student_id,"Document Approved",`${doc.document_type || doc.file_name || "Your document"} has been approved by the admin.`,"success","document",doc.id);
    }
    renderDocuments();
}

async function returnDocument(id){
    const reason = prompt("Enter reason for returning this document:");
    if(reason === null) return;
    if(!reason.trim()){ alert("Please enter a reason."); return; }
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const uploadsTable = typeof OJT_UPLOADS_TABLE !== "undefined" ? OJT_UPLOADS_TABLE : "ojt_uploads";
    const { data: rows } = await client.from(uploadsTable).select("*").eq("id", id).limit(1);
    const doc = rows && rows.length ? rows[0] : null;
    const { error } = await client.from(uploadsTable).update({ status:"Returned", admin_remarks:reason }).eq("id", id);
    if(error){ alert(error.message); return; }
    if(doc){
        await createStudentNotification(doc.student_id,"Document Returned",`${doc.document_type || doc.file_name || "Your document"} was returned. Please check the admin remarks.`,"error","document",doc.id);
    }
    renderDocuments();
}

function addDocument(){
    alert("This Documents page is now connected to Supabase student uploads. Students should upload files from the deployed student portal.");
}

function previewDocument(file){
    alert("Use the View button to open uploaded files from Supabase.");
}

function deleteDocument(id){
    alert("Delete is disabled for online student uploads. Use Return if the document needs correction.");
}

function renderCertificates(){
    const data = getData();
    const eligible = data.students.filter(s => s.completed >= 240);

    document.querySelector("#certificatesTableBody").innerHTML = eligible.length ? eligible.map(s => `
        <tr>
            <td>${s.name}</td>
            <td>${s.office}</td>
            <td>${s.completed} / ${s.required}</td>
            <td>${badge("Generated")}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="previewCertificate('${s.id}')">Preview</button>
                    <button class="btn btn-sm btn-outline-dark" onclick="downloadCertificate('${s.id}')">Download</button>
                </div>
            </td>
        </tr>
    `).join("") : emptyRow(5,"fa fa-award","No certificates available","Students need 240 completed hours before certificates appear.");
}

function certificateHtml(s){
    return `<div class="certificate-preview">
        <h2>Certificate of OJT Completion</h2>
        <p>This certifies that</p>
        <h1>${s.name}</h1>
        <p>has successfully completed</p>
        <h3>240 hours</h3>
        <p>of On-the-Job Training under</p>
        <h3>${s.office}</h3>
        <p class="mt-4">Generated by InternTrack</p>
    </div>`;
}

function previewCertificate(id){
    const s = getData().students.find(x => x.id === id);
    document.querySelector("#certificatePreviewBody").innerHTML = certificateHtml(s);
    new bootstrap.Modal(document.querySelector("#certificatePreviewModal")).show();
}

function downloadCertificate(id){
    const s = getData().students.find(x => x.id === id);
    const blob = new Blob([certificateHtml(s)], {type:"text/html"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = s.name + "_certificate.html";
    link.click();
}

function renderReports(){
    const data = getData();

    document.querySelector("#reportStudents").textContent = data.students.length;
    document.querySelector("#reportApplications").textContent = data.applications.length;
    document.querySelector("#reportActive").textContent = data.students.filter(s => s.status === "Ongoing").length;
    document.querySelector("#reportDocuments").textContent = data.documents.length;

    const total = Math.max(data.students.length,1);
    const ongoing = Math.round(data.students.filter(s => s.status === "Ongoing").length / total * 100);
    const pending = Math.round(data.students.filter(s => s.status === "Pending").length / total * 100);
    const completed = Math.round(data.students.filter(s => s.status === "Completed").length / total * 100);

    document.querySelector("#ongoingBar").style.width = ongoing + "%";
    document.querySelector("#pendingBar").style.width = pending + "%";
    document.querySelector("#completedBar").style.width = completed + "%";

    document.querySelector("#ongoingLabel").textContent = ongoing + "%";
    document.querySelector("#pendingLabel").textContent = pending + "%";
    document.querySelector("#completedLabel").textContent = completed + "%";

    document.querySelector("#reportsTableBody").innerHTML = data.reports.length ? data.reports.map(r => `
        <tr>
            <td>${r.name}</td>
            <td>${r.date}</td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="window.print()">Print</button></td>
        </tr>
    `).join("") : emptyRow(3,"fa fa-chart-column","No reports generated","Click Generate Report to create a report.");
}

function generateReport(){
    const data = getData();
    data.reports.unshift({name:"OJT Summary Report",date:new Date().toLocaleDateString()});
    saveData(data);
    renderReports();
}


/* STUDENTS SUPABASE SYNC + MONTHLY DTR RESTORE */

let editingStudentUuid = null;
let adminStudentsCache = [];
let adminDocumentStudentOptionCache = [];
let monthlyDtrAdminCache = [];

function getAdminStudentAccountsTable(){
    return typeof STUDENT_ACCOUNTS_TABLE !== "undefined" ? STUDENT_ACCOUNTS_TABLE : "student_accounts";
}

function getAdminDtrFormsTable(){
    return typeof OJT_DTR_FORMS_TABLE !== "undefined" ? OJT_DTR_FORMS_TABLE : "ojt_dtr_forms";
}

function safeText(value){
    return String(value ?? "")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}


function sortAdminStudentsAlphabetically(students){
    return [...(students || [])].sort((a,b) => {
        const aKey = `${a.lastName || ""} ${a.firstName || ""} ${a.name || ""} ${a.id || ""}`.toLowerCase();
        const bKey = `${b.lastName || ""} ${b.firstName || ""} ${b.name || ""} ${b.id || ""}`.toLowerCase();
        return aKey.localeCompare(bKey);
    });
}

function accountToAdminStudent(row){
    const split = splitAdminStudentFullName(row.full_name);
    const lastName = row.last_name || split.lastName;
    const firstName = row.first_name || split.firstName;
    const middleInitial = row.middle_initial || split.middleInitial;
    const formattedName = formatAdminStudentFullName(lastName, firstName, middleInitial);

    return {
        uuid: row.id || "",
        id: row.student_id || "",
        name: formattedName && formattedName.includes(",") ? formattedName : (row.full_name || "Unnamed Student"),
        lastName,
        firstName,
        middleInitial,
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        status: row.ojt_status || "Pending",
        accountStatus: row.status || "Active",
        completed: Number(row.completed_hours ?? 0),
        required: Number(row.required_hours ?? 0),
        email: row.email || "",
        phone: row.phone || row.contact_number || "No phone",
        supervisor: row.supervisor || ""
    };
}

async function adminHashPassword(password){
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function progressBar(completed,required){
    completed = Number(completed || 0);
    required = Number(required || 0);

    if(required <= 0){
        return `
            <div class="progress mini">
                <div class="progress-bar" style="width:0%"></div>
            </div>
            <small>${completed} / Not set hrs</small>
        `;
    }

    const percent = Math.min(100, Math.round((completed / required) * 100));

    return `
        <div class="progress mini">
            <div class="progress-bar" style="width:${percent}%"></div>
        </div>
        <small>${completed} / ${required} hrs</small>
    `;
}

async function fetchAdminStudents(){
    const client = initSupabaseAdmin();

    if(!client){
        adminStudentsCache = [];
        return { students:[], error:"Supabase config is missing. Open assets/js/config.js first." };
    }

    const { data, error } = await client
        .from(getAdminStudentAccountsTable())
        .select("*")
        .order("created_at", { ascending:false });

    if(error){
        adminStudentsCache = [];
        return { students:[], error:error.message };
    }

    adminStudentsCache = sortAdminStudentsAlphabetically((data || []).map(accountToAdminStudent));
    return { students:adminStudentsCache, error:null };
}

async function renderStudents(){
    const tbody = document.querySelector("#studentsTableBody");
    if(!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7">
                <div class="empty-state">
                    <i class="fa fa-spinner fa-spin"></i>
                    <h5>Loading students...</h5>
                    <p>Fetching registered students from Supabase.</p>
                </div>
            </td>
        </tr>
    `;

    const result = await fetchAdminStudents();

    if(result.error){
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fa fa-triangle-exclamation"></i>
                        <h5>Unable to load students</h5>
                        <p>${safeText(result.error)}</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const search = (document.querySelector("#studentSearch")?.value || "").toLowerCase();
    const status = document.querySelector("#studentStatus")?.value || "All";
    const office = (document.querySelector("#studentOfficeFilter")?.value || "").toLowerCase();

    const list = result.students.filter(s => {
        return JSON.stringify(s).toLowerCase().includes(search)
            && (status === "All" || s.status === status)
            && (!office || String(s.office || "").toLowerCase().includes(office));
    });

    tbody.innerHTML = list.length ? list.map(s => `
        <tr>
            <td><strong>${safeText(s.id)}</strong></td>
            <td>${safeText(s.name)}<br><small class="text-secondary">${safeText(s.email)}</small><br><small class="text-secondary">${safeText(s.phone)}</small></td>
            <td>${safeText(s.course)}</td>
            <td>${safeText(s.office)}</td>
            <td>${progressBar(s.completed,s.required)}</td>
            <td>${badge(s.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${s.uuid}')">View</button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editStudent('${s.uuid}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.uuid}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join("") : emptyRow(7,"fa fa-user-graduate","No students found","Student registrations will appear here.");
}

function openStudentAdd(){
    editingStudentId = null;
    editingStudentUuid = null;

    document.querySelector("#studentModalTitle").textContent = "Add Student";
    document.querySelector("#studentForm").reset();

    const idInput = document.querySelector("#studentIdInput");
    if(idInput){
        idInput.disabled = false;
        idInput.value = "";
    }

    const password = document.querySelector("#studentPassword");
    if(password){
        password.value = "";
        password.placeholder = "Default: student123";
    }

    document.querySelector("#studentCompleted").value = 0;
    document.querySelector("#studentRequired").value = "";

    new bootstrap.Modal(document.querySelector("#studentModal")).show();
}

function editStudent(uuid){
    const s = adminStudentsCache.find(x => x.uuid === uuid);

    if(!s){
        alert("Student not found. Please refresh.");
        return;
    }

    editingStudentId = s.id;
    editingStudentUuid = uuid;

    document.querySelector("#studentModalTitle").textContent = "Edit Student";
    document.querySelector("#studentIdInput").value = s.id;
    document.querySelector("#studentLastName").value = s.lastName || splitAdminStudentFullName(s.name).lastName;
    document.querySelector("#studentFirstName").value = s.firstName || splitAdminStudentFullName(s.name).firstName;
    document.querySelector("#studentMiddleInitial").value = s.middleInitial || splitAdminStudentFullName(s.name).middleInitial;
    document.querySelector("#studentCourseInput").value = s.course;
    document.querySelector("#studentOffice").value = s.office;
    document.querySelector("#studentStatusInput").value = s.status;
    document.querySelector("#studentCompleted").value = s.completed;
    document.querySelector("#studentRequired").value = s.required || "";
    document.querySelector("#studentEmail").value = s.email;
    document.querySelector("#studentPhone").value = s.phone === "No phone" ? "" : s.phone;

    const password = document.querySelector("#studentPassword");
    if(password){
        password.value = "";
        password.placeholder = "Leave blank to keep current password";
    }

    new bootstrap.Modal(document.querySelector("#studentModal")).show();
}

async function saveStudent(){
    const client = initSupabaseAdmin();

    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    const studentId = (document.querySelector("#studentIdInput").value || "").trim().toUpperCase();
    const lastName = (document.querySelector("#studentLastName").value || "").trim().toUpperCase();
    const firstName = (document.querySelector("#studentFirstName").value || "").trim();
    const middleInitial = (document.querySelector("#studentMiddleInitial").value || "").trim().toUpperCase().charAt(0);
    const fullName = formatAdminStudentFullName(lastName, firstName, middleInitial);
    const course = (document.querySelector("#studentCourseInput").value || "").trim();
    const office = (document.querySelector("#studentOffice").value || "").trim() || "Not assigned";
    const status = document.querySelector("#studentStatusInput").value;
    const completed = Number(document.querySelector("#studentCompleted").value || 0);
    const required = Number(document.querySelector("#studentRequired").value || 0);
    const email = (document.querySelector("#studentEmail").value || "").trim().toLowerCase();
    const phone = (document.querySelector("#studentPhone").value || "").trim();
    const tempPassword = (document.querySelector("#studentPassword")?.value || "").trim();

    if(!studentId){
        alert("Student ID is required.");
        return;
    }

    if(!lastName || !firstName){
        alert("Last name and first name are required.");
        return;
    }

    if(!course){
        alert("Course is required.");
        return;
    }

    if(!email){
        alert("Email is required.");
        return;
    }

    if(completed < 0){
        alert("Completed hours cannot be negative.");
        return;
    }

    if(required <= 0){
        alert("Required hours must be set by the admin.");
        return;
    }

    const finalStatus = required > 0 && completed >= required ? "Completed" : status;

    const payload = {
        student_id: studentId,
        last_name: lastName,
        first_name: firstName,
        middle_initial: middleInitial,
        full_name: fullName,
        course: course,
        office_assigned: office,
        email: email,
        phone: phone,
        contact_number: phone,
        status: "Active",
        ojt_status: finalStatus,
        completed_hours: completed,
        required_hours: required,
        supervisor: office ? office + " Supervisor" : "Supervisor",
        updated_at: new Date().toISOString()
    };

    if(editingStudentUuid){
        if(tempPassword){
            payload.password_hash = await adminHashPassword(tempPassword);
        }

        const { error } = await client
            .from(getAdminStudentAccountsTable())
            .update(payload)
            .eq("id", editingStudentUuid);

        if(error){
            alert(error.message);
            return;
        }
    }else{
        payload.password_hash = await adminHashPassword(tempPassword || "student123");

        const { error } = await client
            .from(getAdminStudentAccountsTable())
            .insert([payload]);

        if(error){
            alert(error.message);
            return;
        }
    }

    bootstrap.Modal.getInstance(document.querySelector("#studentModal")).hide();
    await renderStudents();
}

function viewStudent(uuid){
    const s = adminStudentsCache.find(x => x.uuid === uuid);

    if(!s){
        alert("Student not found. Please refresh.");
        return;
    }

    document.querySelector("#studentViewBody").innerHTML = `
        <p><strong>Student ID:</strong> ${safeText(s.id)}</p>
        <p><strong>Name:</strong> ${safeText(s.name)}</p>
        <p><strong>Course:</strong> ${safeText(s.course)}</p>
        <p><strong>Office Assigned:</strong> ${safeText(s.office)}</p>
        <p><strong>Status:</strong> ${badge(s.status)}</p>
        <p><strong>Progress:</strong> ${s.completed} / ${s.required || "Not set"} hours</p>
        <p><strong>Email:</strong> ${safeText(s.email)}</p>
        <p><strong>Contact Number:</strong> ${safeText(s.phone)}</p>
    `;

    new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
}


/* MONTHLY DTR ADMIN RESTORE */

async function renderMonthlyDtrAdmin(){
    const tbody = document.getElementById("monthlyDtrAdminTable");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading DTR forms...</h5><p>Fetching monthly DTR submissions.</p></div></td></tr>`;

    const client = initSupabaseAdmin();

    if(!client){
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase config missing</h5><p>Open assets/js/config.js first.</p></div></td></tr>`;
        return;
    }

    const {data, error} = await client
        .from(getAdminDtrFormsTable())
        .select("*")
        .order("created_at", {ascending:false});

    if(error){
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load DTR</h5><p>${safeText(error.message)}</p></div></td></tr>`;
        return;
    }

    monthlyDtrAdminCache = data || [];

    const stats = {
        dtrTotalLogs: monthlyDtrAdminCache.length,
        dtrPendingLogs: monthlyDtrAdminCache.filter(x => x.status === "Pending").length,
        dtrApprovedLogs: monthlyDtrAdminCache.filter(x => x.status === "Approved").length,
        dtrRejectedLogs: monthlyDtrAdminCache.filter(x => x.status === "Rejected").length
    };

    Object.entries(stats).forEach(([id,value]) => {
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    });

    const search = (document.getElementById("dtrSearch")?.value || "").toLowerCase();
    const status = document.getElementById("dtrStatusFilter")?.value || "All";

    const list = monthlyDtrAdminCache.filter(form => {
        return JSON.stringify(form).toLowerCase().includes(search)
            && (status === "All" || form.status === status);
    });

    if(!list.length){
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-calendar-days"></i><h5>No DTR submissions found</h5><p>Submitted monthly DTR forms will appear here.</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(form => `
        <tr>
            <td>${safeText(form.month_label || form.month)}</td>
            <td><strong>${safeText(form.student_name)}</strong><br><small class="text-secondary">${safeText(form.student_id)} · ${safeText(form.course)}</small></td>
            <td>${safeText(form.office_assigned)}</td>
            <td><strong>${Number(form.total_hours || 0)}</strong> hr(s)</td>
            <td>${badge(form.status || "Pending")}</td>
            <td>${safeText(form.admin_remarks || "-")}</td>
            <td>${form.created_at ? new Date(form.created_at).toLocaleString() : "-"}</td>
            <td>${monthlyDtrActions(form)}</td>
        </tr>
    `).join("");
}

function monthlyDtrActions(form){
    const view = `<button class="btn btn-sm btn-outline-primary" onclick="viewMonthlyDtr('${form.id}')">View</button>`;

    if(form.status === "Pending"){
        return `
            <div class="action-group">
                ${view}
                <button class="btn btn-sm btn-success" onclick="approveMonthlyDtr('${form.id}')">Approve</button>
                <button class="btn btn-sm btn-outline-danger" onclick="rejectMonthlyDtr('${form.id}')">Reject</button>
            </div>
        `;
    }

    return `<div class="action-group">${view}<button class="btn btn-sm btn-outline-dark" onclick="deleteMonthlyDtr('${form.id}')">Delete</button></div>`;
}

function viewMonthlyDtr(id){
    const form = monthlyDtrAdminCache.find(x => x.id === id);
    if(!form) return;

    const rows = (form.entries || []).map(entry => `
        <tr>
            <td>${entry.day}</td>
            <td>${safeText(entry.am_in || "")}</td>
            <td>${safeText(entry.am_out || "")}</td>
            <td>${safeText(entry.pm_in || "")}</td>
            <td>${safeText(entry.pm_out || "")}</td>
            <td>${entry.undertime_hours || ""}</td>
            <td>${entry.undertime_minutes || ""}</td>
            <td>${entry.hours || 0}</td>
        </tr>
    `).join("");

    const body = document.getElementById("monthlyDtrPreviewBody");
    body.innerHTML = `
        <div class="admin-dtr-preview">
            <div class="text-center">
                <h3>DAILY TIME RECORD</h3>
                <p>-----o0o-----</p>
            </div>

            <p><strong>Name:</strong> ${safeText(form.student_name)}</p>
            <p><strong>Student ID:</strong> ${safeText(form.student_id)}</p>
            <p><strong>Month:</strong> ${safeText(form.month_label || form.month)}</p>
            <p><strong>Total Hours:</strong> ${Number(form.total_hours || 0)}</p>

            <table class="table table-bordered table-sm">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>AM Arrival</th>
                        <th>AM Departure</th>
                        <th>PM Arrival</th>
                        <th>PM Departure</th>
                        <th>Undertime Hrs</th>
                        <th>Undertime Min</th>
                        <th>Hours</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <p><strong>Notes:</strong> ${safeText(form.notes || "-")}</p>
        </div>
    `;

    new bootstrap.Modal(document.getElementById("monthlyDtrViewModal")).show();
}

/* DTR HOURS RECALCULATION FIX */

async function recalculateStudentHoursFromApprovedDtr(client, studentId){
    if(!client || !studentId){
        return;
    }

    const { data: approvedDtrs, error: dtrError } = await client
        .from(getAdminDtrFormsTable())
        .select("total_hours")
        .eq("student_id", studentId)
        .eq("status", "Approved");

    if(dtrError){
        throw new Error("Could not recalculate approved DTR hours: " + dtrError.message);
    }

    const totalApprovedHours = Number((approvedDtrs || []).reduce((sum, item) => {
        return sum + Number(item.total_hours || 0);
    }, 0).toFixed(2));

    const { data: students, error: studentError } = await client
        .from(getAdminStudentAccountsTable())
        .select("*")
        .eq("student_id", studentId)
        .limit(1);

    if(studentError || !students || !students.length){
        throw new Error(studentError?.message || "Student account not found while recalculating hours.");
    }

    const student = students[0];
    const requiredHours = Number(student.required_hours || 0);

    let newStatus = "Pending";

    if(requiredHours > 0 && totalApprovedHours >= requiredHours){
        newStatus = "Completed";
    }else if(totalApprovedHours > 0){
        newStatus = "Ongoing";
    }

    const { error: updateError } = await client
        .from(getAdminStudentAccountsTable())
        .update({
            completed_hours: totalApprovedHours,
            ojt_status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", student.id);

    if(updateError){
        throw new Error("Could not update student completed hours: " + updateError.message);
    }

    return {
        completed_hours: totalApprovedHours,
        ojt_status: newStatus
    };
}

async function getMonthlyDtrFormForAction(client, id){
    const cached = typeof monthlyDtrAdminCache !== "undefined"
        ? monthlyDtrAdminCache.find(item => item.id === id)
        : null;

    if(cached){
        return cached;
    }

    const { data, error } = await client
        .from(getAdminDtrFormsTable())
        .select("*")
        .eq("id", id)
        .limit(1);

    if(error || !data || !data.length){
        throw new Error(error?.message || "DTR record not found.");
    }

    return data[0];
}

async function approveMonthlyDtr(id){
    const client = initSupabaseAdmin();

    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    try{
        const form = await getMonthlyDtrFormForAction(client, id);

        if(!form || form.status !== "Pending"){
            alert("Only pending DTR can be approved.");
            return;
        }

        const remarks = prompt("Admin remarks, optional:", "DTR approved") || "DTR approved";

        const { error: formError } = await client
            .from(getAdminDtrFormsTable())
            .update({
                status: "Approved",
                admin_remarks: remarks,
                approved_by: (typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : (sessionStorage.getItem("interntrack_username") || "admin")),
                approved_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("status", "Pending");

        if(formError){
            alert(formError.message);
            return;
        }

        await recalculateStudentHoursFromApprovedDtr(client, form.student_id);

        if(typeof createStudentNotification === "function"){
            await createStudentNotification(
                form.student_id,
                "DTR Approved",
                `${form.month_label || form.month} DTR has been approved. Your completed hours were updated.`,
                "success",
                "dtr",
                form.id
            );
        }

        await renderMonthlyDtrAdmin();

        if(document.body.dataset.page === "dashboard" && typeof renderDashboard === "function"){
            await renderDashboard();
        }
    }catch(error){
        alert(error.message || "Could not approve DTR.");
        console.error(error);
    }
}

async function rejectMonthlyDtr(id){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const form = monthlyDtrAdminCache.find(x => x.id === id);
    if(!form || form.status !== "Pending"){ alert("Only pending DTR can be rejected."); return; }
    const remarks = prompt("Reason for rejection:", "Please revise your DTR.");
    if(remarks === null) return;
    const {error} = await client.from(getAdminDtrFormsTable()).update({
        status:"Rejected", admin_remarks:remarks || "Rejected",
        approved_by:(typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : (sessionStorage.getItem("interntrack_username") || "admin")),
        approved_at:new Date().toISOString()
    }).eq("id", id).eq("status", "Pending");
    if(error){ alert(error.message); return; }
    await createStudentNotification(form.student_id,"DTR Rejected",`${form.month_label || form.month} DTR was rejected. Please check the admin remarks.`,"error","dtr",form.id);
    await renderMonthlyDtrAdmin();
}

async function deleteMonthlyDtr(id){
    const client = initSupabaseAdmin();

    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    try{
        const form = await getMonthlyDtrFormForAction(client, id);
        const dtrHours = Number(form.total_hours || 0);
        const wasApproved = form.status === "Approved";

        const confirmMessage = wasApproved
            ? `Delete this approved DTR? This will recalculate the student's completed hours and remove ${dtrHours} hour(s) if this DTR was counted.`
            : "Delete this DTR submission?";

        if(!confirm(confirmMessage)) return;

        const { error } = await client
            .from(getAdminDtrFormsTable())
            .delete()
            .eq("id", id);

        if(error){
            alert(error.message);
            return;
        }

        if(form.student_id){
            await recalculateStudentHoursFromApprovedDtr(client, form.student_id);
        }

        if(typeof createStudentNotification === "function"){
            await createStudentNotification(
                form.student_id,
                "DTR Deleted",
                `${form.month_label || form.month} DTR was deleted by the admin. Your completed hours were updated.`,
                "error",
                "dtr",
                form.id
            );
        }

        await renderMonthlyDtrAdmin();

        if(document.body.dataset.page === "dashboard" && typeof renderDashboard === "function"){
            await renderDashboard();
        }
    }catch(error){
        alert(error.message || "Could not delete DTR.");
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.body.dataset.page === "monthly-dtr-admin"){
        renderMonthlyDtrAdmin();
    }
});

/* ADMIN DASHBOARD FIX */

(function(){
    function escapeDashboardText(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function dashboardBadge(status){
        const text = status || "Pending";
        const key = String(text).toLowerCase();

        return `<span class="badge-status badge-${key}">${escapeDashboardText(text)}</span>`;
    }

    function getDashboardClient(){
        if(typeof initSupabaseAdmin === "function"){
            return initSupabaseAdmin();
        }

        if(typeof supabase === "undefined"){
            console.error("Supabase CDN is not loaded.");
            return null;
        }

        if(typeof SUPABASE_URL === "undefined" || typeof SUPABASE_ANON_KEY === "undefined"){
            console.error("SUPABASE_URL or SUPABASE_ANON_KEY is missing in config.js.");
            return null;
        }

        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    function getStudentStatus(student){
        const rawStatus = String(student.ojt_status || student.status || "Pending").toLowerCase();

        if(rawStatus === "completed"){
            return "Completed";
        }

        if(rawStatus === "ongoing"){
            return "Ongoing";
        }

        const completed = Number(student.completed_hours || 0);
        const required = Number(student.required_hours || 0);

        if(required > 0 && completed >= required){
            return "Completed";
        }

        if(completed > 0){
            return "Ongoing";
        }

        return "Pending";
    }

    async function renderAdminDashboardLive(){
        if(document.body.dataset.page !== "dashboard"){
            return;
        }

        const client = getDashboardClient();

        if(!client){
            return;
        }

        const studentTable = typeof STUDENT_ACCOUNTS_TABLE !== "undefined"
            ? STUDENT_ACCOUNTS_TABLE
            : "student_accounts";

        const uploadsTable = typeof OJT_UPLOADS_TABLE !== "undefined"
            ? OJT_UPLOADS_TABLE
            : "ojt_uploads";

        const { data: students, error: studentsError } = await client
            .from(studentTable)
            .select("*")
            .order("created_at", { ascending:false });

        if(studentsError){
            console.error("Dashboard student error:", studentsError.message);
            return;
        }

        const { data: uploads, error: uploadsError } = await client
            .from(uploadsTable)
            .select("*")
            .order("created_at", { ascending:false });

        if(uploadsError){
            console.error("Dashboard upload error:", uploadsError.message);
        }

        const studentList = students || [];
        const uploadList = uploads || [];

        const total = studentList.length;

        const pending = studentList.filter(student => {
            return getStudentStatus(student) === "Pending";
        }).length;

        const ongoing = studentList.filter(student => {
            return getStudentStatus(student) === "Ongoing";
        }).length;

        const completed = studentList.filter(student => {
            return getStudentStatus(student) === "Completed";
        }).length;

        const counters = {
            totalStudents: total,
            pendingApplications: pending,
            ongoingOjt: ongoing,
            completedOjt: completed
        };

        Object.entries(counters).forEach(([id, value]) => {
            const element = document.getElementById(id);

            if(element){
                element.textContent = value;
            }
        });

        const recentStudents = document.getElementById("recentStudents");

        if(recentStudents){
            if(studentList.length){
                recentStudents.innerHTML = studentList.slice(0, 5).map(student => {
                    const status = getStudentStatus(student);
                    const completedHours = Number(student.completed_hours || 0);
                    const requiredHours = Number(student.required_hours || 0);
                    const requiredLabel = requiredHours > 0 ? requiredHours : "Not set";

                    return `
                        <tr>
                            <td>
                                <strong>${escapeDashboardText(student.full_name || "Unnamed Student")}</strong><br>
                                <small class="text-secondary">${escapeDashboardText(student.student_id || "-")}</small>
                            </td>

                            <td>${escapeDashboardText(student.office_assigned || "Not assigned")}</td>

                            <td>${completedHours} / ${requiredLabel}</td>

                            <td>${dashboardBadge(status)}</td>

                            <td>
                                <a class="btn btn-sm btn-outline-primary" href="students.html">Open</a>
                            </td>
                        </tr>
                    `;
                }).join("");
            }else{
                recentStudents.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="empty-state">
                                <i class="fa fa-user-graduate"></i>
                                <h5>No students yet</h5>
                                <p>Registered students will appear here.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        const recentDocs = document.getElementById("recentDocs");

        if(recentDocs){
            if(uploadList.length){
                recentDocs.innerHTML = uploadList.slice(0, 5).map(file => {
                    return `
                        <tr>
                            <td>${escapeDashboardText(file.student_name || "-")}</td>
                            <td>${escapeDashboardText(file.document_type || file.file_name || "-")}</td>
                            <td>${dashboardBadge(file.status || "Pending")}</td>
                        </tr>
                    `;
                }).join("");
            }else{
                recentDocs.innerHTML = `
                    <tr>
                        <td colspan="3">
                            <div class="empty-state">
                                <i class="fa fa-folder-open"></i>
                                <h5>No documents yet</h5>
                                <p>Uploaded documents will appear here.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
    }

    document.addEventListener("DOMContentLoaded", renderAdminDashboardLive);
})();

/* ADMIN NAME FORMAT HELPERS */

function formatAdminStudentFullName(lastName, firstName, middleInitial){
    const last = String(lastName || "").trim().toUpperCase();
    const first = String(firstName || "").trim();
    const miRaw = String(middleInitial || "").trim().toUpperCase();
    const mi = miRaw ? `${miRaw.charAt(0)}.` : "";

    return `${last}, ${first}${mi ? " " + mi : ""}`.trim();
}

function splitAdminStudentFullName(fullName){
    const clean = String(fullName || "").trim();

    if(!clean){
        return { lastName:"", firstName:"", middleInitial:"" };
    }

    if(clean.includes(",")){
        const [lastPart, restPart] = clean.split(",", 2);
        const rest = String(restPart || "").trim();
        const restParts = rest.split(/\s+/).filter(Boolean);
        const possibleMi = restParts.length > 1 ? restParts[restParts.length - 1] : "";
        const hasMi = /^[A-Za-z]\.?$/.test(possibleMi);
        const firstName = hasMi ? restParts.slice(0, -1).join(" ") : rest;
        const middleInitial = hasMi ? possibleMi.replace(".", "").toUpperCase() : "";

        return {
            lastName: String(lastPart || "").trim().toUpperCase(),
            firstName: firstName,
            middleInitial: middleInitial
        };
    }

    const parts = clean.split(/\s+/).filter(Boolean);
    return {
        lastName: parts.length ? parts[parts.length - 1].toUpperCase() : "",
        firstName: parts.slice(0, -1).join(" "),
        middleInitial: ""
    };
}


function getAdminUploadsTable(){
    return typeof OJT_UPLOADS_TABLE !== "undefined"
        ? OJT_UPLOADS_TABLE
        : "ojt_uploads";
}

function getAdminNotificationsTable(){
    return typeof OJT_NOTIFICATIONS_TABLE !== "undefined"
        ? OJT_NOTIFICATIONS_TABLE
        : "ojt_notifications";
}

function getAdminDtrFormsTableSafe(){
    if(typeof getAdminDtrFormsTable === "function"){
        return getAdminDtrFormsTable();
    }

    return typeof OJT_DTR_FORMS_TABLE !== "undefined"
        ? OJT_DTR_FORMS_TABLE
        : "ojt_dtr_forms";
}

function getAdminStorageBucket(){
    return typeof OJT_STORAGE_BUCKET !== "undefined"
        ? OJT_STORAGE_BUCKET
        : "ojt-documents";
}

function uniqueCleanPaths(paths){
    return [...new Set((paths || [])
        .map(path => String(path || "").trim())
        .filter(path => path && !path.startsWith("http")))];
}

async function deleteStudentStorageFiles(client, student){
    const bucket = getAdminStorageBucket();
    const storagePaths = [];

    if(student.profile_picture_path){
        storagePaths.push(student.profile_picture_path);
    }

    const uploadsResult = await client
        .from(getAdminUploadsTable())
        .select("file_path")
        .eq("student_id", student.student_id);

    if(!uploadsResult.error && uploadsResult.data){
        uploadsResult.data.forEach(file => {
            if(file.file_path){
                storagePaths.push(file.file_path);
            }
        });
    }

    const cleanPaths = uniqueCleanPaths(storagePaths);

    if(cleanPaths.length){
        const { error } = await client
            .storage
            .from(bucket)
            .remove(cleanPaths);

        if(error){
            console.error("Storage delete warning:", error.message);
        }
    }
}

async function deleteStudentRelatedRecords(client, student){
    const studentId = student.student_id;
    const studentUuid = student.id;

    await deleteStudentStorageFiles(client, student);

    const uploadsDelete = await client
        .from(getAdminUploadsTable())
        .delete()
        .eq("student_id", studentId);

    if(uploadsDelete.error){
        throw new Error("Could not delete uploaded document records: " + uploadsDelete.error.message);
    }

    const dtrDelete = await client
        .from(getAdminDtrFormsTableSafe())
        .delete()
        .eq("student_id", studentId);

    if(dtrDelete.error){
        throw new Error("Could not delete DTR records: " + dtrDelete.error.message);
    }

    const notificationsDelete = await client
        .from(getAdminNotificationsTable())
        .delete()
        .eq("student_id", studentId);

    if(notificationsDelete.error){
        console.error("Notification delete warning:", notificationsDelete.error.message);
    }

    const accountDeleteById = await client
        .from(getAdminStudentAccountsTable())
        .delete()
        .eq("id", studentUuid);

    if(accountDeleteById.error){
        throw new Error("Could not delete student account: " + accountDeleteById.error.message);
    }
}

/* DELETE STUDENT CASCADE CLEANUP - WORKING VERSION */

function getAdminUploadsTable(){
    return typeof OJT_UPLOADS_TABLE !== "undefined"
        ? OJT_UPLOADS_TABLE
        : "ojt_uploads";
}

function getAdminNotificationsTable(){
    return typeof OJT_NOTIFICATIONS_TABLE !== "undefined"
        ? OJT_NOTIFICATIONS_TABLE
        : "ojt_notifications";
}

function getAdminDtrFormsTableSafe(){
    if(typeof getAdminDtrFormsTable === "function"){
        return getAdminDtrFormsTable();
    }

    return typeof OJT_DTR_FORMS_TABLE !== "undefined"
        ? OJT_DTR_FORMS_TABLE
        : "ojt_dtr_forms";
}

function getAdminStorageBucket(){
    return typeof OJT_STORAGE_BUCKET !== "undefined"
        ? OJT_STORAGE_BUCKET
        : "ojt-documents";
}

function cleanStoragePaths(paths){
    return [...new Set((paths || [])
        .map(path => String(path || "").trim())
        .filter(path => path && !path.startsWith("http")))];
}

async function getStudentAccountForDelete(client, uuid){
    const table = getAdminStudentAccountsTable();

    let query = await client
        .from(table)
        .select("*")
        .eq("id", uuid)
        .limit(1);

    if(!query.error && query.data && query.data.length){
        return query.data[0];
    }

    query = await client
        .from(table)
        .select("*")
        .eq("student_id", uuid)
        .limit(1);

    if(!query.error && query.data && query.data.length){
        return query.data[0];
    }

    throw new Error(query.error?.message || "Student account not found.");
}

async function deleteStudentFilesFromStorage(client, studentId, profilePicturePath){
    const bucket = getAdminStorageBucket();
    const paths = [];

    if(profilePicturePath){
        paths.push(profilePicturePath);
    }

    const { data: uploads, error } = await client
        .from(getAdminUploadsTable())
        .select("file_path")
        .eq("student_id", studentId);

    if(error){
        console.error("Could not read uploaded files before delete:", error.message);
    }

    (uploads || []).forEach(file => {
        if(file.file_path){
            paths.push(file.file_path);
        }
    });

    const cleanPaths = cleanStoragePaths(paths);

    if(!cleanPaths.length){
        return;
    }

    const { error: storageError } = await client
        .storage
        .from(bucket)
        .remove(cleanPaths);

    if(storageError){
        console.error("Storage delete warning:", storageError.message);
    }
}

async function deleteStudentRelatedRecords(client, account){
    const studentId = account.student_id;
    const uuid = account.id;

    if(!studentId){
        throw new Error("Student ID is missing. Cannot delete related records.");
    }

    // Delete uploaded files from Supabase Storage first, while upload rows still exist.
    await deleteStudentFilesFromStorage(client, studentId, account.profile_picture_path);

    // Preferred path: database RPC deletes every known record tied to this student.
    const rpcResult = await client.rpc("admin_delete_student_account", {
        p_student_uuid: uuid,
        p_student_id: studentId
    });

    if(!rpcResult.error){
        const result = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
        if(result && result.ok === true){
            console.log("Delete cascade summary:", result);
            return result;
        }
        throw new Error(result?.message || "Student delete failed.");
    }

    // Fallback for projects that have not run the updated SQL yet.
    console.warn("admin_delete_student_account RPC is unavailable, using frontend fallback:", rpcResult.error.message);

    const deleteTasks = [
        { label:"uploaded document records", table:getAdminUploadsTable(), filters:[{ column:"student_id", value:studentId }] },
        { label:"DTR records", table:getAdminDtrFormsTableSafe(), filters:[{ column:"student_id", value:studentId }] },
        { label:"notifications", table:getAdminNotificationsTable(), filters:[{ column:"student_id", value:studentId }] },
        { label:"OJT ID requests", table:getAdminOjtIdRequestsTable(), filters:[{ column:"student_id", value:studentId }] }
    ];

    for(const task of deleteTasks){
        const { error } = await client.from(task.table).delete().eq(task.filters[0].column, task.filters[0].value);
        if(error){
            throw new Error(`Could not delete ${task.label}: ${error.message}`);
        }
    }

    // Also clean registration invites if possible.
    try{
        await client.from("registration_invites").delete().eq("student_id", studentId);
        if(account.email){
            await client.from("registration_invites").delete().eq("email", String(account.email).toLowerCase());
        }
    }catch(inviteError){
        console.warn("Registration invite cleanup warning:", inviteError.message || inviteError);
    }

    const accountDelete = await client
        .from(getAdminStudentAccountsTable())
        .delete()
        .eq("id", uuid);

    if(accountDelete.error){
        throw new Error("Could not delete student account: " + accountDelete.error.message);
    }

    return { ok:true, message:"Student and related records deleted using fallback." };
}

async function deleteStudent(id){
    const client = initSupabaseAdmin();

    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    try{
        const account = await getStudentAccountForDelete(client, id);
        const studentName = account.full_name || account.student_id || "this student";

        const confirmed = confirm(
            `Delete ${studentName}?\n\n` +
            "This will also delete:\n" +
            "- uploaded document records\n" +
            "- uploaded files from storage\n" +
            "- DTR submissions\n" +
            "- notifications\n" +
            "- OJT ID requests\n" +
            "- registration invite/access records\n\n" +
            "This action cannot be undone."
        );

        if(!confirmed) return;

        await deleteStudentRelatedRecords(client, account);

        alert("Student account and all related records were deleted.");

        if(typeof renderStudents === "function"){
            await renderStudents();
        }

        if(document.body.dataset.page === "dashboard" && typeof renderDashboard === "function"){
            await renderDashboard();
        }
    }catch(error){
        alert(error.message || "Delete failed.");
        console.error(error);
    }
}

window.deleteStudent = deleteStudent;


/* MANUAL DTR HOURS SYNC */

async function syncAllStudentHoursFromApprovedDtr(){
    const client = initSupabaseAdmin();

    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    const { data: students, error } = await client
        .from(getAdminStudentAccountsTable())
        .select("student_id");

    if(error){
        alert(error.message);
        return;
    }

    for(const student of students || []){
        await recalculateStudentHoursFromApprovedDtr(client, student.student_id);
    }

    alert("Student completed hours were synced from approved DTR records.");

    if(typeof renderMonthlyDtrAdmin === "function"){
        await renderMonthlyDtrAdmin();
    }

    if(typeof renderStudents === "function"){
        await renderStudents();
    }

    if(document.body.dataset.page === "dashboard" && typeof renderDashboard === "function"){
        await renderDashboard();
    }
}

window.syncAllStudentHoursFromApprovedDtr = syncAllStudentHoursFromApprovedDtr;


/* SAFE PAGE REFRESH NOTE
   Dashboard refresh is now skipped outside dashboard pages.
   This prevents: Cannot set properties of null (setting 'textContent')
   after deleting DTR records from the DTR page.
*/

/* CERTIFICATE AUTO-GENERATION - SUPABASE VERSION */

let certificateStudentsCache = [];
let selectedCertificateStudent = null;

function getCertificateToday(){
    return new Date().toISOString().slice(0, 10);
}

function getCertificateLogoUrl(){
    return new URL("assets/img/pgmoseal.png", window.location.href).href;
}

function normalizeCertificateAssetPaths(html){
    const logoUrl = getCertificateLogoUrl();
    return String(html || "")
        .replaceAll('src="assets/img/pgmoseal.png"', `src="${logoUrl}"`)
        .replaceAll("src='assets/img/pgmoseal.png'", `src="${logoUrl}"`);
}

function loadCertificateImageAsDataUrl(src){
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function(){
            try{
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            }catch(error){
                resolve(null);
            }
        };
        img.onerror = function(){ resolve(null); };
        img.src = src;
    });
}

function certificateEscape(value){
    if(typeof safeText === "function"){
        return safeText(value);
    }

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatCertificateDate(value){
    if(!value){
        return new Date().toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
    }

    const date = new Date(value + "T00:00:00");
    return date.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
}

function mapCertificateStudent(row){
    const completed = Number(row.completed_hours || 0);
    const required = Number(row.required_hours || 0);
    const status = row.ojt_status || row.status || (required > 0 && completed >= required ? "Completed" : "Pending");

    return {
        uuid: row.id || "",
        studentId: row.student_id || "",
        name: row.full_name || "Unnamed Student",
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        completed: completed,
        required: required,
        supervisor: row.supervisor || "OJT Coordinator",
        status: status,
        email: row.email || ""
    };
}

function isCertificateEligible(student){
    return Number(student.required || 0) > 0 && Number(student.completed || 0) >= Number(student.required || 0);
}

async function fetchCertificateStudents(){
    const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;

    if(!client){
        return { students:[], error:"Supabase config is missing. Open assets/js/config.js first." };
    }

    const table = typeof getAdminStudentAccountsTable === "function"
        ? getAdminStudentAccountsTable()
        : (typeof STUDENT_ACCOUNTS_TABLE !== "undefined" ? STUDENT_ACCOUNTS_TABLE : "student_accounts");

    const { data, error } = await client
        .from(table)
        .select("*")
        .order("full_name", { ascending:true });

    if(error){
        return { students:[], error:error.message };
    }

    return { students:(data || []).map(mapCertificateStudent), error:null };
}

async function renderCertificates(){
    const tbody = document.getElementById("certificatesTableBody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading certificates...</h5><p>Checking student completion records from Supabase.</p></div></td></tr>`;

    const result = await fetchCertificateStudents();

    if(result.error){
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${certificateEscape(result.error)}</p></div></td></tr>`;
        return;
    }

    certificateStudentsCache = result.students;

    const eligibleCount = certificateStudentsCache.filter(isCertificateEligible).length;
    const completedCount = certificateStudentsCache.filter(student => String(student.status).toLowerCase() === "completed" || isCertificateEligible(student)).length;
    const pendingCount = Math.max(certificateStudentsCache.length - eligibleCount, 0);

    const eligibleEl = document.getElementById("certEligibleCount");
    const completedEl = document.getElementById("certCompletedCount");
    const pendingEl = document.getElementById("certPendingCount");

    if(eligibleEl) eligibleEl.textContent = eligibleCount;
    if(completedEl) completedEl.textContent = completedCount;
    if(pendingEl) pendingEl.textContent = pendingCount;

    const search = (document.getElementById("certificateSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("certificateEligibility")?.value || "All";

    const list = certificateStudentsCache.filter(student => {
        const eligible = isCertificateEligible(student);
        const matchesSearch = JSON.stringify(student).toLowerCase().includes(search);
        const matchesFilter = filter === "All" || (filter === "Eligible" && eligible) || (filter === "Not Eligible" && !eligible);
        return matchesSearch && matchesFilter;
    });

    if(!list.length){
        tbody.innerHTML = emptyRow(6, "fa fa-award", "No certificate records found", "Completed students will appear here once their required OJT hours are reached.");
        return;
    }

    tbody.innerHTML = list.map(student => {
        const eligible = isCertificateEligible(student);
        const requiredLabel = student.required > 0 ? student.required : "Not set";
        const statusBadge = eligible ? badge("Eligible") : badge("Pending");
        const action = eligible
            ? `<button class="btn btn-sm btn-outline-primary" onclick="openCertificatePreview('${student.uuid}')">Generate</button>`
            : `<button class="btn btn-sm btn-outline-secondary" disabled>Locked</button>`;

        return `
            <tr>
                <td><strong>${certificateEscape(student.name)}</strong><br><small class="text-secondary">${certificateEscape(student.studentId)} · ${certificateEscape(student.email)}</small></td>
                <td>${certificateEscape(student.office)}</td>
                <td>${certificateEscape(student.course)}</td>
                <td>${student.completed} / ${requiredLabel}</td>
                <td>${statusBadge}</td>
                <td>${action}</td>
            </tr>
        `;
    }).join("");
}

function getCertificateFormValues(){
    return {
        issueDate: document.getElementById("certificateIssueDate")?.value || getCertificateToday(),
        trainingStart: document.getElementById("certificateTrainingStart")?.value || "",
        trainingEnd: document.getElementById("certificateTrainingEnd")?.value || ""
    };
}

function certificateHtml(student, options = {}){
    const issueDate = options.issueDate || getCertificateToday();
    const signer = options.signer || student.supervisor || "OJT Coordinator";
    const signerPosition = options.signerPosition || "OJT Coordinator";
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;

    return `
        <div class="certificate-preview certificate-page" id="certificatePrintable">
            <div class="certificate-border">
                <div class="certificate-header">
                    <img src="${getCertificateLogoUrl()}" alt="PGMO Seal">
                    <div>
                        <p>Republic of the Philippines</p>
                        <h4>Province of Misamis Oriental</h4>
                        <p>Provincial Government Internship Monitoring System</p>
                    </div>
                </div>

                <div class="certificate-title">Certificate of Completion</div>

                <p class="certificate-line">This is proudly presented to</p>
                <h1>${certificateEscape(student.name)}</h1>
                <p class="certificate-student-id">${certificateEscape(student.studentId)} · ${certificateEscape(student.course)}</p>

                <p class="certificate-body-text">
                    for successfully completing <strong>${hours} hours</strong> of On-the-Job Training
                    under the <strong>${certificateEscape(student.office)}</strong> office.
                </p>

                <p class="certificate-date">Given this ${certificateEscape(formatCertificateDate(issueDate))}.</p>

                <div class="certificate-signatures">
                    <div>
                        <span></span>
                        <strong>${certificateEscape(signer)}</strong>
                        <small>${certificateEscape(signerPosition)}</small>
                    </div>
                    <div>
                        <span></span>
                        <strong>Authorized Representative</strong>
                        <small>Province of Misamis Oriental</small>
                    </div>
                </div>

                <div class="certificate-footer">Generated through InternTrack Admin</div>
            </div>
        </div>
    `;
}

function openCertificatePreview(uuid){
    const student = certificateStudentsCache.find(item => item.uuid === uuid);

    if(!student){
        alert("Student record not found. Please refresh the page.");
        return;
    }

    if(!isCertificateEligible(student)){
        alert("This student has not reached the required OJT hours yet.");
        return;
    }

    selectedCertificateStudent = student;

    const dateInput = document.getElementById("certificateIssueDate");
    const signerInput = document.getElementById("certificateSigner");
    const positionInput = document.getElementById("certificateSignerPosition");

    if(dateInput) dateInput.value = getCertificateToday();
    if(signerInput) signerInput.value = student.supervisor || "OJT Coordinator";
    if(positionInput) positionInput.value = "OJT Coordinator";

    refreshCertificatePreview();
    new bootstrap.Modal(document.getElementById("certificatePreviewModal")).show();
}

function refreshCertificatePreview(){
    if(!selectedCertificateStudent) return;

    const body = document.getElementById("certificatePreviewBody");
    if(!body) return;

    body.innerHTML = certificateHtml(selectedCertificateStudent, getCertificateFormValues());
}

function printCertificate(){
    if(!selectedCertificateStudent){
        alert("Please select a completed student first.");
        return;
    }

    refreshCertificatePreview();

    const certificate = normalizeCertificateAssetPaths(document.getElementById("certificatePreviewBody")?.innerHTML || "");
    const printWindow = window.open("", "_blank");

    if(!printWindow){
        alert("Pop-up was blocked. Please allow pop-ups to print the certificate.");
        return;
    }

    const styleUrl = new URL("assets/css/style.css", window.location.href).href;
    const bootstrapUrl = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${certificateEscape(selectedCertificateStudent.name)} Certificate</title>
            <base href="${document.baseURI}">
            <link href="${bootstrapUrl}" rel="stylesheet">
            <link rel="stylesheet" href="${styleUrl}">
        </head>
        <body class="certificate-print-body">
            ${certificate}
            <script>
                function printAfterImagesLoad(){
                    var images = Array.prototype.slice.call(document.images || []);
                    var imagePromises = images.map(function(img){
                        if(img.complete && img.naturalWidth !== 0){
                            return Promise.resolve();
                        }
                        return new Promise(function(resolve){
                            img.onload = resolve;
                            img.onerror = resolve;
                        });
                    });

                    Promise.all(imagePromises).then(function(){
                        setTimeout(function(){
                            window.focus();
                            window.print();
                        }, 350);
                    });
                }

                if(document.readyState === "complete"){
                    printAfterImagesLoad();
                }else{
                    window.addEventListener("load", printAfterImagesLoad);
                }
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
}

function downloadCertificate(id){
    const student = certificateStudentsCache.find(item => item.uuid === id) || selectedCertificateStudent;
    if(student){
        selectedCertificateStudent = student;
    }
    downloadCertificatePdf();
}

async function downloadCertificatePdf(){
    if(!selectedCertificateStudent){
        alert("Please select a completed student first.");
        return;
    }

    const options = getCertificateFormValues();
    const student = selectedCertificateStudent;
    const hours = Number(student.required || 0) > 0 ? Number(student.required || 0) : Number(student.completed || 0);
    const fileName = `${student.name.replace(/[^a-z0-9]+/gi, "_")}_Certificate.pdf`;

    if(!window.jspdf || !window.jspdf.jsPDF){
        printCertificate();
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:"landscape", unit:"pt", format:"a4" });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const logoData = await loadCertificateImageAsDataUrl(getCertificateLogoUrl());

    pdf.setDrawColor(4, 57, 21);
    pdf.setLineWidth(4);
    pdf.rect(28, 28, width - 56, height - 56);
    pdf.setLineWidth(1);
    pdf.rect(42, 42, width - 84, height - 84);

    if(logoData){
        pdf.addImage(logoData, "PNG", width / 2 - 205, 67, 58, 58);
    }

    pdf.setTextColor(4, 57, 21);
    pdf.setFont("times", "normal");
    pdf.setFontSize(14);
    pdf.text("Republic of the Philippines", width / 2, 86, { align:"center" });
    pdf.setFont("times", "bold");
    pdf.setFontSize(18);
    pdf.text("Province of Misamis Oriental", width / 2, 110, { align:"center" });
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    pdf.text("Provincial Government Internship Monitoring System", width / 2, 132, { align:"center" });

    pdf.setFont("times", "bold");
    pdf.setFontSize(36);
    pdf.text("Certificate of Completion", width / 2, 200, { align:"center" });

    pdf.setFont("times", "normal");
    pdf.setFontSize(16);
    pdf.setTextColor(30, 41, 59);
    pdf.text("This is proudly presented to", width / 2, 245, { align:"center" });

    pdf.setFont("times", "bold");
    pdf.setFontSize(32);
    pdf.setTextColor(4, 57, 21);
    pdf.text(student.name, width / 2, 294, { align:"center" });

    pdf.setFont("times", "normal");
    pdf.setFontSize(13);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${student.studentId} · ${student.course}`, width / 2, 320, { align:"center" });

    pdf.setFontSize(16);
    pdf.setTextColor(30, 41, 59);
    const body = `for successfully completing ${hours} hours of On-the-Job Training under the ${student.office} office.`;
    const bodyLines = pdf.splitTextToSize(body, width - 210);
    pdf.text(bodyLines, width / 2, 365, { align:"center" });

    pdf.setFontSize(14);
    pdf.text(`Given this ${formatCertificateDate(options.issueDate)}.`, width / 2, 430, { align:"center" });

    pdf.setDrawColor(4, 57, 21);
    pdf.line(160, 500, 330, 500);
    pdf.line(width - 330, 500, width - 160, 500);

    pdf.setFont("times", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(4, 57, 21);
    pdf.text(options.signer, 245, 522, { align:"center" });
    pdf.text("Authorized Representative", width - 245, 522, { align:"center" });

    pdf.setFont("times", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(71, 85, 105);
    pdf.text(options.signerPosition, 245, 540, { align:"center" });
    pdf.text("Province of Misamis Oriental", width - 245, 540, { align:"center" });

    pdf.save(fileName);
}

window.renderCertificates = renderCertificates;
window.openCertificatePreview = openCertificatePreview;
window.refreshCertificatePreview = refreshCertificatePreview;
window.printCertificate = printCertificate;
window.downloadCertificatePdf = downloadCertificatePdf;
window.downloadCertificate = downloadCertificate;


/* PGMO POLISH PATCH 2026-06: bulk DTR approve + certificate ready notifications + OJT ID access/request */

function getAdminOjtIdRequestsTable(){
    return typeof OJT_ID_REQUESTS_TABLE !== "undefined" ? OJT_ID_REQUESTS_TABLE : "ojt_id_requests";
}

function accountToAdminStudent(row){
    const split = splitAdminStudentFullName(row.full_name);
    const lastName = row.last_name || split.lastName;
    const firstName = row.first_name || split.firstName;
    const middleInitial = row.middle_initial || split.middleInitial;
    const formattedName = formatAdminStudentFullName(lastName, firstName, middleInitial);

    return {
        uuid: row.id || "",
        id: row.student_id || "",
        name: formattedName && formattedName.includes(",") ? formattedName : (row.full_name || "Unnamed Student"),
        lastName,
        firstName,
        middleInitial,
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        status: row.ojt_status || "Pending",
        accountStatus: row.status || "Active",
        completed: Number(row.completed_hours ?? 0),
        required: Number(row.required_hours ?? 0),
        email: row.email || "",
        phone: row.phone || row.contact_number || "No phone",
        supervisor: row.supervisor || "",
        idRequestAllowed: row.ojt_id_request_allowed === true,
        idRequestAllowedAt: row.ojt_id_request_allowed_at || null,
        certificateReady: row.certificate_ready === true,
        certificateReadyAt: row.certificate_ready_at || null
    };
}

async function renderStudents(){
    const tbody = document.querySelector("#studentsTableBody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading students...</h5><p>Fetching registered students from Supabase.</p></div></td></tr>`;
    const result = await fetchAdminStudents();
    if(result.error){
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${safeText(result.error)}</p></div></td></tr>`;
        return;
    }

    const search = (document.querySelector("#studentSearch")?.value || "").toLowerCase();
    const status = document.querySelector("#studentStatus")?.value || "All";
    const office = (document.querySelector("#studentOfficeFilter")?.value || "").toLowerCase();
    const list = result.students.filter(s => JSON.stringify(s).toLowerCase().includes(search) && (status === "All" || s.status === status) && (!office || String(s.office || "").toLowerCase().includes(office)));

    tbody.innerHTML = list.length ? list.map(s => `
        <tr>
            <td><strong>${safeText(s.id)}</strong></td>
            <td>${safeText(s.name)}<br><small class="text-secondary">${safeText(s.email)}</small><br><small class="text-secondary">${safeText(s.phone)}</small></td>
            <td>${safeText(s.course)}</td>
            <td>${safeText(s.office)}</td>
            <td>${progressBar(s.completed,s.required)}</td>
            <td>${badge(s.status)}</td>
            <td>
                <div class="action-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${s.uuid}')">View</button>
                    <button class="btn btn-sm btn-outline-warning" onclick="editStudent('${s.uuid}')">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.uuid}')">Delete</button>
                </div>
            </td>
        </tr>`).join("") : emptyRow(7,"fa fa-user-graduate","No students found","Student registrations will appear here.");
}

function viewStudent(uuid){
    const s = adminStudentsCache.find(x => x.uuid === uuid);
    if(!s){ alert("Student not found. Please refresh."); return; }
    document.querySelector("#studentViewBody").innerHTML = `
        <p><strong>Student ID:</strong> ${safeText(s.id)}</p>
        <p><strong>Name:</strong> ${safeText(s.name)}</p>
        <p><strong>Course:</strong> ${safeText(s.course)}</p>
        <p><strong>Office Assigned:</strong> ${safeText(s.office)}</p>
        <p><strong>Status:</strong> ${badge(s.status)}</p>
        <p><strong>Progress:</strong> ${s.completed} / ${s.required || "Not set"} hours</p>
        <p><strong>OJT ID Request Access:</strong> ${s.idRequestAllowed ? badge("Approved") : badge("Pending")}</p>
        <p><strong>Certificate Ready:</strong> ${s.certificateReady ? badge("Approved") : badge("Pending")}</p>
        <p><strong>Email:</strong> ${safeText(s.email)}</p>
        <p><strong>Contact Number:</strong> ${safeText(s.phone)}</p>`;
    new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
}

async function renderOjtIdAccessAdmin(){
    const tbody = document.getElementById("idAccessStudentsTableBody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading students...</h5><p>Checking OJT ID request access.</p></div></td></tr>`;

    const result = await fetchAdminStudents();
    if(result.error){
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${safeText(result.error)}</p></div></td></tr>`;
        return;
    }

    const search = (document.getElementById("idAccessSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("idAccessStatus")?.value || "All";
    const list = result.students.filter(s => {
        const allowed = s.idRequestAllowed ? "Allowed" : "Locked";
        return JSON.stringify(s).toLowerCase().includes(search) && (filter === "All" || filter === allowed);
    });

    if(!list.length){
        tbody.innerHTML = emptyRow(7, "fa fa-id-card", "No students found", "Students will appear here once they are registered.");
        return;
    }

    tbody.innerHTML = list.map(s => {
        const status = s.idRequestAllowed ? badge("Approved") : badge("Pending");
        const action = s.idRequestAllowed
            ? `<button class="btn btn-sm btn-outline-secondary" onclick="revokeOjtIdRequestAccess('${s.uuid}')"><i class="fa fa-lock"></i> Revoke Access</button>`
            : `<button class="btn btn-sm btn-success" onclick="approveOjtIdRequestAccess('${s.uuid}')"><i class="fa fa-check"></i> Approve Access</button>`;
        return `<tr>
            <td><strong>${safeText(s.id)}</strong></td>
            <td><strong>${safeText(s.name)}</strong><br><small class="text-secondary">${safeText(s.email)}</small></td>
            <td>${safeText(s.course)}</td>
            <td>${safeText(s.office)}</td>
            <td>${status}</td>
            <td>${s.idRequestAllowedAt ? new Date(s.idRequestAllowedAt).toLocaleString() : "-"}</td>
            <td><div class="action-group">${action}</div></td>
        </tr>`;
    }).join("");
}

async function approveOjtIdRequestAccess(uuid){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const student = adminStudentsCache.find(s => s.uuid === uuid);
    if(!student){ alert("Student not found."); return; }
    if(!confirm(`Allow ${student.name} to request an OJT ID?`)) return;
    const { error } = await client.from(getAdminStudentAccountsTable()).update({
        ojt_id_request_allowed:true,
        ojt_id_request_allowed_at:new Date().toISOString(),
        ojt_id_request_allowed_by:(typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "admin"),
        updated_at:new Date().toISOString()
    }).eq("id", uuid);
    if(error){ alert(error.message + "\n\nRun the updated Supabase schema if this column is missing."); return; }
    await createStudentNotification(student.id,"OJT ID Request Access Approved","You can now submit your OJT ID request from the OJT ID Request page.","success","ojt_id_request",uuid);
    if(document.body.dataset.page === "id-requests") await renderOjtIdAccessAdmin();
    else await renderStudents();
}

async function revokeOjtIdRequestAccess(uuid){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const student = adminStudentsCache.find(s => s.uuid === uuid);
    if(!student){ alert("Student not found."); return; }
    if(!confirm(`Revoke OJT ID request access for ${student.name}?`)) return;
    const { error } = await client.from(getAdminStudentAccountsTable()).update({
        ojt_id_request_allowed:false,
        updated_at:new Date().toISOString()
    }).eq("id", uuid);
    if(error){ alert(error.message); return; }
    await createStudentNotification(student.id,"OJT ID Request Access Revoked","Your OJT ID request access was revoked. Please contact your coordinator for details.","warning","ojt_id_request",uuid);
    if(document.body.dataset.page === "id-requests") await renderOjtIdAccessAdmin();
    else await renderStudents();
}

async function renderOjtIdRequestsAdmin(){
    const tbody = document.getElementById("idRequestsTableBody");
    if(!tbody) return;
    const client = initSupabaseAdmin();
    if(!client){ tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase config missing</h5><p>Open assets/js/config.js first.</p></div></td></tr>`; return; }
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading OJT ID requests...</h5></div></td></tr>`;
    const { data, error } = await client.from(getAdminOjtIdRequestsTable()).select("*").order("created_at", {ascending:false});
    if(error){ tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load ID requests</h5><p>${safeText(error.message)}</p></div></td></tr>`; return; }
    if(!data || !data.length){ tbody.innerHTML = emptyRow(6,"fa fa-id-card","No OJT ID requests yet","Student ID requests will appear here after access is approved and a request is submitted."); return; }
    tbody.innerHTML = data.map(req => {
        const actions = req.status === "Pending" ? `
            <button class="btn btn-sm btn-success" onclick="setOjtIdRequestStatus('${req.id}','Approved')">Approve</button>
            <button class="btn btn-sm btn-outline-danger" onclick="setOjtIdRequestStatus('${req.id}','Rejected')">Reject</button>` : `<button class="btn btn-sm btn-outline-secondary" disabled>Done</button>`;
        return `<tr>
            <td><strong>${safeText(req.student_name)}</strong><br><small>${safeText(req.student_id)} · ${safeText(req.course)}</small></td>
            <td>${safeText(req.office_assigned)}</td>
            <td>${safeText(req.purpose || "-")} ${req.admin_remarks ? `<br><small class="text-danger">Admin: ${safeText(req.admin_remarks)}</small>` : ""}</td>
            <td>${badge(req.status || "Pending")}</td>
            <td>${req.created_at ? new Date(req.created_at).toLocaleString() : "-"}</td>
            <td><div class="action-group">${actions}</div></td>
        </tr>`;
    }).join("");
}

async function setOjtIdRequestStatus(id, status){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const remarks = status === "Rejected" ? prompt("Reason for rejection:", "Please coordinate with the OJT office.") : prompt("Admin remarks, optional:", "OJT ID request approved.");
    if(remarks === null) return;
    const { data: rows } = await client.from(getAdminOjtIdRequestsTable()).select("*").eq("id", id).limit(1);
    const req = rows && rows[0];
    const { error } = await client.from(getAdminOjtIdRequestsTable()).update({
        status: status,
        admin_remarks: remarks || status,
        approved_by:(typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "admin"),
        approved_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
    }).eq("id", id);
    if(error){ alert(error.message); return; }
    if(req){
        await createStudentNotification(req.student_id, `OJT ID Request ${status}`, status === "Approved" ? "Your OJT ID request has been approved." : "Your OJT ID request was rejected. Please check the admin remarks.", status === "Approved" ? "success" : "error", "ojt_id_request", id);
    }
    await renderOjtIdRequestsAdmin();
    if(document.body.dataset.page === "id-requests" && typeof renderOjtIdAccessAdmin === "function") await renderOjtIdAccessAdmin();
}

async function renderMonthlyDtrAdmin(){
    const tbody = document.getElementById("monthlyDtrAdminTable");
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading DTR forms...</h5><p>Fetching monthly DTR submissions.</p></div></td></tr>`;
    const client = initSupabaseAdmin();
    if(!client){ tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase config missing</h5><p>Open assets/js/config.js first.</p></div></td></tr>`; return; }
    const {data, error} = await client.from(getAdminDtrFormsTable()).select("*").order("created_at", {ascending:false});
    if(error){ tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load DTR</h5><p>${safeText(error.message)}</p></div></td></tr>`; return; }
    monthlyDtrAdminCache = data || [];
    const stats = { dtrTotalLogs:monthlyDtrAdminCache.length, dtrPendingLogs:monthlyDtrAdminCache.filter(x=>x.status==="Pending").length, dtrApprovedLogs:monthlyDtrAdminCache.filter(x=>x.status==="Approved").length, dtrRejectedLogs:monthlyDtrAdminCache.filter(x=>x.status==="Rejected").length };
    Object.entries(stats).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.textContent=value; });
    const search = (document.getElementById("dtrSearch")?.value || "").toLowerCase();
    const status = document.getElementById("dtrStatusFilter")?.value || "All";
    const list = monthlyDtrAdminCache.filter(form => JSON.stringify(form).toLowerCase().includes(search) && (status === "All" || form.status === status));
    if(!list.length){ tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa fa-calendar-days"></i><h5>No DTR submissions found</h5><p>Submitted monthly DTR forms will appear here.</p></div></td></tr>`; updateBulkDtrButtonState(); return; }
    tbody.innerHTML = list.map(form => `
        <tr>
            <td><input type="checkbox" class="dtr-bulk-checkbox" value="${form.id}" ${form.status !== "Pending" ? "disabled" : ""} onchange="updateBulkDtrButtonState()"></td>
            <td>${safeText(form.month_label || form.month)}</td>
            <td><strong>${safeText(form.student_name)}</strong><br><small class="text-secondary">${safeText(form.student_id)} · ${safeText(form.course)}</small></td>
            <td>${safeText(form.office_assigned)}</td>
            <td><strong>${Number(form.total_hours || 0)}</strong> hr(s)</td>
            <td>${badge(form.status || "Pending")}</td>
            <td>${safeText(form.admin_remarks || "-")}</td>
            <td>${form.created_at ? new Date(form.created_at).toLocaleString() : "-"}</td>
            <td>${monthlyDtrActions(form)}</td>
        </tr>`).join("");
    const selectAll = document.getElementById("selectAllPendingDtr");
    if(selectAll) selectAll.checked = false;
    updateBulkDtrButtonState();
}

function getSelectedPendingDtrIds(){
    return Array.from(document.querySelectorAll(".dtr-bulk-checkbox:checked:not(:disabled)")).map(cb => cb.value);
}

function updateBulkDtrButtonState(){
    const ids = getSelectedPendingDtrIds();
    const btn = document.getElementById("bulkApproveDtrButton");
    const hint = document.getElementById("bulkDtrHint");
    if(btn) btn.disabled = ids.length === 0;
    if(hint) hint.textContent = ids.length ? `${ids.length} pending DTR selected.` : "Select pending DTR records to approve multiple submissions.";
}

function toggleAllPendingDtr(source){
    document.querySelectorAll(".dtr-bulk-checkbox:not(:disabled)").forEach(cb => cb.checked = source.checked);
    updateBulkDtrButtonState();
}

async function bulkApproveMonthlyDtr(){
    const ids = getSelectedPendingDtrIds();
    if(!ids.length){ alert("Select at least one pending DTR."); return; }
    if(!confirm(`Approve ${ids.length} pending DTR submission(s)?`)) return;
    const remarks = prompt("Admin remarks for selected DTR:", "DTR approved") || "DTR approved";
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const adminName = typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : (sessionStorage.getItem("interntrack_username") || "admin");
    const selectedForms = monthlyDtrAdminCache.filter(form => ids.includes(form.id) && form.status === "Pending");
    const { error } = await client.from(getAdminDtrFormsTable()).update({
        status:"Approved",
        admin_remarks:remarks,
        approved_by:adminName,
        approved_at:new Date().toISOString()
    }).in("id", selectedForms.map(f => f.id)).eq("status", "Pending");
    if(error){ alert(error.message); return; }
    const uniqueStudents = [...new Set(selectedForms.map(f => f.student_id).filter(Boolean))];
    for(const studentId of uniqueStudents){
        await recalculateStudentHoursFromApprovedDtr(client, studentId);
    }
    for(const form of selectedForms){
        await createStudentNotification(form.student_id, "DTR Approved", `${form.month_label || form.month} DTR has been approved. Your completed hours were updated.`, "success", "dtr", form.id);
    }
    await renderMonthlyDtrAdmin();
    alert(`${selectedForms.length} DTR submission(s) approved.`);
}

function mapCertificateStudent(row){
    const completed = Number(row.completed_hours || 0);
    const required = Number(row.required_hours || 0);
    const status = row.ojt_status || row.status || (required > 0 && completed >= required ? "Completed" : "Pending");
    return {
        uuid: row.id || "",
        studentId: row.student_id || "",
        name: row.full_name || "Unnamed Student",
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        completed, required,
        supervisor: row.supervisor || "OJT Coordinator",
        status,
        email: row.email || "",
        certificateReady: row.certificate_ready === true,
        certificateReadyAt: row.certificate_ready_at || null
    };
}

async function renderCertificates(){
    const tbody = document.getElementById("certificatesTableBody");
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading certificates...</h5><p>Checking student completion records from Supabase.</p></div></td></tr>`;
    const result = await fetchCertificateStudents();
    if(result.error){ tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${certificateEscape(result.error)}</p></div></td></tr>`; return; }
    certificateStudentsCache = result.students;
    const eligibleCount = certificateStudentsCache.filter(isCertificateEligible).length;
    const completedCount = certificateStudentsCache.filter(student => String(student.status).toLowerCase() === "completed" || isCertificateEligible(student)).length;
    const pendingCount = Math.max(certificateStudentsCache.length - eligibleCount, 0);
    const eligibleEl = document.getElementById("certEligibleCount");
    const completedEl = document.getElementById("certCompletedCount");
    const pendingEl = document.getElementById("certPendingCount");
    if(eligibleEl) eligibleEl.textContent = eligibleCount;
    if(completedEl) completedEl.textContent = completedCount;
    if(pendingEl) pendingEl.textContent = pendingCount;
    const search = (document.getElementById("certificateSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("certificateEligibility")?.value || "All";
    const list = certificateStudentsCache.filter(student => {
        const eligible = isCertificateEligible(student);
        const matchesSearch = JSON.stringify(student).toLowerCase().includes(search);
        const matchesFilter = filter === "All" || (filter === "Eligible" && eligible) || (filter === "Not Eligible" && !eligible);
        return matchesSearch && matchesFilter;
    });
    if(!list.length){ tbody.innerHTML = emptyRow(6, "fa fa-award", "No certificate records found", "Completed students will appear here once their required OJT hours are reached."); return; }
    tbody.innerHTML = list.map(student => {
        const eligible = isCertificateEligible(student);
        const requiredLabel = student.required > 0 ? student.required : "Not set";
        const readyLabel = student.certificateReady ? `<span class="badge-soft badge-approved">Ready</span>` : (eligible ? `<span class="badge-soft badge-eligible">Eligible</span>` : `<span class="badge-soft badge-pending">Locked</span>`);
        const action = eligible ? `
            <div class="action-group">
                <button class="btn btn-sm btn-outline-success" onclick="certifyStudentReady('${student.uuid}')" ${student.certificateReady ? "disabled" : ""}>${student.certificateReady ? "Ready Sent" : "Certify Ready"}</button>
                <button class="btn btn-sm btn-outline-primary" onclick="openCertificatePreview('${student.uuid}')">Generate</button>
            </div>` : `<button class="btn btn-sm btn-outline-secondary" disabled>Locked</button>`;
        return `<tr>
            <td><strong>${certificateEscape(student.name)}</strong><br><small class="text-secondary">${certificateEscape(student.studentId)} · ${certificateEscape(student.email)}</small></td>
            <td>${certificateEscape(student.office)}</td>
            <td>${certificateEscape(student.course)}</td>
            <td>${student.completed} / ${requiredLabel}</td>
            <td>${readyLabel}</td>
            <td>${action}</td>
        </tr>`;
    }).join("");
}

async function certifyStudentReady(uuid){
    const student = certificateStudentsCache.find(item => item.uuid === uuid);
    if(!student){ alert("Student record not found. Please refresh."); return; }
    if(!isCertificateEligible(student)){ alert("This student is not yet eligible for certification."); return; }
    if(!confirm(`Certify ${student.name} as ready for certificate and notify the student?`)) return;
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }
    const adminName = typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "admin";
    const { error } = await client.from(getAdminStudentAccountsTable()).update({
        certificate_ready:true,
        certificate_ready_at:new Date().toISOString(),
        certificate_ready_by:adminName,
        updated_at:new Date().toISOString()
    }).eq("id", uuid);
    if(error){ alert(error.message + "\n\nRun the updated Supabase schema if this column is missing."); return; }
    await createStudentNotification(student.studentId, "Certificate Ready", "Your certificate is ready. Please coordinate with your OJT coordinator or office for release.", "success", "certificate", uuid);
    await renderCertificates();
}

/* PGMO PATCH 2026-06-25: flexible secure invite-only student registration admin tools */
function getRegistrationInvitesTable(){
    return typeof REGISTRATION_INVITES_TABLE !== "undefined" ? REGISTRATION_INVITES_TABLE : "registration_invites";
}

function cleanInviteText(value){
    return String(value || "").trim();
}

function cleanCodePrefix(value){
    const prefix = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/@.*/, "")
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 12);
    return prefix || "PGMO";
}

function generateRandomRegistrationPart(length = 6){
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let code = "";
    bytes.forEach(value => code += alphabet[value % alphabet.length]);
    return code;
}

function generateRegistrationCode(row = {}){
    // Code must not reveal the student's last name.
    return `PGMO-${generateRandomRegistrationPart(8)}`;
}

function normalizeInviteRow(row){
    const normalized = {
        student_id: cleanInviteText(row.student_id).toUpperCase(),
        last_name: cleanInviteText(row.last_name).toUpperCase(),
        first_name: cleanInviteText(row.first_name),
        middle_initial: cleanInviteText(row.middle_initial).toUpperCase().charAt(0),
        email: cleanInviteText(row.email).toLowerCase(),
        course: cleanInviteText(row.course),
        office_assigned: cleanInviteText(row.office_assigned) || "Not assigned",
        contact_number: cleanInviteText(row.contact_number)
    };

    if(!normalized.last_name){
        return null;
    }

    return normalized;
}

function inferInviteRowFromColumns(cols){
    const row = {
        student_id: "",
        last_name: "",
        first_name: "",
        middle_initial: "",
        email: "",
        course: "",
        office_assigned: "Not assigned",
        contact_number: ""
    };

    cols.forEach(raw => {
        const value = cleanInviteText(raw);
        if(!value) return;

        if(value.includes("@") && !row.email){
            row.email = value;
            return;
        }

        if((/[A-Za-z]+[-_ ]?\d/.test(value) || /^\d/.test(value)) && !row.student_id){
            row.student_id = value;
            return;
        }

        if(!row.last_name){
            row.last_name = value;
            return;
        }
    });

    return row;
}

function parseInviteBulkText(text){
    const lines = String(text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if(!lines.length) return [];

    const firstColumns = lines[0].split(/,|\t/).map(value => value.trim().toLowerCase().replace(/\s+/g, "_"));
    const knownHeaders = ["student_id", "studentid", "student", "last_name", "lastname", "email", "email_address", "course", "office_assigned", "contact_number"];
    const hasHeader = firstColumns.some(col => knownHeaders.includes(col));
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map(line => {
        const cols = line.split(/,|\t/).map(value => value.trim());

        if(hasHeader){
            const row = {};
            firstColumns.forEach((header, index) => {
                const value = cols[index] || "";
                if(["student_id", "studentid", "student"].includes(header)) row.student_id = value;
                else if(["last_name", "lastname"].includes(header)) row.last_name = value;
                else if(["first_name", "firstname"].includes(header)) row.first_name = value;
                else if(["middle_initial", "middleinitial", "mi"].includes(header)) row.middle_initial = value;
                else if(["email", "email_address"].includes(header)) row.email = value;
                else if(header === "course") row.course = value;
                else if(["office_assigned", "office", "department"].includes(header)) row.office_assigned = value;
                else if(["contact_number", "contact", "phone"].includes(header)) row.contact_number = value;
            });
            return normalizeInviteRow(row);
        }

        if(cols.length >= 5){
            return normalizeInviteRow({
                student_id: cols[0] || "",
                last_name: cols[1] || "",
                first_name: cols[2] || "",
                middle_initial: cols[3] || "",
                email: cols[4] || "",
                course: cols[5] || "",
                office_assigned: cols[6] || "Not assigned",
                contact_number: cols[7] || ""
            });
        }

        return normalizeInviteRow(inferInviteRowFromColumns(cols));
    }).filter(Boolean);
}

function buildSecureRegisterLink(item){
    const params = new URLSearchParams();
    params.set("code", item.code);
    return `../student-portal/secure-register.html?${params.toString()}`;
}

async function createRegistrationInviteRecord(row){
    const client = initSupabaseAdmin();
    const code = generateRegistrationCode(row);

    const { data, error } = await client.rpc("admin_create_registration_invite", {
        p_student_id: row.student_id || "",
        p_last_name: row.last_name || "",
        p_first_name: row.first_name || "",
        p_middle_initial: row.middle_initial || "",
        p_email: row.email || "",
        p_course: row.course || "",
        p_office_assigned: row.office_assigned || "Not assigned",
        p_contact_number: row.contact_number || "",
        p_registration_code: code,
        p_expires_days: 1
    });

    const result = Array.isArray(data) ? data[0] : data;
    if(error || !result || result.ok !== true){
        throw new Error(error ? error.message : (result?.message || "Could not create invite."));
    }

    return { ...row, code };
}

function updateSingleInvitePlaceholder(){
    const input = document.getElementById("singleInviteValue");
    const help = document.getElementById("singleInviteHelp");
    if(input){
        input.placeholder = "ex: SANTOS";
        input.type = "text";
    }
    if(help){
        help.textContent = "Enter only the student's last name. The generated code will not show the last name.";
    }
}

function getSingleInviteRow(){
    const value = cleanInviteText(document.getElementById("singleInviteValue")?.value || "").toUpperCase();

    if(!value){
        return null;
    }

    return normalizeInviteRow({
        student_id: "",
        last_name: value,
        first_name: "",
        middle_initial: "",
        email: "",
        course: "",
        office_assigned: "Not assigned",
        contact_number: ""
    });
}

async function createSingleRegistrationInvite(){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const row = getSingleInviteRow();

    if(!row){
        alert("Enter the student's last name.");
        return;
    }

    const verificationLastName = row.last_name;
    if(!confirm("Generate one registration code for this last name? The code itself will not show the last name.")) return;

    const output = document.getElementById("inviteGeneratedOutput");

    try{
        const generated = await createRegistrationInviteRecord(row);
        const link = buildSecureRegisterLink(generated);
        const codeText = [
            `Registration Code: ${generated.code}`,
            `Last Name Verification: Saved internally`,
            `Attempts: 0 / 3`,
            `Expires: 1 hour from generation`,
            `Secure Register Link: ${link}`,
            `Used By: Not used yet`
        ];

        if(output){
            output.classList.remove("invite-output-empty");
            output.dataset.copyText = codeText.join("\n");
            output.innerHTML = `
                <div class="invite-main-code">
                    <span>Registration Code</span>
                    <strong>${safeText(generated.code)}</strong>
                </div>
                <div class="invite-details-box">
                    <div class="invite-detail-row"><span>Last Name Verification</span><strong>Saved internally</strong></div>
                    <div class="invite-detail-row"><span>Attempts</span><strong>0 / 3</strong></div>
                    <div class="invite-detail-row"><span>Expires</span><strong>1 hour from generation</strong></div>
                    <div class="invite-detail-row"><span>Used By</span><strong>Not used yet</strong></div>
                    <div class="invite-detail-row invite-detail-link"><span>Secure Register Link</span><strong>${safeText(link)}</strong></div>
                </div>
            `;
        }
        alert("Registration code generated. Copy the code/link before leaving this page.");

        const input = document.getElementById("singleInviteValue");
        if(input) input.value = "";

        await loadRegistrationInvitesAdmin();
    }catch(error){
        if(String(error.message).toLowerCase().includes("admin_create_registration_invite")){
            alert("Secure invite functions are not installed yet. Run admin-integration/database/supabase_secure_invite_registration.sql in Supabase first.");
        }else{
            alert(error.message);
        }
    }
}

async function bulkCreateRegistrationInvites(){
    alert("Bulk code generation has been removed. Generate one registration code per student using the last-name form above.");
}

function copyGeneratedInviteCodes(){
    const output = document.getElementById("inviteGeneratedOutput");
    const text = (output?.dataset?.copyText || output?.value || output?.innerText || "").trim();
    if(!text){
        alert("No generated codes to copy yet.");
        return;
    }

    if(navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(text)
            .then(() => alert("Generated code and details copied."))
            .catch(() => fallbackCopyInviteText(text));
    }else{
        fallbackCopyInviteText(text);
    }
}

function fallbackCopyInviteText(text){
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "readonly");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    alert("Generated code and details copied.");
}

async function loadRegistrationInvitesAdmin(){
    const tbody = document.getElementById("registrationInvitesTableBody");
    if(!tbody) return;

    const client = initSupabaseAdmin();
    if(!client){
        tbody.innerHTML = emptyRow(8, "fa fa-triangle-exclamation", "Supabase missing", "Open assets/js/config.js first.");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading registration invites...</h5><p>Checking allowed-student access records.</p></div></td></tr>`;

    const { data, error } = await client.rpc("admin_list_registration_invites");

    if(error){
        tbody.innerHTML = emptyRow(8, "fa fa-triangle-exclamation", "Secure invites not installed", "Run admin-integration/database/supabase_secure_invite_registration.sql in Supabase first.");
        return;
    }

    const list = data || [];
    if(!list.length){
        tbody.innerHTML = emptyRow(8, "fa fa-key", "No registration invites yet", "Generate one code using the student last name.");
        return;
    }

    tbody.innerHTML = list.map(item => {
        const status = item.status || "unused";
        const canRevoke = status === "unused";
        const canUnrevoke = status === "revoked" || status === "expired";
        const expires = item.expires_at ? new Date(item.expires_at).toLocaleString() : "-";
        const name = item.full_name || [item.last_name, item.first_name].filter(Boolean).join(", ");
        const identifier = item.last_name || "Approved Student";
        const usedByName = item.used_by_full_name || item.used_by_name || "";
        const usedByLastName = item.used_by_last_name || (usedByName.includes(",") ? usedByName.split(",")[0] : "");
        const usedByStudentId = item.used_by_student_id || "";
        const displayEmail = item.email || item.used_by_email || "-";
        const usedBy = status === "used"
            ? `<strong>${safeText(usedByName || "Registered account")}</strong><br><small>Verified last name: ${safeText(usedByLastName || identifier || "-")}</small><br><small>${safeText(usedByStudentId || item.used_by_student_account_id || "Account recorded")}</small>`
            : `<span class="text-secondary">-</span>`;
        const actions = `
            <div class="registration-key-actions">
                <button class="btn btn-sm btn-outline-danger" onclick="revokeRegistrationInvite('${item.id}')" ${canRevoke ? "" : "disabled"}>Revoke</button>
                <button class="btn btn-sm btn-outline-success" onclick="unrevokeRegistrationInvite('${item.id}')" ${canUnrevoke ? "" : "disabled"}>Unrevoke</button>
                <button class="btn btn-sm btn-outline-dark" onclick="deleteRegistrationInvite('${item.id}')">Delete</button>
            </div>
        `;
        return `
            <tr>
                <td><strong>${safeText(identifier)}</strong><br><small>${safeText(name || "Invite-only access")}</small></td>
                <td>${safeText(displayEmail)}</td>
                <td>${safeText(item.course || "-")}<br><small>${safeText(item.office_assigned || "Not assigned")}</small></td>
                <td>${badge(status)}</td>
                <td>${Number(item.attempts || 0)} / ${Number(item.max_attempts || 3)}</td>
                <td>${safeText(expires)}</td>
                <td class="used-by-cell">${usedBy}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join("");
}

async function revokeRegistrationInvite(id){
    if(!confirm("Revoke this registration invite? The student will no longer be able to use its code.")) return;

    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const { data, error } = await client.rpc("admin_revoke_registration_invite", { p_invite_id: id });
    const result = Array.isArray(data) ? data[0] : data;

    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not revoke invite."));
        return;
    }

    await loadRegistrationInvitesAdmin();
}

async function unrevokeRegistrationInvite(id){
    if(!confirm("Unrevoke this registration invite? It will become usable again for 1 hour and attempts will reset to 0.")) return;

    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const { data, error } = await client.rpc("admin_unrevoke_registration_invite", { p_invite_id: id });
    const result = Array.isArray(data) ? data[0] : data;

    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not unrevoke invite."));
        return;
    }

    await loadRegistrationInvitesAdmin();
}

async function deleteRegistrationInvite(id){
    if(!confirm("Delete this registration key record? This removes the key from the invite list. It will not delete the registered student account.")) return;

    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const { data, error } = await client.rpc("admin_delete_registration_invite", { p_invite_id: id });
    const result = Array.isArray(data) ? data[0] : data;

    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not delete invite."));
        return;
    }

    await loadRegistrationInvitesAdmin();
}

document.addEventListener("DOMContentLoaded", () => {
    if(document.body.dataset.page === "secure-registration"){
        loadRegistrationInvitesAdmin();
    }
    if(document.body.dataset.page === "id-requests"){
        renderOjtIdAccessAdmin();
        renderOjtIdRequestsAdmin();
    }
});

/* PGMO PATCH: admin save student through RPC so public registration insert can stay disabled */
async function saveStudent(){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const studentId = (document.querySelector("#studentIdInput").value || "").trim().toUpperCase();
    const lastName = (document.querySelector("#studentLastName").value || "").trim().toUpperCase();
    const firstName = (document.querySelector("#studentFirstName").value || "").trim();
    const middleInitial = (document.querySelector("#studentMiddleInitial").value || "").trim().toUpperCase().charAt(0);
    const course = (document.querySelector("#studentCourseInput").value || "").trim();
    const office = (document.querySelector("#studentOffice").value || "").trim() || "Not assigned";
    const status = document.querySelector("#studentStatusInput").value;
    const completed = Number(document.querySelector("#studentCompleted").value || 0);
    const required = Number(document.querySelector("#studentRequired").value || 0);
    const email = (document.querySelector("#studentEmail").value || "").trim().toLowerCase();
    const phone = (document.querySelector("#studentPhone").value || "").trim();
    const tempPassword = (document.querySelector("#studentPassword")?.value || "").trim();

    if(!studentId){ alert("Student ID is required."); return; }
    if(!lastName || !firstName){ alert("Last name and first name are required."); return; }
    if(!course){ alert("Course is required."); return; }
    if(!email){ alert("Email is required."); return; }
    if(completed < 0){ alert("Completed hours cannot be negative."); return; }
    if(required <= 0){ alert("Required hours must be set by the admin."); return; }

    const finalStatus = required > 0 && completed >= required ? "Completed" : status;
    const passwordHash = tempPassword ? await adminHashPassword(tempPassword) : (editingStudentUuid ? null : await adminHashPassword("student123"));

    const { data, error } = await client.rpc("admin_save_student_account", {
        p_existing_id: editingStudentUuid || null,
        p_student_id: studentId,
        p_last_name: lastName,
        p_first_name: firstName,
        p_middle_initial: middleInitial,
        p_course: course,
        p_office_assigned: office,
        p_email: email,
        p_phone: phone,
        p_ojt_status: finalStatus,
        p_completed_hours: completed,
        p_required_hours: required,
        p_password_hash: passwordHash
    });

    const result = Array.isArray(data) ? data[0] : data;

    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not save student. Run the secure invite SQL patch first."));
        return;
    }

    bootstrap.Modal.getInstance(document.querySelector("#studentModal")).hide();
    await renderStudents();
}

/* PGMO PATCH: initialize one-by-one registration access form */
document.addEventListener("DOMContentLoaded", function(){
    if(document.getElementById("singleInviteValue")){
        updateSingleInvitePlaceholder();
    }
});

window.renderOjtIdAccessAdmin = renderOjtIdAccessAdmin;


/* PGMO PATCH: school field, improved reports CSV, and PDF-template certificate */
function getStudentSchool(row){
    return row.school || row.school_name || "";
}

function accountToAdminStudent(row){
    const split = splitAdminStudentFullName(row.full_name);
    const lastName = row.last_name || split.lastName;
    const firstName = row.first_name || split.firstName;
    const middleInitial = row.middle_initial || split.middleInitial;
    const formattedName = formatAdminStudentFullName(lastName, firstName, middleInitial);

    return {
        uuid: row.id || "",
        id: row.student_id || "",
        name: formattedName && formattedName.includes(",") ? formattedName : (row.full_name || "Unnamed Student"),
        lastName,
        firstName,
        middleInitial,
        school: getStudentSchool(row),
        gender: row.gender || "",
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        status: row.ojt_status || "Pending",
        accountStatus: row.status || "Active",
        completed: Number(row.completed_hours ?? 0),
        required: Number(row.required_hours ?? 0),
        email: row.email || "",
        phone: row.phone || row.contact_number || "No phone",
        supervisor: row.supervisor || ""
    };
}

async function renderStudents(){
    const tbody = document.querySelector("#studentsTableBody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading students...</h5><p>Fetching registered students from Supabase.</p></div></td></tr>`;

    const result = await fetchAdminStudents();

    if(result.error){
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${safeText(result.error)}</p></div></td></tr>`;
        return;
    }

    const search = (document.querySelector("#studentSearch")?.value || "").toLowerCase();
    const status = document.querySelector("#studentStatus")?.value || "All";
    const office = (document.querySelector("#studentOfficeFilter")?.value || "").toLowerCase();

    const list = result.students.filter(s => JSON.stringify(s).toLowerCase().includes(search)
        && (status === "All" || s.status === status)
        && (!office || String(s.office || "").toLowerCase().includes(office))
    );

    tbody.innerHTML = list.length ? list.map(s => `
        <tr>
            <td><strong>${safeText(s.id)}</strong></td>
            <td>${safeText(s.name)}<br><small class="text-secondary">${safeText(s.email)}</small><br><small class="text-secondary">${safeText(s.phone)}</small></td>
            <td>${safeText(s.school || "Not set")}</td>
            <td>${safeText(s.course)}</td>
            <td>${safeText(s.office)}</td>
            <td>${progressBar(s.completed,s.required)}</td>
            <td>${badge(s.status)}</td>
            <td><div class="action-group"><button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${s.uuid}')">View</button><button class="btn btn-sm btn-outline-warning" onclick="editStudent('${s.uuid}')">Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.uuid}')">Delete</button></div></td>
        </tr>
    `).join("") : emptyRow(8,"fa fa-user-graduate","No students found","Student registrations will appear here.");
}

function editStudent(uuid){
    const s = adminStudentsCache.find(x => x.uuid === uuid);
    if(!s){ alert("Student not found. Please refresh."); return; }

    editingStudentId = s.id;
    editingStudentUuid = uuid;

    document.querySelector("#studentModalTitle").textContent = "Edit Student";
    document.querySelector("#studentIdInput").value = s.id;
    document.querySelector("#studentLastName").value = s.lastName || splitAdminStudentFullName(s.name).lastName;
    document.querySelector("#studentFirstName").value = s.firstName || splitAdminStudentFullName(s.name).firstName;
    document.querySelector("#studentMiddleInitial").value = s.middleInitial || splitAdminStudentFullName(s.name).middleInitial;
    const schoolInput = document.querySelector("#studentSchoolInput");
    if(schoolInput) schoolInput.value = s.school || "";
    const genderInput = document.querySelector("#studentGenderInput");
    if(genderInput) genderInput.value = s.gender || "";
    document.querySelector("#studentCourseInput").value = s.course;
    document.querySelector("#studentOffice").value = s.office;
    document.querySelector("#studentStatusInput").value = s.status;
    document.querySelector("#studentCompleted").value = s.completed;
    document.querySelector("#studentRequired").value = s.required || "";
    document.querySelector("#studentEmail").value = s.email;
    document.querySelector("#studentPhone").value = s.phone === "No phone" ? "" : s.phone;

    const password = document.querySelector("#studentPassword");
    if(password){ password.value = ""; password.placeholder = "Leave blank to keep current password"; }

    new bootstrap.Modal(document.querySelector("#studentModal")).show();
}

function viewStudent(uuid){
    const s = adminStudentsCache.find(x => x.uuid === uuid);
    if(!s){ alert("Student not found. Please refresh."); return; }

    document.querySelector("#studentViewBody").innerHTML = `
        <p><strong>Student ID:</strong> ${safeText(s.id)}</p>
        <p><strong>Name:</strong> ${safeText(s.name)}</p>
        <p><strong>School:</strong> ${safeText(s.school || "Not set")}</p>
        <p><strong>Course:</strong> ${safeText(s.course)}</p>
        <p><strong>Office Assigned:</strong> ${safeText(s.office)}</p>
        <p><strong>Status:</strong> ${badge(s.status)}</p>
        <p><strong>Progress:</strong> ${s.completed} / ${s.required || "Not set"} hours</p>
        <p><strong>Email:</strong> ${safeText(s.email)}</p>
        <p><strong>Contact Number:</strong> ${safeText(s.phone)}</p>
    `;
    new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
}

async function saveStudent(){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const studentId = (document.querySelector("#studentIdInput").value || "").trim().toUpperCase();
    const lastName = (document.querySelector("#studentLastName").value || "").trim().toUpperCase();
    const firstName = (document.querySelector("#studentFirstName").value || "").trim();
    const middleInitial = (document.querySelector("#studentMiddleInitial").value || "").trim().toUpperCase().charAt(0);
    const school = (document.querySelector("#studentSchoolInput")?.value || "").trim();
    const course = (document.querySelector("#studentCourseInput").value || "").trim();
    const office = (document.querySelector("#studentOffice").value || "").trim() || "Not assigned";
    const status = document.querySelector("#studentStatusInput").value;
    const completed = Number(document.querySelector("#studentCompleted").value || 0);
    const required = Number(document.querySelector("#studentRequired").value || 0);
    const email = (document.querySelector("#studentEmail").value || "").trim().toLowerCase();
    const phone = (document.querySelector("#studentPhone").value || "").trim();
    const tempPassword = (document.querySelector("#studentPassword")?.value || "").trim();

    if(!studentId){ alert("Student ID is required."); return; }
    if(!lastName || !firstName){ alert("Last name and first name are required."); return; }
    if(!course){ alert("Course is required."); return; }
    if(!email){ alert("Email is required."); return; }
    if(completed < 0){ alert("Completed hours cannot be negative."); return; }
    if(required <= 0){ alert("Required hours must be set by the admin."); return; }

    const finalStatus = required > 0 && completed >= required ? "Completed" : status;
    const passwordHash = tempPassword ? await adminHashPassword(tempPassword) : (editingStudentUuid ? null : await adminHashPassword("student123"));

    const { data, error } = await client.rpc("admin_save_student_account", {
        p_existing_id: editingStudentUuid || null,
        p_student_id: studentId,
        p_last_name: lastName,
        p_first_name: firstName,
        p_middle_initial: middleInitial,
        p_school: school,
        p_course: course,
        p_office_assigned: office,
        p_email: email,
        p_phone: phone,
        p_ojt_status: finalStatus,
        p_completed_hours: completed,
        p_required_hours: required,
        p_password_hash: passwordHash
    });

    const result = Array.isArray(data) ? data[0] : data;
    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not save student. Run the updated SQL patch first."));
        return;
    }

    bootstrap.Modal.getInstance(document.querySelector("#studentModal")).hide();
    await renderStudents();
}

let reportStudentsCache = [];

function getFilteredReportStudents(){
    const search = (document.getElementById("reportSearch")?.value || "").toLowerCase();
    const status = document.getElementById("reportStatusFilter")?.value || "All";
    const office = document.getElementById("reportOfficeFilter")?.value || "All";

    return reportStudentsCache.filter(student => {
        return JSON.stringify(student).toLowerCase().includes(search)
            && (status === "All" || student.status === status)
            && (office === "All" || student.office === office);
    });
}

function setBar(id, labelId, value, total){
    const pct = total ? Math.round((value / total) * 100) : 0;
    const bar = document.getElementById(id);
    const label = document.getElementById(labelId);
    if(bar) bar.style.width = pct + "%";
    if(label) label.textContent = pct + "%";
}

function populateReportOfficeFilter(students){
    const select = document.getElementById("reportOfficeFilter");
    if(!select || select.dataset.ready === "true") return;
    const offices = [...new Set(students.map(s => s.office || "Not assigned"))].sort();
    select.innerHTML = `<option value="All">All Offices</option>` + offices.map(office => `<option value="${safeText(office)}">${safeText(office)}</option>`).join("");
    select.dataset.ready = "true";
}

async function renderReports(){
    const tbody = document.getElementById("reportsTableBody");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading report...</h5><p>Fetching live student data.</p></div></td></tr>`;

    const result = await fetchAdminStudents();
    if(result.error){
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load reports</h5><p>${safeText(result.error)}</p></div></td></tr>`;
        return;
    }

    reportStudentsCache = result.students;
    populateReportOfficeFilter(reportStudentsCache);
    const list = getFilteredReportStudents();
    const total = list.length;
    const pending = list.filter(s => s.status === "Pending").length;
    const ongoing = list.filter(s => s.status === "Ongoing").length;
    const completed = list.filter(s => s.status === "Completed" || (Number(s.required) > 0 && Number(s.completed) >= Number(s.required))).length;
    const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);

    const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
    setText("reportStudents", total);
    setText("reportActive", ongoing);
    setText("reportCompleted", completed);
    setText("reportTotalHours", Number(totalHours.toFixed(2)));
    setBar("ongoingBar", "ongoingLabel", ongoing, total);
    setBar("pendingBar", "pendingLabel", pending, total);
    setBar("completedBar", "completedLabel", completed, total);

    const officeCounts = {};
    list.forEach(s => { officeCounts[s.office || "Not assigned"] = (officeCounts[s.office || "Not assigned"] || 0) + 1; });
    const officeBox = document.getElementById("officeSummaryList");
    if(officeBox){
        const rows = Object.entries(officeCounts).sort((a,b) => b[1] - a[1]).slice(0, 8);
        officeBox.innerHTML = rows.length ? rows.map(([office,count]) => `<div class="report-summary-item"><span>${safeText(office)}</span><strong>${count}</strong></div>`).join("") : `<div class="empty-state compact"><p>No office data yet.</p></div>`;
    }

    if(!list.length){
        tbody.innerHTML = emptyRow(7, "fa fa-chart-column", "No report data found", "Try changing the report filters.");
        return;
    }

    tbody.innerHTML = list.map(s => {
        const required = Number(s.required || 0);
        const completedHours = Number(s.completed || 0);
        const pct = required > 0 ? Math.min(100, Math.round((completedHours / required) * 100)) : 0;
        return `<tr>
            <td><strong>${safeText(s.name)}</strong><br><small>${safeText(s.id)} · ${safeText(s.email)}</small></td>
            <td>${safeText(s.school || "Not set")}</td>
            <td>${safeText(s.course)}</td>
            <td>${safeText(s.office)}</td>
            <td>${badge(s.status)}</td>
            <td>${completedHours} / ${required || "Not set"}</td>
            <td><div class="progress mini"><div class="progress-bar" style="width:${pct}%"></div></div><small>${pct}%</small></td>
        </tr>`;
    }).join("");
}

function csvCell(value){
    const text = String(value ?? "").replace(/\r?\n/g, " ");
    return `"${text.replace(/"/g, '""')}"`;
}

function generateReport(){
    const list = getFilteredReportStudents();
    if(!list.length){ alert("No report data to export."); return; }

    const generatedAt = new Date().toLocaleString();
    const statusFilter = document.getElementById("reportStatusFilter")?.value || "All";
    const officeFilter = document.getElementById("reportOfficeFilter")?.value || "All";
    const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);
    const completedCount = list.filter(s => s.status === "Completed" || (Number(s.required) > 0 && Number(s.completed) >= Number(s.required))).length;

    const rows = [];
    rows.push(["INTERNTRACK OJT MONITORING REPORT"]);
    rows.push(["Generated At", generatedAt]);
    rows.push(["Status Filter", statusFilter]);
    rows.push(["Office Filter", officeFilter]);
    rows.push([]);
    rows.push(["SUMMARY"]);
    rows.push(["Total Students", list.length]);
    rows.push(["Completed Students", completedCount]);
    rows.push(["Total Completed Hours", Number(totalHours.toFixed(2))]);
    rows.push([]);
    rows.push(["STUDENT DETAILS"]);
    rows.push(["Student ID", "Full Name", "School", "Course", "Office Assigned", "Status", "Completed Hours", "Required Hours", "Progress %", "Email", "Contact Number"]);

    list.forEach(s => {
        const required = Number(s.required || 0);
        const completed = Number(s.completed || 0);
        const pct = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
        rows.push([s.id, s.name, s.school || "Not set", s.course, s.office, s.status, completed, required || "Not set", pct, s.email, s.phone]);
    });

    const csv = rows.map(row => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `InternTrack_OJT_Report_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getCertificateTemplateUrl(){
    return new URL("assets/img/certificate-template.png", window.location.href).href;
}

function loadImageAsDataUrl(src){
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function(){
            try{
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            }catch(error){ resolve(null); }
        };
        img.onerror = function(){ resolve(null); };
        img.src = src;
    });
}

function mapCertificateStudent(row){
    const completed = Number(row.completed_hours || 0);
    const required = Number(row.required_hours || 0);
    const status = row.ojt_status || row.status || (required > 0 && completed >= required ? "Completed" : "Pending");
    return {
        uuid: row.id || "",
        studentId: row.student_id || "",
        name: row.full_name || "Unnamed Student",
        school: getStudentSchool(row) || "School not set",
        course: row.course || "-",
        office: row.office_assigned || "Not assigned",
        completed, required,
        supervisor: row.supervisor || "OJT Coordinator",
        status,
        email: row.email || "",
        certificateReady: row.certificate_ready === true,
        certificateReadyAt: row.certificate_ready_at || null
    };
}

async function renderCertificates(){
    const tbody = document.getElementById("certificatesTableBody");
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading certificates...</h5><p>Checking student completion records from Supabase.</p></div></td></tr>`;
    const result = await fetchCertificateStudents();
    if(result.error){ tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${certificateEscape(result.error)}</p></div></td></tr>`; return; }
    certificateStudentsCache = result.students;
    const eligibleCount = certificateStudentsCache.filter(isCertificateEligible).length;
    const completedCount = certificateStudentsCache.filter(student => String(student.status).toLowerCase() === "completed" || isCertificateEligible(student)).length;
    const pendingCount = Math.max(certificateStudentsCache.length - eligibleCount, 0);
    const eligibleEl = document.getElementById("certEligibleCount");
    const completedEl = document.getElementById("certCompletedCount");
    const pendingEl = document.getElementById("certPendingCount");
    if(eligibleEl) eligibleEl.textContent = eligibleCount;
    if(completedEl) completedEl.textContent = completedCount;
    if(pendingEl) pendingEl.textContent = pendingCount;
    const search = (document.getElementById("certificateSearch")?.value || "").toLowerCase();
    const filter = document.getElementById("certificateEligibility")?.value || "All";
    const list = certificateStudentsCache.filter(student => {
        const eligible = isCertificateEligible(student);
        const matchesSearch = JSON.stringify(student).toLowerCase().includes(search);
        const matchesFilter = filter === "All" || (filter === "Eligible" && eligible) || (filter === "Not Eligible" && !eligible);
        return matchesSearch && matchesFilter;
    });
    if(!list.length){ tbody.innerHTML = emptyRow(7, "fa fa-award", "No certificate records found", "Completed students will appear here once their required OJT hours are reached."); return; }
    tbody.innerHTML = list.map(student => {
        const eligible = isCertificateEligible(student);
        const requiredLabel = student.required > 0 ? student.required : "Not set";
        const readyLabel = student.certificateReady ? `<span class="badge-soft badge-approved">Ready</span>` : (eligible ? `<span class="badge-soft badge-eligible">Eligible</span>` : `<span class="badge-soft badge-pending">Locked</span>`);
        const action = eligible ? `<div class="action-group"><button class="btn btn-sm btn-outline-success" onclick="certifyStudentReady('${student.uuid}')" ${student.certificateReady ? "disabled" : ""}>${student.certificateReady ? "Ready Sent" : "Certify Ready"}</button><button class="btn btn-sm btn-outline-primary" onclick="openCertificatePreview('${student.uuid}')">Generate</button></div>` : `<button class="btn btn-sm btn-outline-secondary" disabled>Locked</button>`;
        return `<tr>
            <td><strong>${certificateEscape(student.name)}</strong><br><small class="text-secondary">${certificateEscape(student.studentId)} · ${certificateEscape(student.email)}</small></td>
            <td>${certificateEscape(student.school)}</td>
            <td>${certificateEscape(student.course)}</td>
            <td>${certificateEscape(student.office)}</td>
            <td>${student.completed} / ${requiredLabel}</td>
            <td>${readyLabel}</td>
            <td>${action}</td>
        </tr>`;
    }).join("");
}

function getCertificateTextSize(value, baseSize, minSize, limit){
    const text = String(value || "");
    if(text.length <= limit) return baseSize;
    const reduced = baseSize - ((text.length - limit) * 0.45);
    return Math.max(minSize, Math.round(reduced));
}

function certificateHtml(student, options = {}){
    const issueDate = options.issueDate || getCertificateToday();
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const school = student.school || "";
    const startDate = options.trainingStart ? formatCertificateDate(options.trainingStart) : "";
    const endDate = options.trainingEnd ? formatCertificateDate(options.trainingEnd) : "";
    const office = student.office || "";

    return `
        <div class="certificate-template-preview liceo-cert-template" id="certificatePrintable">
            <img src="${getCertificateTemplateUrl()}" alt="Certificate Template">
            <div class="cert-overlay cert-student-name" style="font-size:${getCertificateTextSize(student.name, 30, 18, 26)}px">${certificateEscape(student.name)}</div>
            <div class="cert-overlay cert-course-line" style="font-size:${getCertificateTextSize(student.course, 24, 15, 32)}px">${certificateEscape(student.course || "")}</div>
            <div class="cert-overlay cert-school-line" style="font-size:${getCertificateTextSize(school, 22, 14, 52)}px">${certificateEscape(school)}</div>
            <div class="cert-overlay cert-hours-line">${certificateEscape(hours ? String(hours) + " hours" : "")}</div>
            <div class="cert-overlay cert-start-line" style="font-size:${getCertificateTextSize(startDate, 19, 12, 18)}px">${certificateEscape(startDate)}</div>
            <div class="cert-overlay cert-end-line" style="font-size:${getCertificateTextSize(endDate, 19, 12, 18)}px">${certificateEscape(endDate)}</div>
            <div class="cert-overlay cert-office-line" style="font-size:${getCertificateTextSize(office, 22, 14, 42)}px">${certificateEscape(office)}</div>
            <div class="cert-overlay cert-given-date" style="font-size:${getCertificateTextSize(formatCertificateDate(issueDate), 22, 14, 24)}px">${certificateEscape(formatCertificateDate(issueDate))}</div>
        </div>
    `;
}

async function downloadCertificatePdf(){
    if(!selectedCertificateStudent){ alert("Please select a completed student first."); return; }
    const options = getCertificateFormValues();
    const student = selectedCertificateStudent;
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const fileName = `${student.name.replace(/[^a-z0-9]+/gi, "_")}_Certificate.pdf`;
    if(!window.jspdf || !window.jspdf.jsPDF){ printCertificate(); return; }

    const { jsPDF } = window.jspdf;
    const pageW = 1414;
    const pageH = 2000;
    const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[pageW, pageH] });
    const templateData = await loadImageAsDataUrl(getCertificateTemplateUrl());
    if(templateData){ pdf.addImage(templateData, "PNG", 0, 0, pageW, pageH); }

    function fitText(text, x, y, maxWidth, baseSize, minSize, weight = "normal"){
        text = String(text || "");
        if(!text.trim()) return;
        pdf.setFont("times", weight);
        let size = baseSize;
        pdf.setFontSize(size);
        while(size > minSize && pdf.getTextWidth(text) > maxWidth){
            size -= 1;
            pdf.setFontSize(size);
        }
        pdf.text(text, x, y, { align:"center" });
    }

    pdf.setTextColor(0, 0, 0);
    fitText(student.name, 707, 1050, 1020, 34, 20, "bold");
    fitText(student.course || "", 707, 1123, 650, 28, 16, "normal");
    fitText(student.school || "", 710, 1220, 850, 26, 15, "normal");
    fitText(hours ? String(hours) + " hours" : "", 734, 1270, 210, 25, 15, "normal");

    if(options.trainingStart){ fitText(formatCertificateDate(options.trainingStart), 775, 1326, 260, 22, 12, "normal"); }
    if(options.trainingEnd){ fitText(formatCertificateDate(options.trainingEnd), 1015, 1326, 220, 22, 12, "normal"); }

    fitText(student.office || "", 795, 1378, 620, 25, 14, "normal");
    fitText(formatCertificateDate(options.issueDate), 560, 1505, 330, 25, 14, "normal");

    pdf.save(fileName);
}

window.renderStudents = renderStudents;
window.editStudent = editStudent;
window.viewStudent = viewStudent;
window.saveStudent = saveStudent;
window.renderReports = renderReports;
window.generateReport = generateReport;
window.renderCertificates = renderCertificates;
window.downloadCertificatePdf = downloadCertificatePdf;
window.downloadCertificate = downloadCertificate;


/* FINAL CERTIFICATE TEMPLATE FIX - uses certificate-template.png and offline-safe data URL */
function getCertificateTemplateUrl(){
    return window.CERTIFICATE_TEMPLATE_DATA_URL || new URL("assets/img/certificate-template.png", window.location.href).href;
}

function loadImageAsDataUrl(src){
    if(String(src || "").startsWith("data:image")){
        return Promise.resolve(src);
    }
    return new Promise(resolve => {
        const img = new Image();
        img.onload = function(){
            try{
                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            }catch(error){
                resolve(window.CERTIFICATE_TEMPLATE_DATA_URL || null);
            }
        };
        img.onerror = function(){ resolve(window.CERTIFICATE_TEMPLATE_DATA_URL || null); };
        img.src = src;
    });
}

function formatCertificateGivenDate(value){
    if(!value) return "__________";
    const date = new Date(value + "T00:00:00");
    if(Number.isNaN(date.getTime())) return "__________";
    const day = date.getDate();
    const suffix = (day % 10 === 1 && day !== 11) ? "st" : (day % 10 === 2 && day !== 12) ? "nd" : (day % 10 === 3 && day !== 13) ? "rd" : "th";
    const monthYear = date.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    return `${day}${suffix} day of ${monthYear}`;
}

function certificateValueOrBlank(value, fallback = "__________"){
    const text = String(value || "").trim();
    return text || fallback;
}

function certificateHtml(student, options = {}){
    const issueDate = options.issueDate || getCertificateToday();
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const course = certificateValueOrBlank(student.course);
    const school = certificateValueOrBlank(student.school || "School not set");
    const startDate = options.trainingStart ? formatCertificateDate(options.trainingStart) : "__________";
    const endDate = options.trainingEnd ? formatCertificateDate(options.trainingEnd) : "__________";
    const office = certificateValueOrBlank(student.office);
    const hoursText = hours ? `${hours} hours` : "__________ hours";
    const givenText = formatCertificateGivenDate(issueDate);

    return `
        <div class="certificate-template-preview liceo-cert-template" id="certificatePrintable">
            <img src="${getCertificateTemplateUrl()}" alt="Certificate Template">
            <div class="cert-overlay cert-student-name" style="font-size:${getCertificateTextSize(student.name, 34, 20, 28)}px">${certificateEscape(student.name)}</div>
            <div class="cert-overlay cert-course-line" style="font-size:${getCertificateTextSize(course, 26, 15, 38)}px">${certificateEscape(course)}</div>
            <div class="cert-overlay cert-student-label" style="font-size:24px">Student</div>
            <div class="cert-overlay cert-school-line" style="font-size:${getCertificateTextSize(school, 25, 14, 62)}px">of ${certificateEscape(school)}, for</div>
            <div class="cert-overlay cert-training-line" style="font-size:${getCertificateTextSize(hoursText, 25, 15, 24)}px">having completed his/her ${certificateEscape(hoursText)} On-the-Job Training</div>
            <div class="cert-overlay cert-dates-line" style="font-size:${getCertificateTextSize(startDate + endDate, 24, 13, 44)}px">course requirement from ${certificateEscape(startDate)} to ${certificateEscape(endDate)} in</div>
            <div class="cert-overlay cert-office-line" style="font-size:${getCertificateTextSize(office, 25, 14, 48)}px">the ${certificateEscape(office)}.</div>
            <div class="cert-overlay cert-given-line" style="font-size:${getCertificateTextSize(givenText, 25, 14, 36)}px">Given this ${certificateEscape(givenText)} at the Provincial Capitol</div>
            <div class="cert-overlay cert-location-line" style="font-size:25px">Compound, Cagayan de Oro City, Misamis Oriental,</div>
            <div class="cert-overlay cert-country-line" style="font-size:25px">Philippines.</div>
        </div>
    `;
}

async function downloadCertificatePdf(){
    if(!selectedCertificateStudent){ alert("Please select a completed student first."); return; }
    const options = getCertificateFormValues();
    const student = selectedCertificateStudent;
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const fileName = `${student.name.replace(/[^a-z0-9]+/gi, "_")}_Certificate.pdf`;
    if(!window.jspdf || !window.jspdf.jsPDF){ printCertificate(); return; }

    const { jsPDF } = window.jspdf;
    const pageW = 1414;
    const pageH = 2000;
    const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[pageW, pageH] });
    const templateData = await loadImageAsDataUrl(getCertificateTemplateUrl());
    if(!templateData){ alert("Certificate template could not be loaded."); return; }
    pdf.addImage(templateData, "PNG", 0, 0, pageW, pageH);

    function fitText(text, x, y, maxWidth, baseSize, minSize, weight = "normal"){
        text = String(text || "").trim();
        if(!text) return;
        pdf.setFont("times", weight);
        let size = baseSize;
        pdf.setFontSize(size);
        while(size > minSize && pdf.getTextWidth(text) > maxWidth){
            size -= 1;
            pdf.setFontSize(size);
        }
        pdf.text(text, x, y, { align:"center" });
    }

    const course = certificateValueOrBlank(student.course);
    const school = certificateValueOrBlank(student.school || "School not set");
    const startDate = options.trainingStart ? formatCertificateDate(options.trainingStart) : "__________";
    const endDate = options.trainingEnd ? formatCertificateDate(options.trainingEnd) : "__________";
    const office = certificateValueOrBlank(student.office);
    const hoursText = hours ? `${hours} hours` : "__________ hours";
    const givenText = formatCertificateGivenDate(options.issueDate || getCertificateToday());

    pdf.setTextColor(0, 0, 0);
    fitText(student.name, 707, 960, 1080, 48, 26, "bold");
    fitText(course, 707, 1044, 800, 36, 20, "normal");
    fitText("Student", 707, 1085, 260, 34, 22, "normal");
    fitText(`of ${school}, for`, 707, 1160, 1100, 34, 18, "normal");
    fitText(`having completed his/her ${hoursText} On-the-Job Training`, 707, 1216, 1100, 34, 18, "normal");
    fitText(`course requirement from ${startDate} to ${endDate} in`, 707, 1272, 1160, 32, 17, "normal");
    fitText(`the ${office}.`, 707, 1328, 900, 34, 18, "normal");
    fitText(`Given this ${givenText} at the Provincial Capitol`, 707, 1444, 1100, 34, 18, "normal");
    fitText("Compound, Cagayan de Oro City, Misamis Oriental,", 707, 1496, 1000, 34, 18, "normal");
    fitText("Philippines.", 707, 1548, 500, 34, 20, "normal");

    pdf.save(fileName);
}

window.downloadCertificatePdf = downloadCertificatePdf;
window.downloadCertificate = downloadCertificate;
window.refreshCertificatePreview = refreshCertificatePreview;
window.printCertificate = printCertificate;


/* PGMO FINAL PATCH 2026-06-25: centered certificate + admin baseline hours with approved DTR total */

function getAdminManualHoursValue(row){
    return Number(row?.manual_completed_hours ?? row?.admin_added_hours ?? row?.baseline_hours ?? 0) || 0;
}

async function getApprovedDtrHoursForStudent(client, studentId){
    if(!client || !studentId) return 0;
    const { data, error } = await client
        .from(getAdminDtrFormsTable())
        .select("total_hours")
        .eq("student_id", studentId)
        .eq("status", "Approved");
    if(error){
        throw new Error("Could not get approved DTR hours: " + error.message);
    }
    return Number((data || []).reduce((sum, item) => sum + Number(item.total_hours || 0), 0).toFixed(2));
}

async function recalculateStudentHoursFromApprovedDtr(client, studentId){
    if(!client || !studentId) return;

    const approvedDtrHours = await getApprovedDtrHoursForStudent(client, studentId);

    const { data: students, error: studentError } = await client
        .from(getAdminStudentAccountsTable())
        .select("*")
        .eq("student_id", studentId)
        .limit(1);

    if(studentError || !students || !students.length){
        throw new Error(studentError?.message || "Student account not found while recalculating hours.");
    }

    const student = students[0];
    const manualHours = 0;
    const totalCompletedHours = Number(approvedDtrHours.toFixed(2));
    const requiredHours = Number(student.required_hours || 0);

    let newStatus = student.ojt_status || "Pending";
    if(requiredHours > 0 && totalCompletedHours >= requiredHours){
        newStatus = "Completed";
    }else if(totalCompletedHours > 0){
        newStatus = "Ongoing";
    }else{
        newStatus = "Pending";
    }

    const payload = {
        completed_hours: totalCompletedHours,
        ojt_status: newStatus,
        updated_at: new Date().toISOString()
    };

    /* This column is added by the included SQL patch. If it is not present yet, this update will fail and remind the admin to run the SQL. */
    payload.manual_completed_hours = manualHours;

    const { error: updateError } = await client
        .from(getAdminStudentAccountsTable())
        .update(payload)
        .eq("id", student.id);

    if(updateError){
        throw new Error("Could not update student completed hours. Run admin-integration/database/supabase_admin_manual_hours_patch.sql first. " + updateError.message);
    }

    return {
        completed_hours: totalCompletedHours,
        manual_completed_hours: manualHours,
        approved_dtr_hours: approvedDtrHours,
        ojt_status: newStatus
    };
}

async function saveStudent(){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    const studentId = (document.querySelector("#studentIdInput")?.value || "").trim().toUpperCase();
    const lastName = (document.querySelector("#studentLastName")?.value || "").trim().toUpperCase();
    const firstName = (document.querySelector("#studentFirstName")?.value || "").trim();
    const middleInitial = (document.querySelector("#studentMiddleInitial")?.value || "").trim().toUpperCase().charAt(0);
    const school = (document.querySelector("#studentSchoolInput")?.value || "").trim();
    const gender = (document.querySelector("#studentGenderInput")?.value || "").trim();
    const course = (document.querySelector("#studentCourseInput")?.value || "").trim();
    const office = (document.querySelector("#studentOffice")?.value || "").trim() || "Not assigned";
    const status = document.querySelector("#studentStatusInput")?.value || "Pending";
    const completed = Number(document.querySelector("#studentCompleted")?.value || 0);
    const required = Number(document.querySelector("#studentRequired")?.value || 0);
    const email = (document.querySelector("#studentEmail")?.value || "").trim().toLowerCase();
    const phone = (document.querySelector("#studentPhone")?.value || "").trim();
    const tempPassword = (document.querySelector("#studentPassword")?.value || "").trim();

    if(!studentId){ alert("Student ID is required."); return; }
    if(!lastName || !firstName){ alert("Last name and first name are required."); return; }
    if(!course){ alert("Course is required."); return; }
    if(!email){ alert("Email is required."); return; }
    if(completed < 0){ alert("Completed hours cannot be negative."); return; }
    if(required <= 0){ alert("Required hours must be set by the admin."); return; }

    let approvedDtrHours = 0;
    try{
        approvedDtrHours = await getApprovedDtrHoursForStudent(client, studentId);
    }catch(error){
        alert(error.message);
        return;
    }

    /* The Completed Hours field is the student's current total. We store the admin-entered/base hours separately so future approved DTR hours are added instead of replacing it. */
    const manualHours = Math.max(0, Number((completed - approvedDtrHours).toFixed(2)));
    const totalCompletedHours = Number((manualHours + approvedDtrHours).toFixed(2));
    const finalStatus = required > 0 && totalCompletedHours >= required ? "Completed" : (totalCompletedHours > 0 ? "Ongoing" : status);

    const passwordHash = tempPassword ? await adminHashPassword(tempPassword) : (editingStudentUuid ? null : await adminHashPassword("student123"));

    const { data, error } = await client.rpc("admin_save_student_account", {
        p_existing_id: editingStudentUuid || null,
        p_student_id: studentId,
        p_last_name: lastName,
        p_first_name: firstName,
        p_middle_initial: middleInitial,
        p_school: school,
        p_course: course,
        p_office_assigned: office,
        p_email: email,
        p_phone: phone,
        p_ojt_status: finalStatus,
        p_completed_hours: totalCompletedHours,
        p_required_hours: required,
        p_password_hash: passwordHash
    });

    const result = Array.isArray(data) ? data[0] : data;
    if(error || !result || result.ok !== true){
        alert(error ? error.message : (result?.message || "Could not save student. Run the updated SQL patch first."));
        return;
    }

    /* Update manual/baseline hours after the RPC save. */
    const accountId = result.student_account_id || editingStudentUuid;
    if(accountId){
        const { error: manualError } = await client
            .from(getAdminStudentAccountsTable())
            .update({
                manual_completed_hours: manualHours,
                completed_hours: totalCompletedHours,
                updated_at: new Date().toISOString()
            })
            .eq("id", accountId);
        if(manualError){
            alert("Student was saved, but manual hour tracking needs the SQL patch. Run admin-integration/database/supabase_admin_manual_hours_patch.sql. " + manualError.message);
            return;
        }
    }

    if(accountId){
        const { error: genderError } = await client
            .from(getAdminStudentAccountsTable())
            .update({
                gender: gender || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", accountId);

        if(genderError){
            alert("Student was saved, but gender was not updated. Run database/supabase_gender_certificate_patch.sql in Supabase. " + genderError.message);
            return;
        }
    }

    bootstrap.Modal.getInstance(document.querySelector("#studentModal"))?.hide();
    await renderStudents();
}

function certificateCenteredHtmlLine(className, text, fontSize){
    return `<div class="cert-overlay ${className}" style="font-size:${fontSize}px">${certificateEscape(text)}</div>`;
}

function certificateHtml(student, options = {}){
    const issueDate = options.issueDate || getCertificateToday();
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const course = certificateValueOrBlank(student.course);
    const school = certificateValueOrBlank(student.school || "School not set");
    const startDate = options.trainingStart ? formatCertificateDate(options.trainingStart) : "__________";
    const endDate = options.trainingEnd ? formatCertificateDate(options.trainingEnd) : "__________";
    const office = certificateValueOrBlank(student.office);
    const hoursText = hours ? `${hours} hours` : "__________ hours";
    const givenText = formatCertificateGivenDate(issueDate);

    return `
        <div class="certificate-template-preview liceo-cert-template" id="certificatePrintable">
            <img src="${getCertificateTemplateUrl()}" alt="Certificate Template">
            <div class="cert-overlay cert-student-name" style="font-size:${getCertificateTextSize(student.name, 34, 20, 28)}px">${certificateEscape(student.name)}</div>
            <div class="cert-overlay cert-course-line" style="font-size:${getCertificateTextSize(course, 26, 15, 38)}px">${certificateEscape(course)}</div>
            <div class="cert-overlay cert-student-label">Student</div>
            <div class="cert-overlay cert-school-line" style="font-size:${getCertificateTextSize(school, 25, 14, 62)}px">of ${certificateEscape(school)}, for</div>
            <div class="cert-overlay cert-training-line" style="font-size:${getCertificateTextSize(hoursText, 25, 15, 24)}px">having completed his/her ${certificateEscape(hoursText)} On-the-Job Training</div>
            <div class="cert-overlay cert-dates-line" style="font-size:${getCertificateTextSize(startDate + endDate, 24, 13, 44)}px">course requirement from ${certificateEscape(startDate)} to ${certificateEscape(endDate)} in</div>
            <div class="cert-overlay cert-office-line" style="font-size:${getCertificateTextSize(office, 25, 14, 48)}px">the ${certificateEscape(office)}.</div>
            <div class="cert-overlay cert-given-line" style="font-size:${getCertificateTextSize(givenText, 25, 14, 36)}px">Given this ${certificateEscape(givenText)} at the Provincial Capitol</div>
            <div class="cert-overlay cert-location-line">Compound, Cagayan de Oro City, Misamis Oriental,</div>
            <div class="cert-overlay cert-country-line">Philippines.</div>
        </div>
    `;
}

async function downloadCertificatePdf(){
    if(!selectedCertificateStudent){ alert("Please select a completed student first."); return; }
    const options = getCertificateFormValues();
    const student = selectedCertificateStudent;
    const requiredHours = Number(student.required || 0);
    const completedHours = Number(student.completed || 0);
    const hours = requiredHours > 0 ? requiredHours : completedHours;
    const fileName = `${student.name.replace(/[^a-z0-9]+/gi, "_")}_Certificate.pdf`;
    if(!window.jspdf || !window.jspdf.jsPDF){ printCertificate(); return; }

    const { jsPDF } = window.jspdf;
    const pageW = 1414;
    const pageH = 2000;
    const centerX = pageW / 2;
    const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[pageW, pageH] });
    const templateData = await loadImageAsDataUrl(getCertificateTemplateUrl());
    if(!templateData){ alert("Certificate template could not be loaded."); return; }
    pdf.addImage(templateData, "PNG", 0, 0, pageW, pageH);

    function fitText(text, y, maxWidth, baseSize, minSize, weight = "normal"){
        text = String(text || "").trim();
        if(!text) return;
        pdf.setFont("times", weight);
        let size = baseSize;
        pdf.setFontSize(size);
        while(size > minSize && pdf.getTextWidth(text) > maxWidth){
            size -= 1;
            pdf.setFontSize(size);
        }
        pdf.text(text, centerX, y, { align:"center" });
    }

    const course = certificateValueOrBlank(student.course);
    const school = certificateValueOrBlank(student.school || "School not set");
    const startDate = options.trainingStart ? formatCertificateDate(options.trainingStart) : "__________";
    const endDate = options.trainingEnd ? formatCertificateDate(options.trainingEnd) : "__________";
    const office = certificateValueOrBlank(student.office);
    const hoursText = hours ? `${hours} hours` : "__________ hours";
    const givenText = formatCertificateGivenDate(options.issueDate || getCertificateToday());

    pdf.setTextColor(0, 0, 0);
    fitText(student.name, 955, 1080, 48, 26, "bold");
    fitText(course, 1038, 800, 35, 20, "normal");
    fitText("Student", 1078, 260, 32, 22, "normal");
    fitText(`of ${school}, for`, 1152, 1100, 32, 18, "normal");
    fitText(`having completed his/her ${hoursText} On-the-Job Training`, 1206, 1120, 32, 18, "normal");
    fitText(`course requirement from ${startDate} to ${endDate} in`, 1260, 1160, 31, 17, "normal");
    fitText(`the ${office}.`, 1315, 900, 32, 18, "normal");
    fitText(`Given this ${givenText} at the Provincial Capitol`, 1438, 1100, 32, 18, "normal");
    fitText("Compound, Cagayan de Oro City, Misamis Oriental,", 1490, 1000, 32, 18, "normal");
    fitText("Philippines.", 1542, 500, 32, 20, "normal");

    pdf.save(fileName);
}

window.saveStudent = saveStudent;
window.recalculateStudentHoursFromApprovedDtr = recalculateStudentHoursFromApprovedDtr;
window.downloadCertificatePdf = downloadCertificatePdf;
window.downloadCertificate = downloadCertificate;
window.refreshCertificatePreview = refreshCertificatePreview;
window.printCertificate = printCertificate;


/* PGMO PATCH 2026-06-26: admin school filter, full recent names, neat CSV, and ID approval dates */
(function(){
    function pgmoSafe(value){
        if(typeof safeText === "function") return safeText(value);
        return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    }

    function pgmoStatusBadge(status){
        if(typeof badge === "function") return badge(status);
        return `<span class="badge-soft">${pgmoSafe(status || "Pending")}</span>`;
    }

    function pgmoProgress(completed, required){
        if(typeof progressBar === "function") return progressBar(completed, required);
        const done = Number(completed || 0);
        const need = Number(required || 0);
        const pct = need > 0 ? Math.min(100, Math.round((done / need) * 100)) : 0;
        return `<div class="progress mini"><div class="progress-bar" style="width:${pct}%"></div></div><small>${done} / ${need || "Not set"} hrs</small>`;
    }

    function pgmoFullNameFromRow(row){
        const lastName = row.last_name || "";
        const firstName = row.first_name || "";
        const middleInitial = row.middle_initial || "";
        if(typeof formatAdminStudentFullName === "function"){
            const formatted = formatAdminStudentFullName(lastName, firstName, middleInitial);
            if(formatted && formatted.includes(",")) return formatted;
        }
        const full = String(row.full_name || "").trim();
        return full || "Unnamed Student";
    }

    window.accountToAdminStudent = function(row){
        const split = typeof splitAdminStudentFullName === "function" ? splitAdminStudentFullName(row.full_name) : {lastName:"", firstName:"", middleInitial:""};
        const lastName = row.last_name || split.lastName || "";
        const firstName = row.first_name || split.firstName || "";
        const middleInitial = row.middle_initial || split.middleInitial || "";
        const formattedName = typeof formatAdminStudentFullName === "function" ? formatAdminStudentFullName(lastName, firstName, middleInitial) : pgmoFullNameFromRow(row);

        return {
            uuid: row.id || "",
            id: row.student_id || "",
            name: formattedName && formattedName.includes(",") ? formattedName : (row.full_name || "Unnamed Student"),
            lastName,
            firstName,
            middleInitial,
            school: (typeof getStudentSchool === "function" ? getStudentSchool(row) : (row.school || row.school_name || "")) || "",
            course: row.course || "-",
            office: row.office_assigned || "Not assigned",
            status: row.ojt_status || "Pending",
            accountStatus: row.status || "Active",
            completed: Number(row.completed_hours ?? 0),
            required: Number(row.required_hours ?? 0),
            email: row.email || "",
            phone: row.phone || row.contact_number || "No phone",
            supervisor: row.supervisor || "",
            idRequestAllowed: row.ojt_id_request_allowed === true,
            idRequestAllowedAt: row.ojt_id_request_allowed_at || null,
            idRequestAllowedBy: row.ojt_id_request_allowed_by || ""
        };
    };

    window.populateStudentSchoolFilter = function(students){
        const select = document.getElementById("studentSchoolFilter");
        if(!select) return;
        const current = select.value || "All";
        const schools = [...new Set((students || []).map(s => (s.school || "Not set").trim() || "Not set"))].sort((a,b) => a.localeCompare(b));
        select.innerHTML = `<option value="All">All Schools</option>` + schools.map(school => `<option value="${pgmoSafe(school)}">${pgmoSafe(school)}</option>`).join("");
        if([...select.options].some(option => option.value === current)) select.value = current;
    };

    window.renderStudents = async function(){
        const tbody = document.querySelector("#studentsTableBody");
        if(!tbody) return;

        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading students...</h5><p>Fetching registered students from Supabase.</p></div></td></tr>`;

        const result = await fetchAdminStudents();
        if(result.error){
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${pgmoSafe(result.error)}</p></div></td></tr>`;
            return;
        }

        populateStudentSchoolFilter(result.students);

        const search = (document.querySelector("#studentSearch")?.value || "").toLowerCase();
        const status = document.querySelector("#studentStatus")?.value || "All";
        const school = document.querySelector("#studentSchoolFilter")?.value || "All";
        const office = (document.querySelector("#studentOfficeFilter")?.value || "").toLowerCase();

        const list = result.students.filter(s => JSON.stringify(s).toLowerCase().includes(search)
            && (status === "All" || s.status === status)
            && (school === "All" || (s.school || "Not set") === school)
            && (!office || String(s.office || "").toLowerCase().includes(office))
        );

        tbody.innerHTML = list.length ? list.map(s => `
            <tr>
                <td><strong>${pgmoSafe(s.id)}</strong></td>
                <td>${pgmoSafe(s.name)}<br><small class="text-secondary">${pgmoSafe(s.email)}</small><br><small class="text-secondary">${pgmoSafe(s.phone)}</small></td>
                <td>${pgmoSafe(s.school || "Not set")}</td>
                <td>${pgmoSafe(s.course)}</td>
                <td>${pgmoSafe(s.office)}</td>
                <td>${pgmoProgress(s.completed,s.required)}</td>
                <td>${pgmoStatusBadge(s.status)}</td>
                <td><div class="action-group"><button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${s.uuid}')">View</button><button class="btn btn-sm btn-outline-warning" onclick="editStudent('${s.uuid}')">Edit</button><button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.uuid}')">Delete</button></div></td>
            </tr>
        `).join("") : emptyRow(8,"fa fa-user-graduate","No students found","Try changing the school, office, status, or search filter.");
    };

    async function renderDashboardRecentFullNames(){
        const recentStudents = document.getElementById("recentStudents");
        if(!recentStudents || typeof initSupabaseAdmin !== "function") return;
        const client = initSupabaseAdmin();
        if(!client) return;
        const { data, error } = await client.from(getAdminStudentAccountsTable()).select("*").order("created_at", { ascending:false }).limit(5);
        if(error || !data) return;
        const students = data.map(window.accountToAdminStudent);
        if(!students.length) return;
        recentStudents.innerHTML = students.map(student => {
            const required = Number(student.required || 0);
            const completed = Number(student.completed || 0);
            const isCompleted = String(student.status || "").toLowerCase() === "completed" || (required > 0 && completed >= required);
            const requiredLabel = required > 0 ? required : "Not set";
            return `
                <tr class="${isCompleted ? 'pgmo-completed-student-row' : ''}">
                    <td><strong>${pgmoSafe(student.name)}</strong><br><small class="text-secondary">${pgmoSafe(student.id || "-")}</small></td>
                    <td>${pgmoSafe(student.office || "Not assigned")}</td>
                    <td>${Number(student.completed || 0)} / ${requiredLabel}</td>
                    <td>${typeof dashboardBadge === "function" ? dashboardBadge(student.status) : pgmoStatusBadge(student.status)}</td>
                    <td><a class="btn btn-sm btn-outline-primary" href="students.html">Open</a></td>
                </tr>`;
        }).join("");
    }

    const originalGetFilteredReportStudents = window.getFilteredReportStudents || getFilteredReportStudents;
    window.getFilteredReportStudents = function(){
        return originalGetFilteredReportStudents();
    };

    window.generateReport = function(){
        const list = typeof getFilteredReportStudents === "function" ? getFilteredReportStudents() : [];
        if(!list.length){ alert("No report data to export."); return; }

        const generatedAt = new Date().toLocaleString();
        const generatedDate = new Date().toISOString().slice(0,10);
        const statusFilter = document.getElementById("reportStatusFilter")?.value || "All";
        const officeFilter = document.getElementById("reportOfficeFilter")?.value || "All";
        const searchText = document.getElementById("reportSearch")?.value || "";
        const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);
        const completedCount = list.filter(s => s.status === "Completed" || (Number(s.required) > 0 && Number(s.completed) >= Number(s.required))).length;
        const ongoingCount = list.filter(s => s.status === "Ongoing").length;
        const pendingCount = list.filter(s => s.status === "Pending").length;

        const officeCounts = {};
        list.forEach(s => { officeCounts[s.office || "Not assigned"] = (officeCounts[s.office || "Not assigned"] || 0) + 1; });

        const rows = [];
        rows.push(["PROVINCE OF MISAMIS ORIENTAL"]);
        rows.push(["PGMO OJT MONITORING REPORT"]);
        rows.push(["Theme", "Dark Green #043915", "Primary Green #166534", "Accent Green #22C55E"]);
        rows.push(["Generated At", generatedAt]);
        rows.push(["Status Filter", statusFilter, "Office Filter", officeFilter, "Search", searchText || "None"]);
        rows.push([]);
        rows.push(["SUMMARY"]);
        rows.push(["Total Students", list.length]);
        rows.push(["Ongoing Students", ongoingCount]);
        rows.push(["Pending Students", pendingCount]);
        rows.push(["Completed Students", completedCount]);
        rows.push(["Total Completed Hours", Number(totalHours.toFixed(2))]);
        rows.push([]);
        rows.push(["OFFICE BREAKDOWN"]);
        rows.push(["Office Assigned", "Student Count"]);
        Object.entries(officeCounts).sort((a,b) => b[1] - a[1]).forEach(([office,count]) => rows.push([office, count]));
        rows.push([]);
        rows.push(["STUDENT DETAILS"]);
        rows.push(["No.", "Student ID", "Full Name", "School", "Course", "Office Assigned", "Status", "Completed Hours", "Required Hours", "Remaining Hours", "Progress %", "Email", "Contact Number"]);

        list.forEach((s, index) => {
            const required = Number(s.required || 0);
            const completed = Number(s.completed || 0);
            const remaining = required > 0 ? Math.max(required - completed, 0) : "Not set";
            const pct = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
            rows.push([index + 1, s.id, s.name, s.school || "Not set", s.course, s.office, s.status, completed, required || "Not set", remaining, pct + "%", s.email, s.phone]);
        });
        rows.push([]);
        rows.push(["Prepared By", typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "Admin"]);
        rows.push(["Note", "Open this CSV in Excel or Google Sheets. Use the included PGMO green theme values for formatting if needed."]);

        const csv = "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\n");
        const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `PGMO_OJT_Report_${generatedDate}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    window.renderOjtIdRequestsAdmin = async function(){
        const tbody = document.getElementById("idRequestsTableBody");
        if(!tbody) return;
        const client = initSupabaseAdmin();
        if(!client){ tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Supabase config missing</h5><p>Open assets/js/config.js first.</p></div></td></tr>`; return; }
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading OJT ID requests...</h5></div></td></tr>`;
        const { data, error } = await client.from(getAdminOjtIdRequestsTable()).select("*").order("created_at", {ascending:false});
        if(error){ tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load ID requests</h5><p>${pgmoSafe(error.message)}</p></div></td></tr>`; return; }
        if(!data || !data.length){ tbody.innerHTML = emptyRow(6,"fa fa-id-card","No OJT ID requests yet","Student ID requests will appear here after access is approved and a request is submitted."); return; }
        tbody.innerHTML = data.map(req => {
            const actions = req.status === "Pending" ? `
                <button class="btn btn-sm btn-success" onclick="setOjtIdRequestStatus('${req.id}','Approved')">Approve</button>
                <button class="btn btn-sm btn-outline-danger" onclick="setOjtIdRequestStatus('${req.id}','Rejected')">Reject</button>` : `<button class="btn btn-sm btn-outline-secondary" disabled>Done</button>`;
            const approvedLine = req.approved_at ? `<br><small class="text-success"><i class="fa fa-check-circle"></i> Approved: ${new Date(req.approved_at).toLocaleString()}</small>` : "";
            const approvedByLine = req.approved_by ? `<br><small class="text-secondary">By: ${pgmoSafe(req.approved_by)}</small>` : "";
            return `<tr>
                <td><strong>${pgmoSafe(req.student_name)}</strong><br><small>${pgmoSafe(req.student_id)} · ${pgmoSafe(req.course)}</small></td>
                <td>${pgmoSafe(req.office_assigned)}</td>
                <td>${pgmoSafe(req.purpose || "-")} ${req.admin_remarks ? `<br><small class="text-danger">Admin: ${pgmoSafe(req.admin_remarks)}</small>` : ""}</td>
                <td>${pgmoStatusBadge(req.status || "Pending")}${approvedByLine}</td>
                <td>${req.created_at ? new Date(req.created_at).toLocaleString() : "-"}${approvedLine}</td>
                <td><div class="action-group">${actions}</div></td>
            </tr>`;
        }).join("");
    };

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body.dataset.page === "dashboard") setTimeout(renderDashboardRecentFullNames, 350);
        if(document.getElementById("studentSchoolFilter")) setTimeout(() => { if(typeof renderStudents === "function") renderStudents(); }, 100);
    });
})();


/* PGMO PATCH: Admin upload document for a specific student */
const ADMIN_DOCUMENT_ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

function adminDocSafeText(value){
    if(typeof safeText === "function") return safeText(value);
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function adminDocBadge(status){
    if(typeof badge === "function") return badge(status);
    return `<span class="badge-soft badge-${String(status || "pending").toLowerCase()}">${adminDocSafeText(status || "Pending")}</span>`;
}

function sanitizeAdminDocumentFileName(name){
    return String(name || "document")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 120) || "document";
}

function sanitizeAdminStorageFolder(value){
    return String(value || "student")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 80) || "student";
}

function getAdminUploadSelectedStudent(){
    const selected = document.getElementById("documentStudentSelect");
    const uuid = selected ? selected.value : "";
    if(!uuid) return null;
    return (adminDocumentStudentOptionCache || adminStudentsCache || []).find(student => student.uuid === uuid) || null;
}

function getAdminDocumentStudentSearchText(student){
    return `${student.name || ""} ${student.id || ""} ${student.school || ""} ${student.course || ""} ${student.office || ""}`.toLowerCase();
}

function getAdminDocumentStudentDisplayLabel(student){
    const office = student.office || "Not assigned";
    return `${student.name || "Unnamed Student"} · ${office}`;
}

function setAdminDocumentStudentComboOpen(isOpen){
    const combo = document.getElementById("documentStudentCombo");
    if(!combo) return;
    combo.classList.toggle("is-open", !!isOpen);
}

function openAdminDocumentStudentCombo(){
    renderAdminDocumentStudentOptions(adminDocumentStudentOptionCache || [], document.getElementById("documentStudentSelect")?.value || "", document.getElementById("documentStudentComboInput")?.value || "");
    setAdminDocumentStudentComboOpen(true);
}

function toggleAdminDocumentStudentCombo(){
    const combo = document.getElementById("documentStudentCombo");
    if(!combo) return;
    if(combo.classList.contains("is-open")){
        setAdminDocumentStudentComboOpen(false);
    }else{
        openAdminDocumentStudentCombo();
    }
}

function selectAdminDocumentStudent(uuid){
    const hidden = document.getElementById("documentStudentSelect");
    const input = document.getElementById("documentStudentComboInput");
    const student = (adminDocumentStudentOptionCache || adminStudentsCache || []).find(item => item.uuid === uuid) || null;

    if(hidden) hidden.value = uuid || "";
    if(input) input.value = student ? getAdminDocumentStudentDisplayLabel(student) : "";

    setAdminDocumentStudentComboOpen(false);
    previewAdminUploadStudent();
}

function renderAdminDocumentStudentOptions(students, selectedUuid, filterText){
    const list = document.getElementById("documentStudentComboList");
    if(!list) return;

    const search = String(filterText || "").trim().toLowerCase();
    const filtered = !search
        ? students
        : (students || []).filter(student => getAdminDocumentStudentSearchText(student).includes(search));

    if(!students || !students.length){
        list.innerHTML = `<div class="admin-student-combo-empty">No registered students found</div>`;
        previewAdminUploadStudent();
        return;
    }

    if(!filtered.length){
        list.innerHTML = `<div class="admin-student-combo-empty">No student matched your search</div>`;
        previewAdminUploadStudent();
        return;
    }

    list.innerHTML = filtered.map(student => `
        <button type="button" class="admin-student-combo-option ${student.uuid === selectedUuid ? "is-selected" : ""}" onclick="selectAdminDocumentStudent('${adminDocSafeText(student.uuid)}')">
            <strong>${adminDocSafeText(student.name || "Unnamed Student")}</strong>
            <span>${adminDocSafeText(student.office || "Not assigned")}</span>
        </button>
    `).join("");

    previewAdminUploadStudent();
}

function filterAdminDocumentStudentCombo(){
    const input = document.getElementById("documentStudentComboInput");
    const hidden = document.getElementById("documentStudentSelect");

    if(hidden){
        hidden.value = "";
    }

    renderAdminDocumentStudentOptions(adminDocumentStudentOptionCache || [], "", input ? input.value : "");
    setAdminDocumentStudentComboOpen(true);
    previewAdminUploadStudent();
}

function filterAdminDocumentStudentSelect(){
    return filterAdminDocumentStudentCombo();
}

async function loadAdminDocumentStudentOptions(selectedUuid){
    const hidden = document.getElementById("documentStudentSelect");
    const input = document.getElementById("documentStudentComboInput");
    const list = document.getElementById("documentStudentComboList");
    if(!hidden || !list) return;

    hidden.value = "";
    if(input) input.value = "";
    list.innerHTML = `<div class="admin-student-combo-empty">Loading students...</div>`;

    let students = adminStudentsCache || [];
    if(!students.length && typeof fetchAdminStudents === "function"){
        const result = await fetchAdminStudents();
        if(result.error){
            list.innerHTML = `<div class="admin-student-combo-empty">Unable to load students</div>`;
            const hint = document.getElementById("documentSelectedStudentHint");
            if(hint) hint.textContent = result.error;
            return;
        }
        students = result.students || [];
    }

    adminDocumentStudentOptionCache = sortAdminStudentsAlphabetically(students);
    renderAdminDocumentStudentOptions(adminDocumentStudentOptionCache, selectedUuid || "", "");

    if(selectedUuid){
        selectAdminDocumentStudent(selectedUuid);
    }
}

function previewAdminUploadStudent(){
    const hint = document.getElementById("documentSelectedStudentHint");
    const student = getAdminUploadSelectedStudent();

    if(!hint) return;

    if(!student){
        hint.innerHTML = `<i class="fa fa-circle-info"></i> Choose a student to upload a document under their account.`;
        return;
    }

    hint.innerHTML = `
        <strong>${adminDocSafeText(student.name)}</strong><br>
        <span>${adminDocSafeText(student.id)} · ${adminDocSafeText(student.school || "School not set")} · ${adminDocSafeText(student.course || "Course not set")}</span><br>
        <small>Office Assigned: ${adminDocSafeText(student.office || "Not assigned")}</small>
    `;
}

async function openAdminDocumentUploadModal(studentUuid){
    const form = document.getElementById("documentForm");
    if(form) form.reset();

    const status = document.getElementById("documentUploadStatus");
    if(status) status.value = "Approved";

    await loadAdminDocumentStudentOptions(studentUuid || "");

    const modalEl = document.getElementById("documentModal");
    if(modalEl && window.bootstrap){
        new bootstrap.Modal(modalEl).show();
    }
}

async function adminUploadStudentDocument(){
    const client = initSupabaseAdmin();
    if(!client){
        alert("Supabase config is missing.");
        return;
    }

    const student = getAdminUploadSelectedStudent();
    const fileInput = document.getElementById("documentFile");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const documentType = (document.getElementById("documentType")?.value || "").trim();
    const status = (document.getElementById("documentUploadStatus")?.value || "Approved").trim();
    const remarks = (document.getElementById("documentAdminRemarks")?.value || "").trim();
    const button = document.getElementById("adminDocumentUploadButton");
    const originalText = button ? button.innerHTML : "";

    if(!student){
        alert("Please select the student who owns this document.");
        return;
    }

    if(!documentType){
        alert("Please select a document type.");
        return;
    }

    if(!file){
        alert("Please choose a file to upload.");
        return;
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    if(!ADMIN_DOCUMENT_ALLOWED_EXTENSIONS.includes(extension)){
        alert("Invalid file type. Use PDF, DOC, DOCX, JPG, JPEG, or PNG.");
        return;
    }

    try{
        if(button){
            button.disabled = true;
            button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Uploading...`;
        }

        const safeName = sanitizeAdminDocumentFileName(file.name);
        const studentFolder = sanitizeAdminStorageFolder(student.id);
        const filePath = `${studentFolder}/admin_uploads/${Date.now()}_${safeName}`;

        const { error: uploadError } = await client
            .storage
            .from(getAdminStorageBucket())
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: false
            });

        if(uploadError){
            throw new Error("Storage upload failed: " + uploadError.message);
        }

        const { data: publicUrlData } = client
            .storage
            .from(getAdminStorageBucket())
            .getPublicUrl(filePath);

        const record = {
            student_id: student.id,
            student_name: student.name,
            course: student.course || "Not set",
            office_assigned: student.office || "Not assigned",
            document_type: documentType,
            file_name: file.name,
            file_path: filePath,
            file_url: publicUrlData.publicUrl,
            status: status || "Approved",
            remarks: "Uploaded by admin",
            admin_remarks: remarks || "Uploaded by admin for this student."
        };

        const { data: inserted, error: insertError } = await client
            .from(getAdminUploadsTable())
            .insert([record])
            .select("*")
            .single();

        if(insertError){
            throw new Error("Upload record failed: " + insertError.message);
        }

        try{
            await client.from(getAdminNotificationsTable()).insert([{
                student_id: student.id,
                title: "Document uploaded by admin",
                message: `${documentType} was uploaded to your submissions by the admin.`,
                type: status === "Approved" ? "success" : "info",
                related_type: "document",
                related_id: inserted?.id || null
            }]);
        }catch(notificationError){
            console.warn("Notification could not be sent:", notificationError?.message || notificationError);
        }

        const modalEl = document.getElementById("documentModal");
        const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
        if(modal) modal.hide();

        alert("Document uploaded successfully for " + student.name + ".");
        await renderDocuments();
    }catch(error){
        console.error(error);
        alert(error.message || "Could not upload document.");
    }finally{
        if(button){
            button.disabled = false;
            button.innerHTML = originalText;
        }
    }
}

async function renderDocuments(){
    const statusFilter = document.querySelector("#documentStatus") ? document.querySelector("#documentStatus").value : "All";
    const searchValue = document.querySelector("#documentSearch") ? document.querySelector("#documentSearch").value.toLowerCase() : "";
    const tbody = document.querySelector("#documentsTableBody");

    if(!tbody) return;

    const client = initSupabaseAdmin();

    if(!client){
        ["docTotal", "docApproved", "docPending", "docReturned"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = "0";
        });
        if(typeof showAdminSupabaseMessage === "function"){
            showAdminSupabaseMessage("Open assets/js/supabase-config.js and paste your Supabase Project URL and Publishable/Anon key.");
        }
        return;
    }

    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading student uploads...</h5><p>Please wait while documents are loaded from Supabase.</p></div></td></tr>`;

    const { data, error } = await client
        .from(getAdminUploadsTable())
        .select("*")
        .order("created_at", { ascending:false });

    if(error){
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load uploads</h5><p>${adminDocSafeText(error.message)}</p></div></td></tr>`;
        return;
    }

    const uploads = data || [];

    const totalEl = document.querySelector("#docTotal");
    const approvedEl = document.querySelector("#docApproved");
    const pendingEl = document.querySelector("#docPending");
    const returnedEl = document.querySelector("#docReturned");

    if(totalEl) totalEl.textContent = uploads.length;
    if(approvedEl) approvedEl.textContent = uploads.filter(d => d.status === "Approved").length;
    if(pendingEl) pendingEl.textContent = uploads.filter(d => d.status === "Pending").length;
    if(returnedEl) returnedEl.textContent = uploads.filter(d => d.status === "Returned").length;

    let list = uploads.filter(d => {
        const matchesSearch = JSON.stringify(d).toLowerCase().includes(searchValue);
        const matchesStatus = statusFilter === "All" || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if(!list.length){
        tbody.innerHTML = emptyRow(6,"fa fa-folder-open","No uploaded documents found","Student uploads and admin-uploaded files will appear here.");
        return;
    }

    tbody.innerHTML = list.map(d => {
        const isAdminUpload = String(d.remarks || "").toLowerCase().includes("uploaded by admin") || String(d.admin_remarks || "").toLowerCase().includes("uploaded by admin");
        return `
            <tr>
                <td>
                    <strong>${adminDocSafeText(d.student_name || "Unknown Student")}</strong><br>
                    <small class="text-secondary">${adminDocSafeText(d.student_id || "")} · ${adminDocSafeText(d.course || "")} · ${adminDocSafeText(d.office_assigned || "")}</small>
                    ${isAdminUpload ? `<br><span class="admin-upload-badge"><i class="fa fa-user-shield"></i> Admin uploaded</span>` : ""}
                </td>
                <td>
                    <div class="file-pill">
                        <div class="file-icon"><i class="fa fa-file-lines"></i></div>
                        <div>
                            ${adminDocSafeText(d.file_name || "Uploaded File")}<br>
                            <small class="text-secondary">${adminDocSafeText(d.admin_remarks || d.remarks || "No remarks")}</small>
                        </div>
                    </div>
                </td>
                <td>${adminDocSafeText(d.document_type || "Document")}</td>
                <td>${adminDocBadge(d.status || "Pending")}</td>
                <td>${d.created_at ? new Date(d.created_at).toLocaleString() : "Unknown date"}</td>
                <td>
                    <div class="action-group">
                        <button type="button" class="btn btn-sm btn-outline-primary pgmo-document-preview-btn" data-file-url="${pgmoAdminDocumentPreviewAttr(d.file_url || "")}" data-file-name="${pgmoAdminDocumentPreviewAttr(d.file_name || d.document_type || "Document")}" data-file-type="${pgmoAdminDocumentPreviewAttr(d.document_type || "Document")}">View</button>
                        <button class="btn btn-sm btn-outline-success" onclick="setDocumentStatus('${d.id}','Approved')">Approve</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="returnDocument('${d.id}')">Return</button>
                        <button class="btn btn-sm btn-outline-dark" onclick="deleteAdminDocument('${d.id}')"><i class="fa fa-trash"></i> Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


async function deleteAdminDocument(id){
    const client = initSupabaseAdmin();
    if(!client){ alert("Supabase config is missing."); return; }

    if(!confirm("Delete this document record and its uploaded file?")) return;

    try{
        const { data: rows, error: fetchError } = await client
            .from(getAdminUploadsTable())
            .select("*")
            .eq("id", id)
            .limit(1);

        if(fetchError) throw new Error(fetchError.message);

        const doc = rows && rows.length ? rows[0] : null;
        if(!doc) throw new Error("Document record not found.");

        if(doc.file_path){
            const { error: storageError } = await client
                .storage
                .from(getAdminStorageBucket())
                .remove([doc.file_path]);

            if(storageError){
                console.warn("Storage delete warning:", storageError.message);
            }
        }

        const { error: deleteError } = await client
            .from(getAdminUploadsTable())
            .delete()
            .eq("id", id);

        if(deleteError) throw new Error(deleteError.message);

        if(doc.student_id){
            try{
                await client.from(getAdminNotificationsTable()).insert([{
                    student_id: doc.student_id,
                    title: "Document deleted by admin",
                    message: `${doc.document_type || doc.file_name || "A document"} was removed from your submissions by the admin.`,
                    type: "warning",
                    related_type: "document",
                    related_id: id
                }]);
            }catch(notificationError){
                console.warn("Notification could not be sent:", notificationError?.message || notificationError);
            }
        }

        alert("Document deleted successfully.");
        await renderDocuments();
    }catch(error){
        console.error(error);
        alert(error.message || "Could not delete document.");
    }
}

function deleteDocument(id){
    return deleteAdminDocument(id);
}

// Keep the old button name working if any page still calls addDocument().
function addDocument(){
    return adminUploadStudentDocument();
}

// Make functions explicitly available for inline HTML handlers.
window.openAdminDocumentUploadModal = openAdminDocumentUploadModal;
window.adminUploadStudentDocument = adminUploadStudentDocument;
window.previewAdminUploadStudent = previewAdminUploadStudent;
window.renderDocuments = renderDocuments;
window.addDocument = addDocument;
window.deleteAdminDocument = deleteAdminDocument;
window.deleteDocument = deleteDocument;


/* PGMO PATCH: close admin document student combo when clicking outside */
document.addEventListener("click", function(event){
    const combo = document.getElementById("documentStudentCombo");
    if(!combo) return;
    if(!combo.contains(event.target)){
        combo.classList.remove("is-open");
    }
});


/* PGMO PATCH: Report export based on uploaded spreadsheet template */
function getReportTemplateRows(){
    const list = typeof getFilteredReportStudents === "function" ? getFilteredReportStudents() : [];
    const generatedAt = new Date().toLocaleString();
    const statusFilter = document.getElementById("reportStatusFilter")?.value || "All";
    const officeFilter = document.getElementById("reportOfficeFilter")?.value || "All";
    const searchText = document.getElementById("reportSearch")?.value || "";
    const headers = [
        "Student ID", "Student Name", "Gender", "Date of Birth", "Email", "Phone", "Address", "City", "State / Province", "ZIP / Postal Code", "Country", "School", "Course", "Office Assigned", "Coordinator", "Start Date", "OJT Type", "OJT Status", "Completion Date", "Completed Hours", "Required Hours", "Remaining Hours", "Progress %", "Notes"
    ];
    const rows = [];
    rows.push([null, "PGMO OJT Student Report"]);
    rows.push([null, "Generated At", generatedAt, "Status Filter", statusFilter, "Office Filter", officeFilter, "Search", searchText || "None"]);
    rows.push([]);
    rows.push([null, ...headers]);
    list.forEach(s => {
        const required = Number(s.required || 0);
        const completed = Number(s.completed || 0);
        const remaining = required > 0 ? Math.max(required - completed, 0) : "";
        const pct = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) + "%" : "";
        rows.push([
            null,
            s.id || "",
            s.name || "",
            "",
            "",
            s.email || "",
            s.phone || "",
            "",
            "Cagayan de Oro City",
            "Misamis Oriental",
            "",
            "Philippines",
            s.school || "Not set",
            s.course || "",
            s.office || "Not assigned",
            typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : "Admin",
            "",
            "On-the-Job Training",
            s.status || "",
            "",
            completed,
            required || "Not set",
            remaining,
            pct,
            ""
        ]);
    });
    return {rows, list};
}

function generateReportCsvTemplate(){
    const data = getReportTemplateRows();
    if(!data.list.length){ alert("No report data to export."); return; }
    const csv = "\ufeff" + data.rows.map(row => row.map(typeof csvCell === "function" ? csvCell : function(value){
        const text = String(value ?? "").replace(/\r?\n/g, " ");
        return '"' + text.replace(/"/g, '""') + '"';
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PGMO_OJT_Student_Report_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function generateReportExcel(){
    const data = getReportTemplateRows();
    if(!data.list.length){ alert("No report data to export."); return; }
    if(!window.XLSX){
        alert("Excel export library is still loading. A CSV copy will be downloaded instead.");
        generateReportCsvTemplate();
        return;
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data.rows);
    ws["!merges"] = [{s:{r:0,c:1}, e:{r:0,c:24}}];
    ws["!cols"] = [
        {wch:3},{wch:16},{wch:28},{wch:12},{wch:14},{wch:26},{wch:16},{wch:24},{wch:18},{wch:18},{wch:14},{wch:14},{wch:30},{wch:28},{wch:22},{wch:18},{wch:14},{wch:18},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:14},{wch:24}
    ];
    XLSX.utils.book_append_sheet(wb, ws, "OJT Student Report");
    XLSX.writeFile(wb, `PGMO_OJT_Student_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

window.generateReportCsvTemplate = generateReportCsvTemplate;
window.generateReportExcel = generateReportExcel;
window.generateReport = generateReportCsvTemplate;

/* PGMO PATCH: Excel-only report export with colors, chart images, and template styling */
function getExcelReportStudents(){
    const list = typeof getFilteredReportStudents === "function" ? getFilteredReportStudents() : [];
    return (list || []).slice().sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getExcelReportFilters(){
    return {
        generatedAt: new Date(),
        generatedText: new Date().toLocaleString(),
        status: document.getElementById("reportStatusFilter")?.value || "All",
        office: document.getElementById("reportOfficeFilter")?.value || "All",
        search: document.getElementById("reportSearch")?.value || "None"
    };
}

function excelReportCompletedCount(list){
    return list.filter(s => s.status === "Completed" || (Number(s.required) > 0 && Number(s.completed) >= Number(s.required))).length;
}

function excelReportStatusCounts(list){
    return {
        Pending: list.filter(s => String(s.status || "").toLowerCase() === "pending").length,
        Ongoing: list.filter(s => String(s.status || "").toLowerCase() === "ongoing").length,
        Completed: excelReportCompletedCount(list)
    };
}

function excelReportOfficeCounts(list){
    const map = {};
    list.forEach(s => {
        const office = s.office || "Not assigned";
        map[office] = (map[office] || 0) + 1;
    });
    return Object.entries(map).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}


function excelReportCanvas(width, height){
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    return { canvas, ctx };
}

function excelReportRoundRect(ctx, x, y, w, h, r){
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function makeStatusChartImage(list){
    const counts = excelReportStatusCounts(list);
    const total = Math.max(list.length, 1);
    const items = [
        ["Pending", counts.Pending, "#f59e0b"],
        ["Ongoing", counts.Ongoing, "#16a34a"],
        ["Completed", counts.Completed, "#2563eb"]
    ];
    const { canvas, ctx } = excelReportCanvas(760, 280);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#064e2b";
    ctx.font = "bold 25px Arial";
    ctx.fillText("OJT status overview", 34, 42);
    ctx.fillStyle = "#64748b";
    ctx.font = "15px Arial";
    ctx.fillText("A quick view of where students are in their training progress.", 34, 68);

    let x = 34;
    const y = 112;
    const cardW = 216;
    const gap = 22;
    items.forEach(([label, value, color]) => {
        excelReportRoundRect(ctx, x, y, cardW, 122, 18);
        ctx.fillStyle = "#f8fbf9";
        ctx.fill();
        ctx.strokeStyle = "#d9eadf";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = color;
        excelReportRoundRect(ctx, x + 18, y + 20, 42, 42, 12);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 42px Arial";
        ctx.fillText(String(value), x + 78, y + 55);
        ctx.fillStyle = "#064e2b";
        ctx.font = "bold 17px Arial";
        ctx.fillText(label, x + 18, y + 88);
        ctx.fillStyle = "#64748b";
        ctx.font = "14px Arial";
        const pct = Math.round((value / total) * 100);
        ctx.fillText(`${pct}% of total students`, x + 18, y + 108);
        x += cardW + gap;
    });

    ctx.fillStyle = "#e2e8f0";
    excelReportRoundRect(ctx, 34, 250, 670, 12, 6);
    ctx.fill();
    let currentX = 34;
    items.forEach(([label, value, color]) => {
        const w = Math.round((value / total) * 670);
        if(w > 0){
            ctx.fillStyle = color;
            excelReportRoundRect(ctx, currentX, 250, w, 12, 6);
            ctx.fill();
        }
        currentX += w;
    });
    return canvas.toDataURL("image/png");
}

function makeOfficeChartImage(list){
    const offices = excelReportOfficeCounts(list).slice(0, 6);
    const { canvas, ctx } = excelReportCanvas(760, 330);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#064e2b";
    ctx.font = "bold 25px Arial";
    ctx.fillText("Students by office", 34, 42);
    ctx.fillStyle = "#64748b";
    ctx.font = "15px Arial";
    ctx.fillText("Top office assignments based on current filters.", 34, 68);

    if(!offices.length){
        ctx.fillStyle = "#64748b";
        ctx.font = "16px Arial";
        ctx.fillText("No office data available.", 34, 130);
        return canvas.toDataURL("image/png");
    }

    const max = Math.max(...offices.map(x => x[1]), 1);
    const x0 = 250;
    const y0 = 104;
    const barMax = 410;
    offices.forEach(([office, count], index) => {
        const y = y0 + index * 36;
        const w = Math.max(10, Math.round((count / max) * barMax));
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "right";
        const label = String(office || "Not assigned").length > 24 ? String(office).slice(0, 22) + "…" : String(office || "Not assigned");
        ctx.fillText(label, x0 - 16, y + 18);

        ctx.fillStyle = "#ecfdf3";
        excelReportRoundRect(ctx, x0, y, barMax, 22, 11);
        ctx.fill();
        ctx.fillStyle = "#16a34a";
        excelReportRoundRect(ctx, x0, y, w, 22, 11);
        ctx.fill();

        ctx.fillStyle = "#064e2b";
        ctx.textAlign = "left";
        ctx.font = "bold 14px Arial";
        ctx.fillText(String(count), x0 + w + 12, y + 17);
    });
    ctx.textAlign = "left";
    return canvas.toDataURL("image/png");
}

function downloadExcelBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function fallbackStyledExcelHtml(list, filters){
    const statusCounts = excelReportStatusCounts(list);
    const officeRows = excelReportOfficeCounts(list).slice(0, 10);
    const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);
    const date = filters.generatedAt.toISOString().slice(0,10);
    const rows = list.map(s => {
        const required = Number(s.required || 0);
        const completed = Number(s.completed || 0);
        const pct = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
        return `<tr>
            <td>${String(s.id || "")}</td><td>${String(s.name || "")}</td><td>${String(s.school || "Not set")}</td><td>${String(s.course || "")}</td><td>${String(s.office || "Not assigned")}</td><td>${String(s.status || "")}</td><td>${completed}</td><td>${required || "Not set"}</td><td>${pct}%</td><td><div style="width:140px;background:#e2e8f0;border-radius:10px;"><div style="height:12px;width:${pct}%;background:#16a34a;border-radius:10px;"></div></div></td><td>${String(s.email || "")}</td><td>${String(s.phone || "")}</td>
        </tr>`;
    }).join("");
    const officeHtml = officeRows.map(([office,count]) => `<tr><td>${office}</td><td>${count}</td></tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        body{font-family:Arial,sans-serif;color:#0f172a;} .title{font-size:26px;font-weight:bold;color:#064e2b;} .sub{color:#64748b;margin-bottom:18px;} table{border-collapse:collapse;margin-top:14px;width:100%;} th{background:#064e2b;color:white;font-weight:bold;} td,th{border:1px solid #d9eadf;padding:8px;} .kpi{background:#ecfdf3;font-weight:bold;color:#064e2b;text-align:center;} .section{font-size:18px;font-weight:bold;color:#064e2b;margin-top:24px;}
    </style></head><body>
    <div class="title">PGMO OJT Monitoring Report</div><div class="sub">Generated: ${filters.generatedText} | Status: ${filters.status} | Office: ${filters.office} | Search: ${filters.search}</div>
    <table><tr><td class="kpi">Total Students<br><b>${list.length}</b></td><td class="kpi">Ongoing<br><b>${statusCounts.Ongoing}</b></td><td class="kpi">Completed<br><b>${statusCounts.Completed}</b></td><td class="kpi">Total Hours<br><b>${Number(totalHours.toFixed(2))}</b></td></tr></table>
    <div class="section">Office summary</div><table><tr><th>Office</th><th>Count</th></tr>${officeHtml}</table>
    <div class="section">Student details</div><table><tr><th>Student ID</th><th>Student Name</th><th>School</th><th>Course</th><th>Office Assigned</th><th>Status</th><th>Completed Hours</th><th>Required Hours</th><th>Progress %</th><th>Progress Graph</th><th>Email</th><th>Contact Number</th></tr>${rows}</table>
    </body></html>`;
    downloadExcelBlob(new Blob([html], {type:"application/vnd.ms-excel;charset=utf-8;"}), `PGMO_OJT_Report_${date}.xls`);
}

function styleCell(cell, options = {}){
    if(options.fill) cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:options.fill}};
    if(options.font) cell.font = options.font;
    if(options.alignment) cell.alignment = options.alignment;
    if(options.border) cell.border = options.border;
    if(options.numFmt) cell.numFmt = options.numFmt;
}

function fillRange(ws, startRow, startCol, endRow, endCol, options = {}){
    for(let row = startRow; row <= endRow; row++){
        for(let col = startCol; col <= endCol; col++){
            styleCell(ws.getCell(row, col), options);
        }
    }
}

async function generateReportExcel(){
    const list = getExcelReportStudents();
    if(!list.length){ alert("No report data to export."); return; }

    const filters = getExcelReportFilters();
    const fileDate = filters.generatedAt.toISOString().slice(0,10);

    if(!window.ExcelJS){
        fallbackStyledExcelHtml(list, filters);
        return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "PGMO InternTrack";
    wb.created = filters.generatedAt;
    wb.modified = filters.generatedAt;

    const green = "FF064E2B";
    const green2 = "FF166534";
    const lightGreen = "FFEAF7EF";
    const lighterGreen = "FFF7FBF8";
    const midGreen = "FF16A34A";
    const blue = "FF2563EB";
    const orange = "FFF59E0B";
    const grayText = "FF64748B";
    const darkText = "FF0F172A";
    const white = "FFFFFFFF";
    const border = { style:"thin", color:{argb:"FFD9EADF"} };
    const softBorder = {top:border,left:border,bottom:border,right:border};

    const statusCounts = excelReportStatusCounts(list);
    const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);
    const averageProgress = list.length ? Math.round(list.reduce((sum, s) => {
        const required = Number(s.required || 0);
        const completed = Number(s.completed || 0);
        return sum + (required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0);
    }, 0) / list.length) : 0;

    const dashboard = wb.addWorksheet("Dashboard", {
        views:[{showGridLines:false}],
        pageSetup:{paperSize:9, orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:1}
    });
    dashboard.columns = [
        {width:3},{width:14},{width:14},{width:14},{width:3},{width:14},{width:14},{width:14},{width:3},{width:14},{width:14},{width:14},{width:3}
    ];
    for(let r = 1; r <= 34; r++) dashboard.getRow(r).height = 20;

    dashboard.mergeCells("B2:L2");
    styleCell(dashboard.getCell("B2"), {
        fill: lightGreen,
        font:{bold:true, size:24, color:{argb:green}},
        alignment:{horizontal:"center", vertical:"middle"},
        border: softBorder
    });
    dashboard.getCell("B2").value = "PGMO OJT Monitoring Report";
    dashboard.mergeCells("B3:L3");
    styleCell(dashboard.getCell("B3"), {
        fill: lightGreen,
        font:{size:11, color:{argb:grayText}},
        alignment:{horizontal:"center", vertical:"middle"},
        border: softBorder
    });
    dashboard.getCell("B3").value = `Generated ${filters.generatedText}   •   Status: ${filters.status}   •   Office: ${filters.office}   •   Search: ${filters.search}`;

    const kpis = [
        ["Total students", list.length, "Registered student records"],
        ["Ongoing", statusCounts.Ongoing, "Currently active OJT"],
        ["Completed", statusCounts.Completed, "Finished or eligible"],
        ["Avg progress", averageProgress + "%", "Average completion"],
        ["Total hours", Number(totalHours.toFixed(2)), "Approved/completed hours"]
    ];
    const cardPositions = [
        [5,2,7,3], [5,4,7,5], [5,6,7,7], [5,8,7,9], [5,10,7,12]
    ];
    kpis.forEach((kpi, idx) => {
        const [r1,c1,r2,c2] = cardPositions[idx];
        dashboard.mergeCells(r1, c1, r1, c2);
        dashboard.mergeCells(r1 + 1, c1, r1 + 1, c2);
        dashboard.mergeCells(r1 + 2, c1, r1 + 2, c2);
        [r1, r1 + 1, r1 + 2].forEach(r => fillRange(dashboard, r, c1, r, c2, {fill: idx === 0 ? green : lightGreen, border: softBorder}));
        dashboard.getCell(r1, c1).value = kpi[0];
        dashboard.getCell(r1 + 1, c1).value = kpi[1];
        dashboard.getCell(r1 + 2, c1).value = kpi[2];
        styleCell(dashboard.getCell(r1, c1), {font:{bold:true, size:11, color:{argb: idx === 0 ? white : green}}, alignment:{horizontal:"center", vertical:"middle"}});
        styleCell(dashboard.getCell(r1 + 1, c1), {font:{bold:true, size:20, color:{argb: idx === 0 ? white : green}}, alignment:{horizontal:"center", vertical:"middle"}});
        styleCell(dashboard.getCell(r1 + 2, c1), {font:{size:9, color:{argb: idx === 0 ? white : grayText}}, alignment:{horizontal:"center", vertical:"middle"}});
    });

    dashboard.mergeCells("B9:F9");
    dashboard.getCell("B9").value = "Progress snapshot";
    styleCell(dashboard.getCell("B9"), {font:{bold:true, size:14, color:{argb:green}}, alignment:{horizontal:"left"}});
    dashboard.mergeCells("H9:L9");
    dashboard.getCell("H9").value = "Office assignment summary";
    styleCell(dashboard.getCell("H9"), {font:{bold:true, size:14, color:{argb:green}}, alignment:{horizontal:"left"}});

    const statusChartId = wb.addImage({base64: makeStatusChartImage(list), extension:"png"});
    dashboard.addImage(statusChartId, {tl:{col:1, row:9.5}, ext:{width:520, height:190}});
    const officeChartId = wb.addImage({base64: makeOfficeChartImage(list), extension:"png"});
    dashboard.addImage(officeChartId, {tl:{col:7, row:9.5}, ext:{width:520, height:230}});

    dashboard.mergeCells("B24:L28");
    const guide = dashboard.getCell("B24");
    guide.value = "How to read this report\n• The Dashboard gives the quick summary only.\n• The Student Report sheet contains the complete student list with filters and progress.\n• The Summary Data sheet stores chart source data for checking and auditing.";
    styleCell(guide, {
        fill: lighterGreen,
        font:{size:11, color:{argb:darkText}},
        alignment:{vertical:"middle", wrapText:true},
        border: softBorder
    });

    const summary = wb.addWorksheet("Summary Data", {views:[{showGridLines:false}]});
    summary.columns = [{width:24},{width:14},{width:4},{width:32},{width:14}];
    summary.getCell("A1").value = "Report summary data";
    styleCell(summary.getCell("A1"), {font:{bold:true, size:18, color:{argb:green}}});
    summary.getCell("A3").value = "Status";
    summary.getCell("B3").value = "Count";
    [["Pending", statusCounts.Pending], ["Ongoing", statusCounts.Ongoing], ["Completed", statusCounts.Completed]].forEach((row, i) => {
        summary.getCell(4 + i, 1).value = row[0];
        summary.getCell(4 + i, 2).value = row[1];
    });
    summary.getCell("D3").value = "Office";
    summary.getCell("E3").value = "Count";
    excelReportOfficeCounts(list).forEach(([office, count], i) => {
        summary.getCell(4 + i, 4).value = office;
        summary.getCell(4 + i, 5).value = count;
    });
    ["A3","B3","D3","E3"].forEach(addr => styleCell(summary.getCell(addr), {fill:green, font:{bold:true, color:{argb:white}}, alignment:{horizontal:"center"}, border:softBorder}));
    summary.eachRow((row, rowNumber) => {
        if(rowNumber > 3){ row.eachCell(cell => { cell.border = softBorder; }); }
    });

    const detail = wb.addWorksheet("Student Report", {
        views:[{state:"frozen", xSplit:0, ySplit:5, showGridLines:false}],
        pageSetup:{paperSize:9, orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0}
    });
    detail.columns = [
        {header:"Student ID", key:"id", width:18},
        {header:"Student Name", key:"name", width:30},
        {header:"School", key:"school", width:34},
        {header:"Course", key:"course", width:26},
        {header:"Office Assigned", key:"office", width:24},
        {header:"Status", key:"status", width:14},
        {header:"Completed Hours", key:"completed", width:17},
        {header:"Required Hours", key:"required", width:16},
        {header:"Remaining Hours", key:"remaining", width:16},
        {header:"Progress %", key:"progress", width:13},
        {header:"Progress", key:"graph", width:26},
        {header:"Email", key:"email", width:32},
        {header:"Contact Number", key:"phone", width:18}
    ];

    detail.mergeCells("A1:M1");
    detail.getCell("A1").value = "PGMO OJT Student Progress Report";
    styleCell(detail.getCell("A1"), {fill:green, font:{bold:true, size:18, color:{argb:white}}, alignment:{horizontal:"center", vertical:"middle"}, border:softBorder});
    detail.getRow(1).height = 28;
    detail.mergeCells("A2:M2");
    detail.getCell("A2").value = `Generated ${filters.generatedText} | Status: ${filters.status} | Office: ${filters.office} | Search: ${filters.search}`;
    styleCell(detail.getCell("A2"), {fill:lightGreen, font:{size:11, color:{argb:grayText}}, alignment:{horizontal:"center", vertical:"middle"}, border:softBorder});
    detail.getRow(2).height = 22;
    detail.addRow([]);
    detail.addRow(["Student ID", "Student Name", "School", "Course", "Office Assigned", "Status", "Completed Hours", "Required Hours", "Remaining Hours", "Progress %", "Progress", "Email", "Contact Number"]);

    const headerRow = detail.getRow(4);
    headerRow.height = 28;
    headerRow.eachCell(cell => {
        styleCell(cell, {
            fill:green,
            font:{bold:true, color:{argb:white}},
            alignment:{horizontal:"center", vertical:"middle", wrapText:true},
            border:softBorder
        });
    });

    list.forEach((s, idx) => {
        const required = Number(s.required || 0);
        const completed = Number(s.completed || 0);
        const remaining = required > 0 ? Math.max(required - completed, 0) : "";
        const pct = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
        const filled = Math.round(pct / 5);
        const graph = "█".repeat(filled) + "░".repeat(20 - filled);
        const row = detail.addRow([
            s.id || "", s.name || "", s.school || "Not set", s.course || "", s.office || "Not assigned", s.status || "", completed, required || "Not set", remaining, pct / 100, graph, s.email || "", s.phone || ""
        ]);
        row.height = 25;
        row.eachCell((cell, colNumber) => {
            styleCell(cell, {
                fill: idx % 2 === 0 ? "FFF8FBF9" : "FFFFFFFF",
                border:softBorder,
                alignment:{vertical:"middle", wrapText:true}
            });
            if([7,8,9,10].includes(colNumber)) cell.alignment = {horizontal:"center", vertical:"middle"};
            if(colNumber === 10) cell.numFmt = "0%";
        });
        const statusCell = row.getCell(6);
        const normalized = String(s.status || "").toLowerCase();
        statusCell.alignment = {horizontal:"center", vertical:"middle"};
        statusCell.font = {bold:true, color:{argb: normalized === "completed" ? blue : normalized === "ongoing" ? midGreen : orange}};
        const graphCell = row.getCell(11);
        graphCell.font = {name:"Consolas", bold:true, color:{argb: pct >= 100 ? blue : midGreen}};
    });

    detail.autoFilter = {from:"A4", to:"M4"};
    detail.getColumn(10).numFmt = "0%";
    detail.eachRow((row, rowNumber) => {
        if(rowNumber <= 4) return;
        row.eachCell(cell => { cell.border = softBorder; });
    });

    const buffer = await wb.xlsx.writeBuffer();
    downloadExcelBlob(new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), `PGMO_OJT_Report_${fileDate}.xlsx`);
}

function generateReportCsvTemplate(){
    return generateReportExcel();
}

window.generateReportExcel = generateReportExcel;
window.generateReportCsvTemplate = generateReportExcel;
window.generateReport = generateReportExcel;

/* PGMO PATCH: clickable dashboard cards + admin requirement gaps view */
const PGMO_ADMIN_REQUIREMENT_GROUPS = [
    {
        title: "Pre-Deployment Requirements",
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

let pgmoAdminRequirementUploadsCache = [];
let pgmoAdminRequirementDtrCache = [];
let pgmoStudentsUrlFilterApplied = false;

function pgmoAdminReqSafe(value){
    if(typeof safeText === "function") return safeText(value);
    if(typeof adminDocSafeText === "function") return adminDocSafeText(value);
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function pgmoAdminNormalizeRequirement(value){
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function pgmoAdminRequirementAliases(name){
    const key = pgmoAdminNormalizeRequirement(name);
    const aliases = {
        endorsementfromschool: ["endorsementfromschool", "endorsementletter", "schoolendorsement", "endorsement"],
        applicationletter: ["applicationletter"],
        certificateofregistrationenrollment: ["certificateofregistrationenrollment", "certificateofregistration", "certificateofenrollment", "registrationenrollment", "cor"],
        biodataresume: ["biodataresume", "resume", "biodata", "biodataresume2pcs", "2pcsbiodataresume"],
        medicalcertificate: ["medicalcertificate", "medicalcert"],
        parentguardianwaiver: ["parentguardianwaiver", "parentsconsent", "parentconsent", "guardianwaiver", "waiver"],
        policeclearance: ["policeclearance"],
        moamou: ["moamou", "moa", "mou"],
        endorsementletterfromhostingoffice: ["endorsementletterfromhostingoffice", "hostingofficeendorsement", "endorsementfromhostingoffice"],
        dailytimerecorddtr: ["dailytimerecorddtr", "dtr", "dailytimerecord"],
        dtr: ["dtr", "dailytimerecord", "dailytimerecorddtr"],
        schoolperformanceevaluationform: ["schoolperformanceevaluationform", "evaluationform", "performanceevaluationform"],
        accomplishmentreport: ["accomplishmentreport", "completionreport"],
        certificateofcompletion: ["certificateofcompletion", "completioncertificate"],
        ojtfeedbackform: ["ojtfeedbackform", "feedbackform"]
    };
    return aliases[key] || [key];
}

function pgmoAdminGetRequirementUploads(requirementName, uploads){
    const aliases = pgmoAdminRequirementAliases(requirementName);
    return (uploads || []).filter(item => aliases.includes(pgmoAdminNormalizeRequirement(item.document_type)));
}

function pgmoAdminRequirementStatus(requirementName, uploads, dtrForms, student){
    const key = pgmoAdminNormalizeRequirement(requirementName);
    const matchingUploads = pgmoAdminGetRequirementUploads(requirementName, uploads);

    if(matchingUploads.some(item => String(item.status || "").toLowerCase() === "approved")) return "Approved";
    if(matchingUploads.some(item => String(item.status || "").toLowerCase() === "pending")) return "Pending";
    if(matchingUploads.some(item => ["returned", "rejected"].includes(String(item.status || "").toLowerCase()))) return "Returned";

    if(["dtr", "dailytimerecord", "dailytimerecorddtr"].includes(key)){
        const completed = Number(student?.completed || 0);
        const required = Number(student?.required || 0);
        const forms = dtrForms || [];
        const hasApproved = forms.some(item => String(item.status || "").toLowerCase() === "approved");
        const hasPending = forms.some(item => String(item.status || "").toLowerCase() === "pending");
        const hasReturned = forms.some(item => ["returned", "rejected"].includes(String(item.status || "").toLowerCase()));

        if(required > 0 && completed >= required && hasApproved) return "Approved";
        if(hasPending || hasApproved) return "Pending";
        if(hasReturned) return "Returned";
    }

    return "Missing";
}

function pgmoAdminStudentUploads(student){
    const studentId = String(student?.id || "").trim();
    const studentUuid = String(student?.uuid || "").trim();
    return (pgmoAdminRequirementUploadsCache || []).filter(item => {
        const owner = String(item.student_id || "").trim();
        return owner === studentId || owner === studentUuid;
    });
}

function pgmoAdminStudentDtrForms(student){
    const studentId = String(student?.id || "").trim();
    const studentUuid = String(student?.uuid || "").trim();
    return (pgmoAdminRequirementDtrCache || []).filter(item => {
        const owner = String(item.student_id || "").trim();
        return owner === studentId || owner === studentUuid;
    });
}

function pgmoAdminRequirementSummary(student){
    const uploads = pgmoAdminStudentUploads(student);
    const dtrForms = pgmoAdminStudentDtrForms(student);
    const all = PGMO_ADMIN_REQUIREMENT_GROUPS.flatMap(group => group.items.map(name => ({group: group.title, name})));
    const rows = all.map(item => ({
        ...item,
        status: pgmoAdminRequirementStatus(item.name, uploads, dtrForms, student)
    }));
    const approved = rows.filter(row => row.status === "Approved").length;
    const pending = rows.filter(row => row.status === "Pending").length;
    const returned = rows.filter(row => row.status === "Returned").length;
    const missing = rows.filter(row => row.status === "Missing").length;
    return { rows, approved, pending, returned, missing, lacking: pending + returned + missing, total: rows.length };
}

function pgmoAdminRequirementBadge(status){
    const normalized = String(status || "Missing").toLowerCase();
    const icon = normalized === "approved" ? "fa-check" : normalized === "pending" ? "fa-hourglass-half" : normalized === "returned" ? "fa-rotate-left" : "fa-xmark";
    const label = normalized === "missing" ? "Missing" : status;
    return `<span class="pgmo-req-badge ${normalized}"><i class="fa ${icon}"></i> ${pgmoAdminReqSafe(label)}</span>`;
}

async function pgmoFetchAdminRequirementSources(){
    const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
    if(!client){
        pgmoAdminRequirementUploadsCache = [];
        pgmoAdminRequirementDtrCache = [];
        return;
    }

    try{
        const { data } = await client
            .from(typeof getAdminUploadsTable === "function" ? getAdminUploadsTable() : "ojt_uploads")
            .select("*")
            .order("created_at", { ascending:false });
        pgmoAdminRequirementUploadsCache = data || [];
    }catch(error){
        console.warn("Requirement upload source warning:", error?.message || error);
        pgmoAdminRequirementUploadsCache = [];
    }

    try{
        const dtrTable = typeof getAdminDtrFormsTableSafe === "function" ? getAdminDtrFormsTableSafe() : (typeof OJT_DTR_FORMS_TABLE !== "undefined" ? OJT_DTR_FORMS_TABLE : "ojt_dtr_forms");
        const { data, error } = await client
            .from(dtrTable)
            .select("*")
            .order("created_at", { ascending:false });
        pgmoAdminRequirementDtrCache = error ? [] : (data || []);
    }catch(error){
        pgmoAdminRequirementDtrCache = [];
    }
}

function pgmoApplyStudentUrlFiltersOnce(){
    if(pgmoStudentsUrlFilterApplied) return;
    pgmoStudentsUrlFilterApplied = true;

    const params = new URLSearchParams(window.location.search || "");
    const status = params.get("status");
    const requirement = params.get("requirements");
    const statusSelect = document.getElementById("studentStatus");

    if(statusSelect && status && ["Pending", "Ongoing", "Completed"].includes(status)){
        statusSelect.value = status;
    }else if(statusSelect && params.get("filter") === "all"){
        statusSelect.value = "All";
    }

    if(requirement === "lacking"){
        document.body.dataset.requirementsFilter = "lacking";
    }
}

async function renderDashboard(){
    if(document.body.dataset.page !== "dashboard") return;

    const totalStudentsEl = document.getElementById("totalStudents");
    const pendingApplicationsEl = document.getElementById("pendingApplications");
    const ongoingOjtEl = document.getElementById("ongoingOjt");
    const completedOjtEl = document.getElementById("completedOjt");
    const recentStudentsEl = document.getElementById("recentStudents");
    const recentDocsEl = document.getElementById("recentDocs");

    if(!totalStudentsEl || !pendingApplicationsEl || !ongoingOjtEl || !completedOjtEl) return;

    const result = typeof fetchAdminStudents === "function" ? await fetchAdminStudents() : { students:[], error:null };
    const students = result.students || [];

    totalStudentsEl.textContent = students.length;
    pendingApplicationsEl.textContent = students.filter(s => String(s.status || "").toLowerCase() === "pending").length;
    ongoingOjtEl.textContent = students.filter(s => String(s.status || "").toLowerCase() === "ongoing").length;
    completedOjtEl.textContent = students.filter(s => String(s.status || "").toLowerCase() === "completed").length;

    setupDashboardStatCards();

    if(recentStudentsEl){
        recentStudentsEl.innerHTML = students.length ? students.slice(0, 5).map(student => `
            <tr class="${(String(student.status || '').toLowerCase() === 'completed' || (Number(student.required || 0) > 0 && Number(student.completed || 0) >= Number(student.required || 0))) ? 'pgmo-completed-student-row' : ''}">
                <td><strong>${pgmoAdminReqSafe(student.name)}</strong><br><small class="text-secondary">${pgmoAdminReqSafe(student.id || "-")}</small></td>
                <td>${pgmoAdminReqSafe(student.office || "Not assigned")}</td>
                <td>${Number(student.completed || 0)} / ${Number(student.required || 0) || "Not set"}</td>
                <td>${typeof badge === "function" ? badge(student.status) : pgmoAdminRequirementBadge(student.status)}</td>
                <td><a class="btn btn-sm btn-outline-primary" href="students.html?filter=all">Open</a></td>
            </tr>
        `).join("") : emptyRow(5, "fa fa-user-graduate", "No students yet", "Registered students will appear here.");
    }

    if(recentDocsEl){
        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(client){
            const { data } = await client
                .from(typeof getAdminUploadsTable === "function" ? getAdminUploadsTable() : "ojt_uploads")
                .select("*")
                .order("created_at", { ascending:false })
                .limit(5);
            const docs = data || [];
            recentDocsEl.innerHTML = docs.length ? docs.map(d => `
                <tr>
                    <td>${pgmoAdminReqSafe(d.student_name || d.student_id || "Unknown")}</td>
                    <td>${pgmoAdminReqSafe(d.document_type || d.file_name || "Document")}</td>
                    <td>${typeof badge === "function" ? badge(d.status || "Pending") : pgmoAdminRequirementBadge(d.status || "Pending")}</td>
                </tr>
            `).join("") : emptyRow(3, "fa fa-folder-open", "No documents yet", "Uploaded documents will appear here.");
        }
    }
}

function setupDashboardStatCards(){
    const routes = [
        ["totalStudents", "students.html?filter=all", "View all students"],
        ["pendingApplications", "students.html?status=Pending", "View pending students"],
        ["ongoingOjt", "students.html?status=Ongoing", "View ongoing OJT students"],
        ["completedOjt", "students.html?status=Completed", "View completed students"]
    ];

    routes.forEach(([id, href, title]) => {
        const number = document.getElementById(id);
        const card = number ? number.closest(".stat-card") : null;
        if(!card) return;
        card.classList.add("admin-clickable-stat-card");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("title", title);
        card.onclick = () => { window.location.href = href; };
        card.onkeydown = event => {
            if(event.key === "Enter" || event.key === " "){
                event.preventDefault();
                window.location.href = href;
            }
        };
    });
}

window.renderStudents = async function(){
    const tbody = document.querySelector("#studentsTableBody");
    if(!tbody) return;

    pgmoApplyStudentUrlFiltersOnce();

    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading students...</h5><p>Fetching registered students and requirement status.</p></div></td></tr>`;

    const result = await fetchAdminStudents();
    if(result.error){
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${pgmoAdminReqSafe(result.error)}</p></div></td></tr>`;
        return;
    }

    await pgmoFetchAdminRequirementSources();

    if(typeof populateStudentSchoolFilter === "function") populateStudentSchoolFilter(result.students);

    const search = (document.querySelector("#studentSearch")?.value || "").toLowerCase();
    const status = document.querySelector("#studentStatus")?.value || "All";
    const school = document.querySelector("#studentSchoolFilter")?.value || "All";
    const office = (document.querySelector("#studentOfficeFilter")?.value || "").toLowerCase();
    const onlyLacking = document.body.dataset.requirementsFilter === "lacking";

    const list = result.students.filter(s => {
        const summary = pgmoAdminRequirementSummary(s);
        return JSON.stringify(s).toLowerCase().includes(search)
            && (status === "All" || s.status === status)
            && (school === "All" || (s.school || "Not set") === school)
            && (!office || String(s.office || "").toLowerCase().includes(office))
            && (!onlyLacking || summary.lacking > 0);
    });

    tbody.innerHTML = list.length ? list.map(s => {
        const summary = pgmoAdminRequirementSummary(s);
        const lackingLabel = summary.lacking > 0
            ? `<span class="pgmo-req-count warning">${summary.lacking} lacking</span>`
            : `<span class="pgmo-req-count complete">Complete</span>`;
        return `
            <tr class="${(String(s.status || '').toLowerCase() === 'completed' || (Number(s.required || 0) > 0 && Number(s.completed || 0) >= Number(s.required || 0))) ? 'pgmo-completed-student-row' : ''}">
                <td><strong>${pgmoAdminReqSafe(s.id)}</strong></td>
                <td>${pgmoAdminReqSafe(s.name)}<br><small class="text-secondary">${pgmoAdminReqSafe(s.email)}</small><br><small class="text-secondary">${pgmoAdminReqSafe(s.phone)}</small></td>
                <td>${pgmoAdminReqSafe(s.school || "Not set")}</td>
                <td>${pgmoAdminReqSafe(s.course)}</td>
                <td>${pgmoAdminReqSafe(s.office)}</td>
                <td>${typeof progressBar === "function" ? progressBar(s.completed,s.required) : `${s.completed} / ${s.required}`}</td>
                <td>${typeof badge === "function" ? badge(s.status) : pgmoAdminRequirementBadge(s.status)}</td>
                <td>
                    <div class="action-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewStudent('${pgmoAdminReqSafe(s.uuid)}')">View</button>
                        <button class="btn btn-sm btn-outline-success" onclick="openStudentRequirements('${pgmoAdminReqSafe(s.uuid)}')"><i class="fa fa-list-check"></i> Requirements ${lackingLabel}</button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editStudent('${pgmoAdminReqSafe(s.uuid)}')">Edit</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${pgmoAdminReqSafe(s.uuid)}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("") : emptyRow(8,"fa fa-user-graduate","No students found","Try changing the school, office, status, requirement, or search filter.");
};

function ensureAdminRequirementsModal(){
    let modal = document.getElementById("studentRequirementsModal");
    if(modal) return modal;

    modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "studentRequirementsModal";
    modal.tabIndex = -1;
    modal.innerHTML = `
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h5 class="modal-title mb-0">Student Requirement Status</h5>
                        <small class="text-secondary" id="studentRequirementsSubtitle">Checking requirements...</small>
                    </div>
                    <button class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body" id="studentRequirementsBody"></div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

async function openStudentRequirements(uuid){
    ensureAdminRequirementsModal();

    if(!pgmoAdminRequirementUploadsCache.length && typeof pgmoFetchAdminRequirementSources === "function"){
        await pgmoFetchAdminRequirementSources();
    }

    const student = (adminStudentsCache || []).find(item => String(item.uuid) === String(uuid));
    const body = document.getElementById("studentRequirementsBody");
    const subtitle = document.getElementById("studentRequirementsSubtitle");

    if(!student || !body){
        alert("Student not found. Please refresh the page.");
        return;
    }

    const summary = pgmoAdminRequirementSummary(student);
    if(subtitle){
        subtitle.textContent = `${student.name} • ${student.id} • ${student.office || "Not assigned"}`;
    }

    body.innerHTML = `
        <div class="pgmo-requirements-summary-grid">
            <div class="pgmo-requirement-summary-card"><span>Approved</span><strong>${summary.approved}</strong></div>
            <div class="pgmo-requirement-summary-card"><span>Pending</span><strong>${summary.pending}</strong></div>
            <div class="pgmo-requirement-summary-card"><span>Returned</span><strong>${summary.returned}</strong></div>
            <div class="pgmo-requirement-summary-card warning"><span>Lacking</span><strong>${summary.lacking}</strong></div>
        </div>
        <div class="alert alert-light border mt-3 mb-3">
            <strong>Note:</strong> Lacking means the requirement is not approved yet. Missing, pending, and returned files are included so the admin can guide the student clearly.
        </div>
        ${PGMO_ADMIN_REQUIREMENT_GROUPS.map(group => `
            <div class="pgmo-admin-req-group">
                <h6>${pgmoAdminReqSafe(group.title)}</h6>
                <div class="table-responsive">
                    <table class="table table-sm align-middle pgmo-admin-req-table">
                        <thead><tr><th>Requirement</th><th>Status</th><th>Uploaded File</th><th>Source</th></tr></thead>
                        <tbody>
                            ${group.items.map(name => {
                                const uploads = pgmoAdminStudentUploads(student);
                                const matches = pgmoAdminGetRequirementUploads(name, uploads);
                                const latest = matches[0];
                                const status = pgmoAdminRequirementStatus(name, uploads, pgmoAdminStudentDtrForms(student), student);
                                const source = !latest ? "-" : ((String(latest.uploaded_by || "").toLowerCase() === "admin" || String(latest.file_path || "").includes("admin_uploads") || String(latest.remarks || "").toLowerCase().includes("uploaded by admin") || String(latest.admin_remarks || "").toLowerCase().includes("uploaded by admin")) ? "Admin" : "Student");
                                const file = latest?.file_url
                                    ? `<a href="${pgmoAdminReqSafe(latest.file_url)}" target="_blank" rel="noopener noreferrer">${pgmoAdminReqSafe(latest.file_name || "View file")}</a>`
                                    : (latest ? pgmoAdminReqSafe(latest.file_name || "Uploaded file") : `<span class="text-danger">No file uploaded</span>`);
                                return `<tr class="pgmo-req-row-${String(status).toLowerCase()}"><td>${pgmoAdminReqSafe(name)}</td><td>${pgmoAdminRequirementBadge(status)}</td><td>${file}</td><td>${pgmoAdminReqSafe(source)}</td></tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `).join("")}
    `;

    new bootstrap.Modal(document.getElementById("studentRequirementsModal")).show();
}

window.openStudentRequirements = openStudentRequirements;
window.setupDashboardStatCards = setupDashboardStatCards;

function addDashboardRequirementShortcut(){
    const quickActions = document.querySelector(".card-panel .d-grid.gap-2.mt-3");
    if(!quickActions || quickActions.dataset.reqShortcut === "true") return;
    quickActions.dataset.reqShortcut = "true";
    const link = document.createElement("a");
    link.className = "btn btn-outline-success";
    link.href = "students.html?requirements=lacking";
    link.innerHTML = '<i class="fa fa-list-check"></i> View Requirement Gaps';
    quickActions.appendChild(link);
}

document.addEventListener("DOMContentLoaded", function(){
    if(document.body.dataset.page === "dashboard"){
        setupDashboardStatCards();
        addDashboardRequirementShortcut();
        setTimeout(() => { if(typeof renderDashboard === "function") renderDashboard(); }, 250);
    }
    if(document.body.dataset.page === "students"){
        ensureAdminRequirementsModal();
    }
});


/* PGMO PATCH 2026-06-30: admin reset student password */
(function(){
    const RESET_COL_HINT = "Run database/supabase_admin_password_reset_patch.sql in Supabase, then try again.";

    function resetSafe(value){
        if(typeof safeText === "function") return safeText(value);
        if(typeof pgmoAdminReqSafe === "function") return pgmoAdminReqSafe(value);
        return String(value ?? "")
            .replaceAll("&","&amp;")
            .replaceAll("<","&lt;")
            .replaceAll(">","&gt;")
            .replaceAll('"',"&quot;")
            .replaceAll("'","&#039;");
    }

    function generateTemporaryStudentPassword(){
        const random = Math.floor(100000 + Math.random() * 900000);
        const tail = Math.random().toString(36).slice(2, 5);
        return `Pgmo${random}${tail}`;
    }

    function findStudentUuidFromButton(button){
        const actionGroup = button.closest(".action-group");
        if(!actionGroup) return "";
        const candidate = actionGroup.querySelector("button[onclick*='editStudent'], button[onclick*='viewStudent']");
        const onclick = candidate ? candidate.getAttribute("onclick") || "" : "";
        const match = onclick.match(/'(.*?)'/) || onclick.match(/\"(.*?)\"/);
        return match ? match[1] : "";
    }

    function addResetButtonsToStudentTable(){
        if(document.body?.dataset?.page !== "students") return;
        document.querySelectorAll("#studentsTableBody .action-group").forEach(group => {
            if(group.querySelector(".pgmo-reset-password-btn")) return;
            const editButton = group.querySelector("button[onclick*='editStudent']");
            const uuid = editButton ? findStudentUuidFromButton(editButton) : "";
            if(!uuid) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "btn btn-sm btn-outline-dark pgmo-reset-password-btn";
            button.innerHTML = '<i class="fa fa-key"></i> Reset Password';
            button.onclick = () => window.resetStudentPassword(uuid);
            group.insertBefore(button, editButton.nextSibling);
        });
    }

    const previousRenderStudents = typeof window.renderStudents === "function" ? window.renderStudents : null;
    if(previousRenderStudents){
        window.renderStudents = async function(){
            const output = await previousRenderStudents.apply(this, arguments);
            addResetButtonsToStudentTable();
            return output;
        };
    }

    function showTemporaryPasswordModal(student, tempPassword){
        let modal = document.getElementById("studentPasswordResetModal");
        if(!modal){
            modal = document.createElement("div");
            modal.className = "modal fade";
            modal.id = "studentPasswordResetModal";
            modal.tabIndex = -1;
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content pgmo-reset-modal">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="fa fa-key"></i> Password Reset Complete</h5>
                            <button class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="studentPasswordResetBody"></div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" id="copyTempPasswordBtn"><i class="fa fa-copy"></i> Copy Password</button>
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Done</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        }

        const body = document.getElementById("studentPasswordResetBody");
        if(body){
            body.innerHTML = `
                <p class="mb-2"><strong>${resetSafe(student?.name || "Student")}</strong> can now log in using this temporary password:</p>
                <div class="temporary-password-box" id="temporaryPasswordText">${resetSafe(tempPassword)}</div>
                <div class="password-reset-note">
                    <i class="fa fa-circle-info"></i>
                    The student must change this password after logging in.
                </div>`;
        }

        const copyBtn = document.getElementById("copyTempPasswordBtn");
        if(copyBtn){
            copyBtn.onclick = async () => {
                try{
                    await navigator.clipboard.writeText(tempPassword);
                    copyBtn.innerHTML = '<i class="fa fa-check"></i> Copied';
                    setTimeout(() => copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copy Password', 1200);
                }catch(error){
                    alert("Temporary password: " + tempPassword);
                }
            };
        }

        if(window.bootstrap?.Modal){
            new bootstrap.Modal(modal).show();
        }else{
            alert(`Temporary password for ${student?.name || "student"}: ${tempPassword}`);
        }
    }

    window.resetStudentPassword = async function(uuid){
        const client = typeof initSupabaseAdmin === "function" ? initSupabaseAdmin() : null;
        if(!client){ alert("Supabase config is missing."); return; }

        const student = (window.adminStudentsCache || adminStudentsCache || []).find(item => String(item.uuid) === String(uuid));
        if(!student){ alert("Student not found. Please refresh the Students page."); return; }

        const confirmed = confirm(`Reset password for ${student.name}?\n\nThe system will generate a temporary password. The student must change it after login.`);
        if(!confirmed) return;

        const tempPassword = generateTemporaryStudentPassword();
        const passwordHash = await adminHashPassword(tempPassword);
        const adminName = typeof getAdminSessionUsername === "function" ? getAdminSessionUsername() : (sessionStorage.getItem("interntrack_username") || "admin");

        const { error } = await client
            .from(getAdminStudentAccountsTable())
            .update({
                password_hash: passwordHash,
                must_change_password: true,
                password_reset_at: new Date().toISOString(),
                password_reset_by: adminName,
                updated_at: new Date().toISOString()
            })
            .eq("id", uuid);

        if(error){
            alert(error.message + "\n\n" + RESET_COL_HINT);
            return;
        }

        if(typeof createStudentNotification === "function"){
            await createStudentNotification(
                student.id,
                "Password Reset",
                "Your password was reset by the admin. Please log in using the temporary password and change it immediately.",
                "warning",
                "password_reset",
                uuid
            );
        }

        showTemporaryPasswordModal(student, tempPassword);
    };

    document.addEventListener("DOMContentLoaded", function(){
        setTimeout(addResetButtonsToStudentTable, 300);
    });
})();


/* PGMO PATCH 2026-07-01: Admin student summary report + lacking requirements report */
(function(){
    "use strict";

    let pgmoLackingReportCache = [];
    let pgmoLackingReportAllRows = [];
    let pgmoLackingReportStudentsCache = [];
    let pgmoLackingReportSelectedKeys = new Set();
    let pgmoLackingReportKnownKeys = new Set();

    function pgmoReportSafe(value){
        if(typeof pgmoAdminReqSafe === "function") return pgmoAdminReqSafe(value);
        if(typeof safeText === "function") return safeText(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function pgmoReportPlain(value){
        return String(value ?? "").trim();
    }

    function pgmoReportIsCompleted(student){
        const required = Number(student?.required || 0);
        const completed = Number(student?.completed || 0);
        return String(student?.status || "").toLowerCase() === "completed" || (required > 0 && completed >= required);
    }

    function pgmoReportCompletionLabel(student){
        return pgmoReportIsCompleted(student) ? "Completed" : "Not Completed";
    }

    function pgmoReportCompletionPill(student){
        const label = pgmoReportCompletionLabel(student);
        const cls = label === "Completed" ? "completed" : "not-completed";
        const icon = label === "Completed" ? "fa-check" : "fa-clock";
        return `<span class="pgmo-completion-pill ${cls}"><i class="fa ${icon}"></i> ${label}</span>`;
    }

    function pgmoReportUniqueValues(students, key, fallback){
        return [...new Set((students || []).map(item => pgmoReportPlain(item?.[key] || fallback || "Not set")).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    }

    function pgmoPopulateSelect(selectId, values, allLabel){
        const select = document.getElementById(selectId);
        if(!select) return;
        const current = select.value || "All";
        select.innerHTML = `<option value="All">${allLabel}</option>` + values.map(value => `<option value="${pgmoReportSafe(value)}">${pgmoReportSafe(value)}</option>`).join("");
        select.value = values.includes(current) ? current : "All";
    }

    function getFilteredReportStudents(){
        const search = (document.getElementById("reportSearch")?.value || "").toLowerCase();
        const course = document.getElementById("reportCourseFilter")?.value || "All";
        const office = document.getElementById("reportOfficeFilter")?.value || "All";
        const completion = document.getElementById("reportCompletionFilter")?.value || "All";
        const status = document.getElementById("reportStatusFilter")?.value || "All";

        return (window.reportStudentsCache || reportStudentsCache || []).filter(student => {
            const completionLabel = pgmoReportCompletionLabel(student);
            const nameSearchSource = [student.name, student.id, student.email, student.school, student.course, student.office, completionLabel].join(" ").toLowerCase();
            return (!search || nameSearchSource.includes(search))
                && (course === "All" || String(student.course || "-") === course)
                && (office === "All" || String(student.office || "Not assigned") === office)
                && (completion === "All" || completionLabel === completion)
                && (status === "All" || student.status === status);
        });
    }

    async function renderReports(){
        const tbody = document.getElementById("reportsTableBody");
        if(!tbody) return;

        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading report...</h5><p>Fetching student summary.</p></div></td></tr>`;

        const result = typeof fetchAdminStudents === "function" ? await fetchAdminStudents() : {students:[], error:"Student loader is missing."};
        if(result.error){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load reports</h5><p>${pgmoReportSafe(result.error)}</p></div></td></tr>`;
            return;
        }

        reportStudentsCache = result.students || [];
        window.reportStudentsCache = reportStudentsCache;
        pgmoPopulateSelect("reportCourseFilter", pgmoReportUniqueValues(reportStudentsCache, "course", "-"), "All Courses");
        pgmoPopulateSelect("reportOfficeFilter", pgmoReportUniqueValues(reportStudentsCache, "office", "Not assigned"), "All Offices");

        const list = getFilteredReportStudents();
        const completed = list.filter(pgmoReportIsCompleted).length;
        const notCompleted = list.length - completed;
        const pending = list.filter(s => String(s.status || "").toLowerCase() === "pending").length;
        const ongoing = list.filter(s => String(s.status || "").toLowerCase() === "ongoing").length;
        const totalHours = list.reduce((sum, s) => sum + Number(s.completed || 0), 0);
        const courseCount = pgmoReportUniqueValues(list, "course", "-").length;
        const officeCount = pgmoReportUniqueValues(list, "office", "Not assigned").length;

        const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
        setText("reportStudents", list.length);
        setText("reportActive", ongoing);
        setText("reportCompleted", completed);
        setText("reportNotCompleted", notCompleted);
        setText("reportTotalHours", Number(totalHours.toFixed(2)));
        setText("reportCourseCount", courseCount);
        setText("reportOfficeCount", officeCount);

        if(typeof setBar === "function"){
            setBar("ongoingBar", "ongoingLabel", ongoing, list.length);
            setBar("pendingBar", "pendingLabel", pending, list.length);
            setBar("completedBar", "completedLabel", completed, list.length);
        }

        const officeCounts = {};
        list.forEach(student => {
            const office = student.office || "Not assigned";
            officeCounts[office] = (officeCounts[office] || 0) + 1;
        });
        const officeBox = document.getElementById("officeSummaryList");
        if(officeBox){
            const rows = Object.entries(officeCounts).sort((a,b) => b[1] - a[1]);
            officeBox.innerHTML = rows.length ? rows.map(([office,count]) => `<div class="report-summary-item"><span>${pgmoReportSafe(office)}</span><strong>${count}</strong></div>`).join("") : `<div class="empty-state compact"><p>No office data yet.</p></div>`;
        }

        if(!list.length){
            tbody.innerHTML = typeof emptyRow === "function" ? emptyRow(7, "fa fa-chart-column", "No student summary found", "Try changing the name, course, office, or completion filter.") : "";
            return;
        }

        tbody.innerHTML = list.map(student => {
            const required = Number(student.required || 0);
            const completedHours = Number(student.completed || 0);
            const pct = required > 0 ? Math.min(100, Math.round((completedHours / required) * 100)) : 0;
            return `<tr>
                <td><strong>${pgmoReportSafe(student.name || "Unnamed Student")}</strong><br><small>${pgmoReportSafe(student.id || "-")} · ${pgmoReportSafe(student.email || "")}</small></td>
                <td>${pgmoReportSafe(student.school || "Not set")}</td>
                <td>${pgmoReportSafe(student.course || "-")}</td>
                <td>${pgmoReportSafe(student.office || "Not assigned")}</td>
                <td>${pgmoReportCompletionPill(student)}</td>
                <td>${completedHours} / ${required || "Not set"}</td>
                <td><div class="progress mini"><div class="progress-bar" style="width:${pct}%"></div></div><small>${pct}%</small></td>
            </tr>`;
        }).join("");
    }

    function pgmoLackingStudentRow(student){
        const summary = typeof pgmoAdminRequirementSummary === "function" ? pgmoAdminRequirementSummary(student) : {rows:[], lacking:0};
        const lackingRows = (summary.rows || []).filter(row => row.status !== "Approved");
        return {
            student,
            lackingRows,
            lackingCount: lackingRows.length,
            lackingText: lackingRows.map(row => `${row.name} (${row.status})`).join("; ")
        };
    }

    function pgmoLackingStudentKey(student){
        const source = student || {};
        return String(source.uuid || source.id || source.email || `${source.name || "student"}|${source.school || ""}|${source.course || ""}`);
    }

    function pgmoSyncLackingReportSelection(rows){
        const availableKeys = new Set((rows || []).map(row => pgmoLackingStudentKey(row.student)));

        // Keep only valid manual selections. Students are intentionally not
        // selected automatically, so the Excel file contains checked rows only.
        for(const key of [...pgmoLackingReportSelectedKeys]){
            if(!availableKeys.has(key)) pgmoLackingReportSelectedKeys.delete(key);
        }

        pgmoLackingReportKnownKeys = availableKeys;
    }

    function pgmoLackingStudentStatus(student){
        const raw = String(student?.status || "").trim();
        const normalized = raw.toLowerCase();
        if(normalized === "ongoing") return "Ongoing";
        if(normalized === "completed") return "Completed";
        if(normalized === "pending") return "Pending";
        return raw || "Not set";
    }

    function pgmoLackingStatusBadge(student){
        const label = pgmoLackingStudentStatus(student);
        const cls = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const icon = label === "Completed" ? "fa-flag-checkered" : label === "Ongoing" ? "fa-hourglass-half" : "fa-circle-info";
        return `<span class="pgmo-lacking-status-badge ${pgmoReportSafe(cls)}"><i class="fa ${icon}"></i> ${pgmoReportSafe(label)}</span>`;
    }

    function pgmoSelectedVisibleLackingRows(){
        return (pgmoLackingReportCache || []).filter(row => pgmoLackingReportSelectedKeys.has(pgmoLackingStudentKey(row.student)));
    }

    function pgmoSelectedLackingRows(){
        return (pgmoLackingReportAllRows || []).filter(row => pgmoLackingReportSelectedKeys.has(pgmoLackingStudentKey(row.student)));
    }

    function pgmoCaptureVisibleLackingSelections(){
        document.querySelectorAll(".pgmo-lacking-student-select").forEach(input => {
            const key = String(input.dataset.studentKey || "");
            if(!key) return;
            if(input.checked) pgmoLackingReportSelectedKeys.add(key);
            else pgmoLackingReportSelectedKeys.delete(key);
        });
    }

    function pgmoLackingRowsForExport(){
        // Read the actual checkbox state at click time so the Excel export
        // always matches what the admin can see and has checked in the UI.
        pgmoCaptureVisibleLackingSelections();
        const selectedRows = pgmoSelectedLackingRows();
        if(selectedRows.length){
            return {rows:selectedRows, selectedOnly:true};
        }

        // When no student is checked, export everyone in the current report
        // view so search, status, and office choices still apply.
        return {rows:[...(pgmoLackingReportCache || [])], selectedOnly:false};
    }

    function pgmoUpdateLackingSelectionControls(){
        const visibleRows = pgmoLackingReportCache || [];
        const selectedVisibleRows = pgmoSelectedVisibleLackingRows();
        const selectedRows = pgmoSelectedLackingRows();
        const count = document.getElementById("lackingReportSelectionCount");
        const selectAll = document.getElementById("lackingReportSelectAll");
        const downloadButton = document.getElementById("downloadLackingRequirementsButton");

        if(count){
            count.textContent = selectedRows.length
                ? `${selectedRows.length} selected · only checked students will be included`
                : `0 selected · all ${visibleRows.length} shown student${visibleRows.length === 1 ? "" : "s"} will be included`;
        }

        if(selectAll){
            selectAll.disabled = visibleRows.length === 0;
            selectAll.checked = visibleRows.length > 0 && selectedVisibleRows.length === visibleRows.length;
            selectAll.indeterminate = selectedVisibleRows.length > 0 && selectedVisibleRows.length < visibleRows.length;
        }

        if(downloadButton){
            const hasRowsToExport = selectedRows.length > 0 || visibleRows.length > 0;
            downloadButton.disabled = !hasRowsToExport;
            downloadButton.title = selectedRows.length
                ? `Download ${selectedRows.length} selected student${selectedRows.length === 1 ? "" : "s"}`
                : visibleRows.length
                    ? `Download all ${visibleRows.length} student${visibleRows.length === 1 ? "" : "s"} currently shown`
                    : "No students are available to export";
        }
    }

    function toggleLackingReportStudentSelection(studentKey, isSelected){
        const key = String(studentKey || "");
        if(!key) return;
        if(isSelected) pgmoLackingReportSelectedKeys.add(key);
        else pgmoLackingReportSelectedKeys.delete(key);

        document.querySelectorAll(".pgmo-lacking-student-select").forEach(input => {
            if(String(input.dataset.studentKey || "") === key){
                input.checked = !!isSelected;
                input.closest("tr")?.classList.toggle("pgmo-lacking-row-selected", !!isSelected);
            }
        });
        pgmoUpdateLackingSelectionControls();
    }

    function setLackingReportVisibleSelection(isSelected){
        (pgmoLackingReportCache || []).forEach(row => {
            const key = pgmoLackingStudentKey(row.student);
            if(isSelected) pgmoLackingReportSelectedKeys.add(key);
            else pgmoLackingReportSelectedKeys.delete(key);
        });

        document.querySelectorAll(".pgmo-lacking-student-select").forEach(input => {
            input.checked = !!isSelected;
            input.closest("tr")?.classList.toggle("pgmo-lacking-row-selected", !!isSelected);
        });
        pgmoUpdateLackingSelectionControls();
    }

    function resetLackingReportFilters(){
        const search = document.getElementById("lackingReportSearch");
        const status = document.getElementById("lackingReportStatusFilter");
        const office = document.getElementById("lackingReportOfficeFilter");
        if(search) search.value = "";
        if(status) status.value = "All";
        if(office) office.value = "All";
        renderLackingRequirementsReport();
    }

    function pgmoPopulateLackingOfficeFilter(rows){
        const select = document.getElementById("lackingReportOfficeFilter");
        if(!select) return;
        const current = select.value || "All";
        const values = [...new Set(rows.map(row => row.student.office || "Not assigned"))].filter(Boolean).sort((a,b) => a.localeCompare(b));
        select.innerHTML = `<option value="All">All Offices</option>` + values.map(value => `<option value="${pgmoReportSafe(value)}">${pgmoReportSafe(value)}</option>`).join("");
        select.value = values.includes(current) ? current : "All";
    }

    function pgmoLackingRequirementList(row){
        return row.lackingRows.map(item => {
            const status = String(item.status || "Missing");
            const cls = status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return `<li><span class="pgmo-lacking-requirement-name">${pgmoReportSafe(item.name)}</span><span class="pgmo-lacking-requirement-status ${pgmoReportSafe(cls)}">${pgmoReportSafe(status)}</span></li>`;
        }).join("");
    }

    function pgmoLackingGroupRows(rows){
        const groups = [
            {label:"Ongoing Students", status:"Ongoing", icon:"fa-hourglass-half", className:"ongoing"},
            {label:"Completed Students", status:"Completed", icon:"fa-flag-checkered", className:"completed"},
            {label:"Other Students", status:"Other", icon:"fa-users", className:"other"}
        ];

        return groups.map(group => {
            const groupRows = (rows || []).filter(row => {
                const status = pgmoLackingStudentStatus(row.student);
                return group.status === "Other" ? !["Ongoing", "Completed"].includes(status) : status === group.status;
            }).sort((a,b) => String(a.student?.name || "").localeCompare(String(b.student?.name || "")));

            if(!groupRows.length) return "";

            const heading = `<tr class="pgmo-lacking-group-row ${group.className}"><td colspan="7"><div><span><i class="fa ${group.icon}"></i> ${group.label}</span><strong>${groupRows.length}</strong></div></td></tr>`;
            const body = groupRows.map(row => {
                const s = row.student;
                const studentKey = pgmoLackingStudentKey(s);
                const selected = pgmoLackingReportSelectedKeys.has(studentKey);
                return `<tr class="pgmo-lacking-student-row ${selected ? "pgmo-lacking-row-selected" : ""}">
                    <td class="admin-lacking-select-column">
                        <input class="form-check-input pgmo-lacking-student-select" type="checkbox" data-student-key="${pgmoReportSafe(studentKey)}" ${selected ? "checked" : ""} aria-label="Include ${pgmoReportSafe(s.name || "student")} in Excel report" onchange="toggleLackingReportStudentSelection(this.dataset.studentKey, this.checked)">
                    </td>
                    <td><strong class="pgmo-lacking-student-name">${pgmoReportSafe(s.name || "Unnamed Student")}</strong><small class="pgmo-lacking-student-id">${pgmoReportSafe(s.id || "-")}</small></td>
                    <td>${pgmoLackingStatusBadge(s)}</td>
                    <td><span class="pgmo-lacking-school">${pgmoReportSafe(s.school || "Not set")}</span><small class="pgmo-lacking-course">${pgmoReportSafe(s.course || "-")}</small></td>
                    <td><span class="pgmo-lacking-office"><i class="fa fa-building"></i> ${pgmoReportSafe(s.office || "Not assigned")}</span></td>
                    <td><ul class="pgmo-lacking-list">${pgmoLackingRequirementList(row)}</ul></td>
                    <td class="text-center"><span class="pgmo-lacking-count-badge">${row.lackingCount}</span></td>
                </tr>`;
            }).join("");
            return heading + body;
        }).join("");
    }

    async function renderLackingRequirementsReport(){
        const tbody = document.getElementById("lackingRequirementsReportBody");
        if(!tbody) return;

        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state compact"><i class="fa fa-spinner fa-spin"></i><h5>Checking requirements...</h5><p>Please wait while the system checks uploaded documents and DTR records.</p></div></td></tr>`;

        const result = typeof fetchAdminStudents === "function" ? await fetchAdminStudents() : {students:[], error:"Student loader is missing."};
        if(result.error){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state compact"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load the report</h5><p>${pgmoReportSafe(result.error)}</p></div></td></tr>`;
            return;
        }

        if(typeof pgmoFetchAdminRequirementSources === "function"){
            await pgmoFetchAdminRequirementSources();
        }

        pgmoLackingReportStudentsCache = result.students || [];
        const allRows = pgmoLackingReportStudentsCache.map(pgmoLackingStudentRow);
        const lackingOnly = allRows.filter(row => row.lackingCount > 0);
        pgmoLackingReportAllRows = lackingOnly;
        pgmoSyncLackingReportSelection(lackingOnly);
        pgmoPopulateLackingOfficeFilter(lackingOnly);

        const search = (document.getElementById("lackingReportSearch")?.value || "").toLowerCase();
        const status = document.getElementById("lackingReportStatusFilter")?.value || "All";
        const office = document.getElementById("lackingReportOfficeFilter")?.value || "All";
        pgmoLackingReportCache = lackingOnly.filter(row => {
            const s = row.student;
            const studentStatus = pgmoLackingStudentStatus(s);
            const searchSource = [s.name, s.id, s.school, s.course, s.office, studentStatus, row.lackingText].join(" ").toLowerCase();
            return (!search || searchSource.includes(search))
                && (status === "All" || studentStatus === status)
                && (office === "All" || String(s.office || "Not assigned") === office);
        });

        const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value; };
        setText("lackingReportTotalStudents", pgmoLackingReportStudentsCache.length);
        setText("lackingReportStudents", lackingOnly.length);
        setText("lackingReportOngoingStudents", lackingOnly.filter(row => pgmoLackingStudentStatus(row.student) === "Ongoing").length);
        setText("lackingReportCompletedStudents", lackingOnly.filter(row => pgmoLackingStudentStatus(row.student) === "Completed").length);
        setText("lackingReportItems", pgmoLackingReportCache.reduce((sum, row) => sum + row.lackingCount, 0));

        if(!pgmoLackingReportCache.length){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state compact"><i class="fa fa-circle-check"></i><h5>No students found</h5><p>No students with lacking requirements match the current search, status, and office choices.</p></div></td></tr>`;
            pgmoUpdateLackingSelectionControls();
            return;
        }

        tbody.innerHTML = pgmoLackingGroupRows(pgmoLackingReportCache);
        pgmoUpdateLackingSelectionControls();
    }

    function pgmoCsvCell(value){
        return `"${String(value ?? "").replace(/\r?\n/g," ").replace(/"/g,'""')}"`;
    }

    function pgmoExcelArgb(hex){
        return String(hex || "").replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6).padStart(8, "F");
    }

    function pgmoExcelFill(hex){
        return {type:"pattern", pattern:"solid", fgColor:{argb:pgmoExcelArgb(hex)}};
    }

    function pgmoExcelBorder(hex = "94A3B8"){
        return {
            top:{style:"thin", color:{argb:pgmoExcelArgb(hex)}},
            left:{style:"thin", color:{argb:pgmoExcelArgb(hex)}},
            bottom:{style:"thin", color:{argb:pgmoExcelArgb(hex)}},
            right:{style:"thin", color:{argb:pgmoExcelArgb(hex)}}
        };
    }

    function pgmoDownloadExcelBuffer(buffer, filename){
        const blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function pgmoRequirementStatusForExport(student, requirementName){
        const summary = typeof pgmoAdminRequirementSummary === "function" ? pgmoAdminRequirementSummary(student) : {rows:[]};
        const row = (summary.rows || []).find(item => item.name === requirementName);
        return row ? String(row.status || "Missing") : "Missing";
    }

    function pgmoApplyStatusCellStyle(cell, status){
        const normalized = String(status || "Missing").toLowerCase();
        const styles = {
            approved: {fill:"D1FAE5", font:"065F46", label:"Approved"},
            pending: {fill:"FEF3C7", font:"92400E", label:"Pending"},
            returned: {fill:"FEE2E2", font:"991B1B", label:"Returned"},
            missing: {fill:"FEE2E2", font:"991B1B", label:"Missing"}
        };
        const style = styles[normalized] || styles.missing;
        cell.value = style.label;
        cell.fill = pgmoExcelFill(style.fill);
        cell.font = {name:"Segoe UI", size:10, bold:true, color:{argb:pgmoExcelArgb(style.font)}};
        cell.alignment = {horizontal:"center", vertical:"middle", wrapText:true};
        cell.border = pgmoExcelBorder("CBD5E1");
    }

    async function downloadLackingRequirementsReport(){
        if(!pgmoLackingReportAllRows.length){
            alert("Refresh the lacking requirements report first.");
            return;
        }

        const exportSelection = pgmoLackingRowsForExport();
        const selectedReportRows = exportSelection.rows;
        if(!selectedReportRows.length){
            alert("No students are available to include in the Excel report. Try changing the search, status, or office choices.");
            return;
        }

        if(typeof ExcelJS === "undefined"){
            alert("Excel generator is still loading. Please wait a moment, then try again.");
            return;
        }

        const requirementNames = (typeof PGMO_ADMIN_REQUIREMENT_GROUPS !== "undefined" ? PGMO_ADMIN_REQUIREMENT_GROUPS : [])
            .flatMap(group => group.items || []);

        if(!requirementNames.length){
            alert("Requirement list is missing. Please refresh the page and try again.");
            return;
        }

        const wb = new ExcelJS.Workbook();
        wb.creator = "PGMO OJT Student Portal";
        wb.created = new Date();
        wb.modified = new Date();
        wb.subject = exportSelection.selectedOnly
            ? `Lacking requirements for ${selectedReportRows.length} selected student${selectedReportRows.length === 1 ? "" : "s"}`
            : `Lacking requirements for all ${selectedReportRows.length} students currently shown`;

        const sheet = wb.addWorksheet("Missing Requirements", {
            properties:{defaultRowHeight:28},
            pageSetup:{
                paperSize:9,
                orientation:"landscape",
                fitToPage:true,
                fitToWidth:1,
                fitToHeight:0,
                horizontalCentered:true,
                verticalCentered:false,
                pageOrder:"overThenDown",
                showGridLines:false,
                showRowColHeaders:false,
                margins:{left:0.25, right:0.25, top:0.55, bottom:0.55, header:0.2, footer:0.25}
            }
        });

        const headers = ["Student Name", "Student Status", ...requirementNames];
        sheet.addRow(headers);

        const headerRow = sheet.getRow(1);
        headerRow.height = 46;
        headerRow.eachCell((cell, colNumber) => {
            cell.fill = pgmoExcelFill("174F6D");
            cell.font = {name:"Segoe UI", bold:true, size:11, color:{argb:"FFFFFFFF"}};
            cell.alignment = {horizontal: colNumber === 1 ? "left" : "center", vertical:"middle", wrapText:true};
            cell.border = pgmoExcelBorder("0F3448");
        });

        selectedReportRows.forEach(reportRow => {
            const student = reportRow.student || {};
            const rowValues = [student.name || "Unnamed Student", pgmoLackingStudentStatus(student), ...requirementNames.map(name => pgmoRequirementStatusForExport(student, name))];
            const row = sheet.addRow(rowValues);
            row.height = 30;
            row.getCell(1).font = {name:"Segoe UI", size:10, bold:true, color:{argb:pgmoExcelArgb("111827")}};
            row.getCell(1).alignment = {horizontal:"left", vertical:"middle", wrapText:true};
            row.getCell(1).border = pgmoExcelBorder("CBD5E1");
            row.getCell(1).fill = pgmoExcelFill(row.number % 2 === 0 ? "F8FAFC" : "FFFFFF");

            const studentStatus = pgmoLackingStudentStatus(student);
            const statusCell = row.getCell(2);
            statusCell.value = studentStatus;
            statusCell.font = {name:"Segoe UI", size:10, bold:true, color:{argb:pgmoExcelArgb(studentStatus === "Completed" ? "1D4ED8" : studentStatus === "Ongoing" ? "166534" : "475569")}};
            statusCell.fill = pgmoExcelFill(studentStatus === "Completed" ? "DBEAFE" : studentStatus === "Ongoing" ? "DCFCE7" : "F1F5F9");
            statusCell.alignment = {horizontal:"center", vertical:"middle", wrapText:true};
            statusCell.border = pgmoExcelBorder("CBD5E1");

            requirementNames.forEach((name, index) => {
                const cell = row.getCell(index + 3);
                pgmoApplyStatusCellStyle(cell, cell.value);
            });
        });

        sheet.columns.forEach((column, index) => {
            column.width = index === 0 ? 28 : index === 1 ? 15 : 18;
        });

        sheet.views = [{state:"frozen", ySplit:1, xSplit:1}];
        sheet.autoFilter = {
            from:{row:1, column:1},
            to:{row:1, column:headers.length}
        };

        const legendStartRow = sheet.rowCount + 3;
        sheet.getCell(`A${legendStartRow}`).value = "Legend";
        sheet.getCell(`A${legendStartRow}`).font = {name:"Segoe UI", bold:true, size:11, color:{argb:pgmoExcelArgb("111827")}};
        [
            ["Approved", "Approved / already complete", "D1FAE5", "065F46"],
            ["Pending", "Uploaded but waiting for admin approval", "FEF3C7", "92400E"],
            ["Returned", "Returned by admin for correction", "FEE2E2", "991B1B"],
            ["Missing", "No approved requirement yet", "FEE2E2", "991B1B"]
        ].forEach((item, idx) => {
            const row = sheet.getRow(legendStartRow + 1 + idx);
            row.getCell(1).value = item[0];
            row.getCell(2).value = item[1];
            row.getCell(1).fill = pgmoExcelFill(item[2]);
            row.getCell(1).font = {name:"Segoe UI", bold:true, color:{argb:pgmoExcelArgb(item[3])}};
            row.getCell(1).alignment = {horizontal:"center", vertical:"middle"};
            row.getCell(2).font = {name:"Segoe UI", color:{argb:pgmoExcelArgb("475569")}};
            row.getCell(1).border = pgmoExcelBorder("CBD5E1");
            row.getCell(2).border = pgmoExcelBorder("CBD5E1");
        });

        /* Compact signature areas: reviewed block centered, acknowledged block at the right. */
        const signatureBlockWidth = Math.min(3, Math.max(2, Math.floor(headers.length / 5)));
        const reviewedStartColumn = Math.max(1, Math.round((headers.length - signatureBlockWidth + 1) / 2));
        const reviewedEndColumn = Math.min(headers.length, reviewedStartColumn + signatureBlockWidth - 1);
        const acknowledgedEndColumn = Math.max(reviewedEndColumn + 2, headers.length - 1);
        const acknowledgedStartColumn = Math.max(reviewedEndColumn + 2, acknowledgedEndColumn - signatureBlockWidth + 1);
        const signatureLabelRow = legendStartRow + 7;
        const signatureLineRow = signatureLabelRow + 2;
        const signatureNameRow = signatureLineRow + 1;

        function addSignatureBlock(startColumn, endColumn, label, printedName){
            sheet.mergeCells(signatureLabelRow, startColumn, signatureLabelRow, endColumn);
            const labelCell = sheet.getCell(signatureLabelRow, startColumn);
            labelCell.value = label;
            labelCell.font = {name:"Segoe UI", size:8, bold:true, color:{argb:pgmoExcelArgb("111827")}};
            labelCell.alignment = {horizontal:"center", vertical:"middle"};

            sheet.mergeCells(signatureLineRow, startColumn, signatureLineRow, endColumn);
            const lineCell = sheet.getCell(signatureLineRow, startColumn);
            lineCell.border = {bottom:{style:"thin", color:{argb:pgmoExcelArgb("111827")}}};

            sheet.mergeCells(signatureNameRow, startColumn, signatureNameRow, endColumn);
            const nameCell = sheet.getCell(signatureNameRow, startColumn);
            nameCell.value = printedName;
            nameCell.font = {name:"Segoe UI", size:8, bold:true, color:{argb:pgmoExcelArgb("111827")}};
            nameCell.alignment = {horizontal:"center", vertical:"top", wrapText:false, shrinkToFit:true};
        }

        addSignatureBlock(
            reviewedStartColumn,
            reviewedEndColumn,
            "Reviewed and signed by:",
            "MS. KATHERINE S. LABIAL, LPT"
        );
        addSignatureBlock(
            acknowledgedStartColumn,
            acknowledgedEndColumn,
            "Acknowledged by:",
            "MR. LOUIE GIE LUSDOC."
        );

        sheet.getRow(signatureLabelRow).height = 18;
        sheet.getRow(signatureLabelRow + 1).height = 14;
        sheet.getRow(signatureLineRow).height = 10;
        sheet.getRow(signatureNameRow).height = 18;

        function pgmoExcelColumnLetter(columnNumber){
            let value = Number(columnNumber) || 1;
            let letters = "";
            while(value > 0){
                const remainder = (value - 1) % 26;
                letters = String.fromCharCode(65 + remainder) + letters;
                value = Math.floor((value - 1) / 26);
            }
            return letters;
        }

        const finalPrintColumn = pgmoExcelColumnLetter(headers.length);
        sheet.pageSetup.printArea = `A1:${finalPrintColumn}${signatureNameRow}`;
        sheet.pageSetup.printTitlesRow = "1:1";
        sheet.headerFooter = {
            differentFirst:false,
            differentOddEven:false,
            oddHeader:'&L&"Segoe UI,Bold"PGMO Missing Requirements Report&R&D',
            oddFooter:"&LPGMO OJT Student Portal&CPage &P of &N&RConfidential"
        };

        const buffer = await wb.xlsx.writeBuffer();
        pgmoDownloadExcelBuffer(buffer, `PGMO_Missing_Requirements_${new Date().toISOString().slice(0,10)}.xlsx`);
    }

    window.getFilteredReportStudents = getFilteredReportStudents;
    window.renderReports = renderReports;
    window.renderLackingRequirementsReport = renderLackingRequirementsReport;
    window.downloadLackingRequirementsReport = downloadLackingRequirementsReport;
    window.toggleLackingReportStudentSelection = toggleLackingReportStudentSelection;
    window.setLackingReportVisibleSelection = setLackingReportVisibleSelection;
    window.resetLackingReportFilters = resetLackingReportFilters;

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page === "reports"){
            setTimeout(renderReports, 150);
        }
    });
})();

/* Ensure old inline handlers and report exporters use the patched report filter. */
try{
    if(window.renderReports) renderReports = window.renderReports;
    if(window.getFilteredReportStudents) getFilteredReportStudents = window.getFilteredReportStudents;
}catch(pgmoReportBindingError){
    console.warn("PGMO report binding warning:", pgmoReportBindingError?.message || pgmoReportBindingError);
}

/* PGMO PATCH 2026-07-02: Admin school/course/office filtered report summaries */
(function(){
    "use strict";

    let pgmoAdminReportStudents = [];

    function text(value){
        if(typeof safeText === "function") return safeText(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function plain(value, fallback){
        const raw = String(value ?? "").trim();
        return raw || fallback || "Not set";
    }

    function schoolOf(student){ return plain(student?.school, "Not set"); }
    function courseOf(student){ return plain(student?.course, "Not set"); }
    function officeOf(student){ return plain(student?.office, "Not assigned"); }

    function isCompleted(student){
        const required = Number(student?.required || 0);
        const completed = Number(student?.completed || 0);
        return String(student?.status || "").toLowerCase() === "completed" || (required > 0 && completed >= required);
    }

    function completionLabel(student){
        return isCompleted(student) ? "Completed" : "Ongoing";
    }

    function statusPill(student){
        const label = completionLabel(student);
        const cls = label === "Completed" ? "completed" : "ongoing";
        const icon = label === "Completed" ? "fa-check" : "fa-clock";
        return `<span class="pgmo-completion-pill ${cls}"><i class="fa ${icon}"></i> ${label}</span>`;
    }

    function uniqueValues(students, getter){
        return [...new Set((students || []).map(getter).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    }

    function fillSelect(id, values, allLabel){
        const select = document.getElementById(id);
        if(!select) return;
        const current = select.value || "All";
        select.innerHTML = `<option value="All">${text(allLabel)}</option>` + values.map(value => `<option value="${text(value)}">${text(value)}</option>`).join("");
        select.value = values.includes(current) ? current : "All";
    }

    function populateFilters(students){
        fillSelect("reportSchoolFilter", uniqueValues(students, schoolOf), "All Schools");
        fillSelect("reportCourseFilter", uniqueValues(students, courseOf), "All Courses");
        fillSelect("reportOfficeFilter", uniqueValues(students, officeOf), "All Offices");
    }

    function currentFilters(){
        return {
            search: (document.getElementById("reportSearch")?.value || "").trim(),
            school: document.getElementById("reportSchoolFilter")?.value || "All",
            course: document.getElementById("reportCourseFilter")?.value || "All",
            office: document.getElementById("reportOfficeFilter")?.value || "All",
            completion: document.getElementById("reportCompletionFilter")?.value || "All"
        };
    }

    function getFilteredStudents(){
        const filters = currentFilters();
        const search = filters.search.toLowerCase();
        return pgmoAdminReportStudents.filter(student => {
            const source = [
                student.name,
                student.id,
                student.email,
                schoolOf(student),
                courseOf(student),
                officeOf(student),
                completionLabel(student),
                student.status
            ].join(" ").toLowerCase();

            return (!search || source.includes(search))
                && (filters.school === "All" || schoolOf(student) === filters.school)
                && (filters.course === "All" || courseOf(student) === filters.course)
                && (filters.office === "All" || officeOf(student) === filters.office)
                && (filters.completion === "All" || completionLabel(student) === filters.completion);
        });
    }

    function setText(id, value){
        const el = document.getElementById(id);
        if(el) el.textContent = value;
    }

    function emptyTableRow(colspan, title, subtitle){
        return `<tr><td colspan="${colspan}"><div class="empty-state compact"><i class="fa fa-chart-column"></i><h5>${text(title)}</h5><p>${text(subtitle)}</p></div></td></tr>`;
    }

    function groupBy(list, keyFn){
        const map = new Map();
        list.forEach(item => {
            const key = keyFn(item);
            if(!map.has(key)) map.set(key, []);
            map.get(key).push(item);
        });
        return [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]));
    }

    function groupByTwo(list, firstFn, secondFn){
        const map = new Map();
        list.forEach(item => {
            const key = `${firstFn(item)}|||${secondFn(item)}`;
            if(!map.has(key)) map.set(key, {first:firstFn(item), second:secondFn(item), items:[]});
            map.get(key).items.push(item);
        });
        return [...map.values()].sort((a,b) => a.first.localeCompare(b.first) || a.second.localeCompare(b.second));
    }

    function summaryNumbers(items){
        const completed = items.filter(isCompleted).length;
        return {
            total: items.length,
            completed,
            ongoing: items.length - completed
        };
    }

    function renderAppliedFilters(list){
        const box = document.getElementById("reportAppliedFilters");
        if(!box) return;
        const filters = currentFilters();
        const chips = [
            ["Name/Search", filters.search || "All"],
            ["School", filters.school],
            ["Course", filters.course],
            ["Office", filters.office],
            ["Completion", filters.completion]
        ];
        box.innerHTML = `
            <div class="pgmo-filter-summary-title"><i class="fa fa-filter"></i> Applied filters in this report: <strong>${list.length}</strong> student(s)</div>
            <div class="pgmo-filter-chip-row">
                ${chips.map(([label, value]) => `<span class="pgmo-filter-chip"><strong>${text(label)}:</strong> ${text(value)}</span>`).join("")}
            </div>
        `;
    }

    function renderMetricCards(list){
        const completed = list.filter(isCompleted).length;
        const ongoing = list.length - completed;
        setText("reportStudents", list.length);
        setText("reportSchoolCount", uniqueValues(list, schoolOf).length);
        setText("reportCourseCount", uniqueValues(list, courseOf).length);
        setText("reportOfficeCount", uniqueValues(list, officeOf).length);
        setText("reportCompleted", completed);
        setText("reportOngoing", ongoing);
        setText("reportNotCompleted", ongoing);
        setText("reportActive", ongoing);

        if(typeof setBar === "function"){
            setBar("ongoingBar", "ongoingLabel", ongoing, list.length);
            setBar("completedBar", "completedLabel", completed, list.length);
        }
    }

    function renderOfficeSummary(list){
        const box = document.getElementById("officeSummaryList");
        if(!box) return;
        const rows = groupBy(list, officeOf).map(([office, items]) => ({office, total: items.length})).sort((a,b) => b.total - a.total || a.office.localeCompare(b.office));
        box.innerHTML = rows.length
            ? rows.map(row => `<div class="report-summary-item"><span>${text(row.office)}</span><strong>${row.total}</strong></div>`).join("")
            : `<div class="empty-state compact"><p>No office data matches the filters.</p></div>`;
    }

    function renderEveryoneBySchool(list){
        const body = document.getElementById("reportEveryoneSummaryBody");
        if(!body) return;
        const rows = groupBy(list, schoolOf).map(([school, items]) => {
            const nums = summaryNumbers(items);
            return {
                school,
                offices: uniqueValues(items, officeOf).length,
                ...nums
            };
        });
        body.innerHTML = rows.length ? rows.map(row => `<tr>
            <td><strong>${text(row.school)}</strong></td>
            <td>${row.total}</td>
            <td>${row.offices}</td>
            <td>${row.completed}</td>
            <td>${row.ongoing}</td>
        </tr>`).join("") : emptyTableRow(5, "No school summary found", "Try changing the report filters.");
    }

    function renderSchoolOfficeSummary(list){
        const body = document.getElementById("reportSchoolOfficeSummaryBody");
        if(!body) return;
        const rows = groupByTwo(list, schoolOf, officeOf).map(row => ({
            school: row.first,
            office: row.second,
            ...summaryNumbers(row.items)
        }));
        body.innerHTML = rows.length ? rows.map(row => `<tr>
            <td><strong>${text(row.school)}</strong></td>
            <td>${text(row.office)}</td>
            <td>${row.total}</td>
            <td>${row.completed}</td>
            <td>${row.ongoing}</td>
        </tr>`).join("") : emptyTableRow(5, "No school and office summary found", "Try changing the report filters.");
    }

    function renderStudentsBySchool(list){
        const body = document.getElementById("reportSchoolSummaryBody");
        if(!body) return;
        const rows = groupBy(list, schoolOf).map(([school, items]) => ({school, total: items.length}));
        body.innerHTML = rows.length ? rows.map(row => `<tr><td><strong>${text(row.school)}</strong></td><td>${row.total}</td></tr>`).join("") : emptyTableRow(2, "No students by school found", "Try changing the report filters.");
    }

    function renderCompletionBySchool(list){
        const body = document.getElementById("reportSchoolStatusSummaryBody");
        if(!body) return;
        const rows = groupBy(list, schoolOf).map(([school, items]) => ({school, ...summaryNumbers(items)}));
        body.innerHTML = rows.length ? rows.map(row => `<tr>
            <td><strong>${text(row.school)}</strong></td>
            <td>${row.completed}</td>
            <td>${row.ongoing}</td>
            <td>${row.total}</td>
        </tr>`).join("") : emptyTableRow(4, "No completion summary found", "Try changing the report filters.");
    }

    function renderStudentDetails(list){
        const body = document.getElementById("reportsTableBody");
        if(!body) return;
        if(!list.length){
            body.innerHTML = emptyTableRow(7, "No student details found", "Try changing the report filters.");
            return;
        }
        body.innerHTML = list.map(student => {
            const required = Number(student.required || 0);
            const completedHours = Number(student.completed || 0);
            const pct = required > 0 ? Math.min(100, Math.round((completedHours / required) * 100)) : 0;
            return `<tr>
                <td><strong>${text(student.name || "Unnamed Student")}</strong><br><small>${text(student.id || "-")} · ${text(student.email || "")}</small></td>
                <td>${text(schoolOf(student))}</td>
                <td>${text(courseOf(student))}</td>
                <td>${text(officeOf(student))}</td>
                <td>${statusPill(student)}</td>
                <td>${completedHours} / ${required || "Not set"}</td>
                <td><div class="progress mini"><div class="progress-bar" style="width:${pct}%"></div></div><small>${pct}%</small></td>
            </tr>`;
        }).join("");
    }

    async function renderAdminReports(){
        const detailBody = document.getElementById("reportsTableBody");
        if(!detailBody) return;

        detailBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading reports...</h5><p>Fetching student records.</p></div></td></tr>`;

        const result = typeof fetchAdminStudents === "function" ? await fetchAdminStudents() : {students:[], error:"Student loader is missing."};
        if(result.error){
            const errorRow = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load reports</h5><p>${text(result.error)}</p></div></td></tr>`;
            detailBody.innerHTML = errorRow;
            ["reportEveryoneSummaryBody", "reportSchoolOfficeSummaryBody", "reportSchoolSummaryBody", "reportSchoolStatusSummaryBody"].forEach(id => {
                const body = document.getElementById(id);
                if(body) body.innerHTML = errorRow;
            });
            return;
        }

        pgmoAdminReportStudents = result.students || [];
        window.reportStudentsCache = pgmoAdminReportStudents;
        populateFilters(pgmoAdminReportStudents);

        const list = getFilteredStudents();
        renderAppliedFilters(list);
        renderMetricCards(list);
        renderOfficeSummary(list);
        renderEveryoneBySchool(list);
        renderSchoolOfficeSummary(list);
        renderStudentsBySchool(list);
        renderCompletionBySchool(list);
        renderStudentDetails(list);
    }

    function resetAdminReportFilters(){
        const ids = ["reportSearch", "reportSchoolFilter", "reportCourseFilter", "reportOfficeFilter", "reportCompletionFilter"];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if(!el) return;
            if(el.tagName === "SELECT") el.value = "All";
            else el.value = "";
        });
        renderAdminReports();
    }

    function aoaFromGroupBySchool(list){
        const rows = [["School", "Total Students", "Offices Represented", "Completed", "Ongoing"]];
        groupBy(list, schoolOf).forEach(([school, items]) => {
            const nums = summaryNumbers(items);
            rows.push([school, nums.total, uniqueValues(items, officeOf).length, nums.completed, nums.ongoing]);
        });
        return rows;
    }

    function aoaSchoolOffice(list){
        const rows = [["School", "Office Assigned", "Total Students", "Completed", "Ongoing"]];
        groupByTwo(list, schoolOf, officeOf).forEach(row => {
            const nums = summaryNumbers(row.items);
            rows.push([row.first, row.second, nums.total, nums.completed, nums.ongoing]);
        });
        return rows;
    }

    function aoaStudentsBySchool(list){
        const rows = [["School", "Total Students"]];
        groupBy(list, schoolOf).forEach(([school, items]) => rows.push([school, items.length]));
        return rows;
    }

    function aoaCompletionBySchool(list){
        const rows = [["School", "Completed", "Ongoing", "Total"]];
        groupBy(list, schoolOf).forEach(([school, items]) => {
            const nums = summaryNumbers(items);
            rows.push([school, nums.completed, nums.ongoing, nums.total]);
        });
        return rows;
    }

    function aoaStudentDetails(list){
        const rows = [["Student Name", "Student ID", "Email", "School", "Course", "Office Assigned", "Completion", "Completed Hours", "Required Hours", "Progress %"]];
        list.forEach(student => {
            const required = Number(student.required || 0);
            const completedHours = Number(student.completed || 0);
            const pct = required > 0 ? Math.min(100, Math.round((completedHours / required) * 100)) : 0;
            rows.push([student.name || "", student.id || "", student.email || "", schoolOf(student), courseOf(student), officeOf(student), completionLabel(student), completedHours, required || "Not set", pct]);
        });
        return rows;
    }

    function buildFilterSheetRows(list){
        const f = currentFilters();
        return [
            ["PGMO Admin Total Student Report"],
            ["Generated", new Date().toLocaleString()],
            ["Total Students", list.length],
            [],
            ["Applied Filters"],
            ["Name/Search", f.search || "All"],
            ["School", f.school],
            ["Course", f.course],
            ["Office", f.office],
            ["Completion", f.completion]
        ];
    }

    const PGMO_REPORT_THEME = {
        green:"064E3B",
        green2:"15803D",
        green3:"DCFCE7",
        lightGreen:"ECFDF5",
        gold:"F59E0B",
        goldSoft:"FEF3C7",
        red:"DC2626",
        redSoft:"FEE2E2",
        blue:"2563EB",
        blueSoft:"DBEAFE",
        dark:"111827",
        muted:"64748B",
        border:"D1D5DB",
        white:"FFFFFF",
        gray:"F8FAFC"
    };

    function reportPercentValue(student){
        const required = Number(student?.required || 0);
        const completedHours = Number(student?.completed || 0);
        return required > 0 ? Math.min(1, completedHours / required) : 0;
    }

    function reportCompletionRate(items){
        return items.length ? items.filter(isCompleted).length / items.length : 0;
    }

    function reportOfficeSummaryRows(list){
        return groupBy(list, officeOf).map(([office, items]) => {
            const nums = summaryNumbers(items);
            return {
                office,
                total:nums.total,
                completed:nums.completed,
                ongoing:nums.ongoing,
                rate:reportCompletionRate(items)
            };
        }).sort((a,b) => b.total - a.total || a.office.localeCompare(b.office));
    }

    function reportDownloadBuffer(buffer, filename){
        const blob = new Blob([buffer], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function reportFileDate(){
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function reportSafeSheetName(value){
        return String(value || "Sheet").replace(/[\/*?:\[\]]/g, "").slice(0, 31) || "Sheet";
    }

    function reportSetSheetBase(sheet, tabColor = PGMO_REPORT_THEME.green){
        sheet.properties.defaultRowHeight = 20;
        sheet.properties.tabColor = {argb:`FF${tabColor}`};
        sheet.pageSetup = {
            paperSize:9,
            orientation:"landscape",
            fitToPage:true,
            fitToWidth:1,
            fitToHeight:0,
            margins:{left:0.25, right:0.25, top:0.45, bottom:0.45, header:0.2, footer:0.2}
        };
        sheet.views = [{state:"frozen", ySplit:4}];
    }

    function reportTitle(sheet, title, subtitle, lastColumnNumber){
        const end = sheet.getColumn(lastColumnNumber).letter;
        sheet.mergeCells(`A1:${end}1`);
        sheet.getCell("A1").value = title;
        sheet.getCell("A1").font = {name:"Segoe UI", size:18, bold:true, color:{argb:`FF${PGMO_REPORT_THEME.white}`}};
        sheet.getCell("A1").fill = {type:"pattern", pattern:"solid", fgColor:{argb:`FF${PGMO_REPORT_THEME.green}`}};
        sheet.getCell("A1").alignment = {vertical:"middle", horizontal:"center"};
        sheet.getRow(1).height = 32;

        sheet.mergeCells(`A2:${end}2`);
        sheet.getCell("A2").value = subtitle;
        sheet.getCell("A2").font = {name:"Segoe UI", size:11, italic:true, color:{argb:`FF${PGMO_REPORT_THEME.muted}`}};
        sheet.getCell("A2").alignment = {vertical:"middle", horizontal:"center"};
        sheet.getRow(2).height = 22;
    }

    function reportHeaderCell(cell){
        cell.font = {name:"Segoe UI", size:10, bold:true, color:{argb:`FF${PGMO_REPORT_THEME.white}`}};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:`FF${PGMO_REPORT_THEME.green2}`}};
        cell.alignment = {vertical:"middle", horizontal:"center", wrapText:true};
        cell.border = {
            top:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.green}`}},
            left:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.green}`}},
            bottom:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.green}`}},
            right:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.green}`}}
        };
    }

    function reportBodyCell(cell, rowIndex){
        cell.font = {name:"Segoe UI", size:10, color:{argb:`FF${PGMO_REPORT_THEME.dark}`}};
        cell.alignment = {vertical:"middle", wrapText:true};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb: rowIndex % 2 === 0 ? `FF${PGMO_REPORT_THEME.white}` : `FF${PGMO_REPORT_THEME.gray}`}};
        cell.border = {
            top:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.border}`}},
            left:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.border}`}},
            bottom:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.border}`}},
            right:{style:"thin", color:{argb:`FF${PGMO_REPORT_THEME.border}`}}
        };
    }

    function reportStyleTable(sheet, headerRowNumber, lastColumnNumber, lastRowNumber){
        const headerRow = sheet.getRow(headerRowNumber);
        for(let col = 1; col <= lastColumnNumber; col++){
            reportHeaderCell(headerRow.getCell(col));
        }
        headerRow.height = 26;

        for(let row = headerRowNumber + 1; row <= lastRowNumber; row++){
            const current = sheet.getRow(row);
            for(let col = 1; col <= lastColumnNumber; col++){
                reportBodyCell(current.getCell(col), row);
            }
        }

        sheet.autoFilter = {
            from:{row:headerRowNumber, column:1},
            to:{row:Math.max(headerRowNumber, lastRowNumber), column:lastColumnNumber}
        };
    }

    function reportSetWidths(sheet, widths){
        widths.forEach((width, index) => {
            sheet.getColumn(index + 1).width = width;
        });
    }

    function reportAddTableRows(sheet, headerRowNumber, headers, rows, widths){
        const headerRow = sheet.getRow(headerRowNumber);
        headers.forEach((header, index) => headerRow.getCell(index + 1).value = header);
        rows.forEach((row, index) => {
            const excelRow = sheet.getRow(headerRowNumber + 1 + index);
            row.forEach((value, colIndex) => excelRow.getCell(colIndex + 1).value = value);
        });
        reportStyleTable(sheet, headerRowNumber, headers.length, headerRowNumber + rows.length);
        reportSetWidths(sheet, widths);
    }

    function reportStyleStatusCell(cell, value){
        const isDone = String(value || "").toLowerCase() === "completed";
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:`FF${isDone ? PGMO_REPORT_THEME.green3 : PGMO_REPORT_THEME.goldSoft}`}};
        cell.font = {name:"Segoe UI", size:10, bold:true, color:{argb:`FF${isDone ? PGMO_REPORT_THEME.green : PGMO_REPORT_THEME.gold}`}};
        cell.alignment = {vertical:"middle", horizontal:"center"};
    }

    function reportStylePercentCell(cell){
        const value = Number(cell.value || 0);
        cell.numFmt = "0%";
        cell.alignment = {vertical:"middle", horizontal:"center"};
        cell.font = {name:"Segoe UI", size:10, bold:true, color:{argb:`FF${value >= 1 ? PGMO_REPORT_THEME.green : value >= .5 ? PGMO_REPORT_THEME.blue : PGMO_REPORT_THEME.gold}`}};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:`FF${value >= 1 ? PGMO_REPORT_THEME.green3 : value >= .5 ? PGMO_REPORT_THEME.blueSoft : PGMO_REPORT_THEME.goldSoft}`}};
    }

    function reportAddKpiCard(sheet, cellAddress, label, value, color){
        const cell = sheet.getCell(cellAddress);
        cell.value = `${label}
${value}`;
        cell.font = {name:"Segoe UI", size:12, bold:true, color:{argb:`FF${PGMO_REPORT_THEME.white}`}};
        cell.fill = {type:"pattern", pattern:"solid", fgColor:{argb:`FF${color}`}};
        cell.alignment = {vertical:"middle", horizontal:"center", wrapText:true};
        cell.border = {
            top:{style:"thin", color:{argb:`FF${color}`}},
            left:{style:"thin", color:{argb:`FF${color}`}},
            bottom:{style:"thin", color:{argb:`FF${color}`}},
            right:{style:"thin", color:{argb:`FF${color}`}}
        };
    }

    function reportBuildSummarySheet(wb, list){
        const sheet = wb.addWorksheet("Report Summary");
        reportSetSheetBase(sheet, PGMO_REPORT_THEME.green);
        reportTitle(sheet, "PGMO OJT / Work Immersion Student Report", `Generated ${new Date().toLocaleString()} • Filtered export from Admin Reports`, 8);
        reportSetWidths(sheet, [22, 18, 18, 18, 18, 18, 18, 18]);

        const filters = currentFilters();
        sheet.getCell("A4").value = "Applied Filters";
        sheet.getCell("A4").font = {name:"Segoe UI", size:13, bold:true, color:{argb:`FF${PGMO_REPORT_THEME.green}`}};
        const filterRows = [
            ["Name/Search", filters.search || "All"],
            ["School", filters.school],
            ["Course", filters.course],
            ["Office", filters.office],
            ["Completion", filters.completion]
        ];
        filterRows.forEach((row, index) => {
            const r = 5 + index;
            sheet.getCell(r, 1).value = row[0];
            sheet.getCell(r, 2).value = row[1];
            sheet.getCell(r, 1).font = {bold:true, color:{argb:`FF${PGMO_REPORT_THEME.dark}`}};
            sheet.getCell(r, 2).font = {color:{argb:`FF${PGMO_REPORT_THEME.muted}`}};
        });

        const completed = list.filter(isCompleted).length;
        const ongoing = list.length - completed;
        const rate = `${Math.round(reportCompletionRate(list) * 100)}%`;
        ["A12:B14", "C12:D14", "E12:F14", "G12:H14", "A16:B18", "C16:D18", "E16:F18", "G16:H18"].forEach(range => sheet.mergeCells(range));
        reportAddKpiCard(sheet, "A12", "Total Students", list.length, PGMO_REPORT_THEME.green);
        reportAddKpiCard(sheet, "C12", "Schools", uniqueValues(list, schoolOf).length, PGMO_REPORT_THEME.green2);
        reportAddKpiCard(sheet, "E12", "Courses", uniqueValues(list, courseOf).length, PGMO_REPORT_THEME.blue);
        reportAddKpiCard(sheet, "G12", "Offices", uniqueValues(list, officeOf).length, PGMO_REPORT_THEME.gold);
        reportAddKpiCard(sheet, "A16", "Completed", completed, PGMO_REPORT_THEME.green2);
        reportAddKpiCard(sheet, "C16", "Ongoing", ongoing, PGMO_REPORT_THEME.gold);
        reportAddKpiCard(sheet, "E16", "Completion Rate", rate, PGMO_REPORT_THEME.green);
        reportAddKpiCard(sheet, "G16", "Required Hours Set", list.filter(s => Number(s.required || 0) > 0).length, PGMO_REPORT_THEME.blue);
        [12,13,14,16,17,18].forEach(r => sheet.getRow(r).height = 24);

        sheet.getCell("A21").value = "Office Summary";
        sheet.getCell("A21").font = {name:"Segoe UI", size:13, bold:true, color:{argb:`FF${PGMO_REPORT_THEME.green}`}};
        const officeRows = reportOfficeSummaryRows(list).map(row => [row.office, row.total, row.completed, row.ongoing, row.rate]);
        reportAddTableRows(sheet, 22, ["Office Assigned", "Total", "Completed", "Ongoing", "Completion Rate"], officeRows, [32, 12, 14, 14, 16]);
        for(let r = 23; r <= 22 + officeRows.length; r++) reportStylePercentCell(sheet.getCell(r, 5));
        return sheet;
    }

    function reportBuildStudentDetailsSheet(wb, list){
        const sheet = wb.addWorksheet("Student Details");
        reportSetSheetBase(sheet, PGMO_REPORT_THEME.blue);
        reportTitle(sheet, "Student Detail Report", "Detailed student list based on current Admin Reports filters", 14);
        const rows = list.map(student => {
            const required = Number(student.required || 0);
            const completedHours = Number(student.completed || 0);
            const remaining = required > 0 ? Math.max(0, required - completedHours) : "Not set";
            return [
                student.name || "Unnamed Student",
                student.id || "",
                student.gender || "",
                student.email || "",
                student.phone || "",
                schoolOf(student),
                courseOf(student),
                officeOf(student),
                student.accountStatus || "Active",
                completionLabel(student),
                completedHours,
                required || "Not set",
                remaining,
                reportPercentValue(student)
            ];
        });
        reportAddTableRows(sheet, 4, ["Student Name", "Student ID", "Gender", "Email", "Contact Number", "School", "Course", "Office Assigned", "Account Status", "Completion", "Completed Hours", "Required Hours", "Remaining Hours", "Progress"], rows, [28, 18, 12, 30, 18, 34, 28, 30, 15, 15, 16, 16, 16, 14]);
        for(let r = 5; r <= 4 + rows.length; r++){
            reportStyleStatusCell(sheet.getCell(r, 10), sheet.getCell(r, 10).value);
            reportStylePercentCell(sheet.getCell(r, 14));
        }
        return sheet;
    }

    function reportBuildSchoolSummarySheet(wb, list){
        const sheet = wb.addWorksheet("School Summary");
        reportSetSheetBase(sheet, PGMO_REPORT_THEME.green2);
        reportTitle(sheet, "Summary by School", "Grouped totals, represented offices, and completion status", 7);
        const rows = groupBy(list, schoolOf).map(([school, items]) => {
            const nums = summaryNumbers(items);
            return [school, nums.total, uniqueValues(items, officeOf).length, nums.completed, nums.ongoing, reportCompletionRate(items), uniqueValues(items, courseOf).join(", ")];
        });
        reportAddTableRows(sheet, 4, ["School", "Total Students", "Offices Represented", "Completed", "Ongoing", "Completion Rate", "Courses Represented"], rows, [36, 16, 20, 14, 14, 16, 46]);
        for(let r = 5; r <= 4 + rows.length; r++) reportStylePercentCell(sheet.getCell(r, 6));
        return sheet;
    }

    function reportBuildOfficeSummarySheet(wb, list){
        const sheet = wb.addWorksheet("Office Summary");
        reportSetSheetBase(sheet, PGMO_REPORT_THEME.gold);
        reportTitle(sheet, "Summary by Office", "How many students are assigned to each office", 6);
        const rows = reportOfficeSummaryRows(list).map(row => [row.office, row.total, row.completed, row.ongoing, row.rate, groupBy(list.filter(s => officeOf(s) === row.office), schoolOf).map(([school, items]) => `${school} (${items.length})`).join(", ")]);
        reportAddTableRows(sheet, 4, ["Office Assigned", "Total Students", "Completed", "Ongoing", "Completion Rate", "School Breakdown"], rows, [34, 16, 14, 14, 16, 48]);
        for(let r = 5; r <= 4 + rows.length; r++) reportStylePercentCell(sheet.getCell(r, 5));
        return sheet;
    }

    function reportBuildSchoolOfficeSheet(wb, list){
        const sheet = wb.addWorksheet("School Office Summary");
        reportSetSheetBase(sheet, PGMO_REPORT_THEME.green);
        reportTitle(sheet, "School and Office Assignment Summary", "Student count per school and assigned office", 6);
        const rows = groupByTwo(list, schoolOf, officeOf).map(row => {
            const nums = summaryNumbers(row.items);
            return [row.first, row.second, nums.total, nums.completed, nums.ongoing, reportCompletionRate(row.items)];
        });
        reportAddTableRows(sheet, 4, ["School", "Office Assigned", "Total Students", "Completed", "Ongoing", "Completion Rate"], rows, [36, 34, 16, 14, 14, 16]);
        for(let r = 5; r <= 4 + rows.length; r++) reportStylePercentCell(sheet.getCell(r, 6));
        return sheet;
    }

    async function generateAdminSchoolOfficeReportExcel(){
        if(!pgmoAdminReportStudents.length){
            const result = typeof fetchAdminStudents === "function" ? await fetchAdminStudents() : {students:[], error:"Student loader is missing."};
            if(result.error){ alert(result.error); return; }
            pgmoAdminReportStudents = result.students || [];
        }
        const list = getFilteredStudents();
        if(!list.length){ alert("No report data matches the selected filters."); return; }

        if(!window.ExcelJS){
            alert("Excel report library is not loaded. Please check your internet connection or CDN access.");
            return;
        }

        try{
            const button = document.querySelector('[onclick="generateReportExcel()"]');
            const oldButtonText = button ? button.innerHTML : "";
            if(button){
                button.disabled = true;
                button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Building Excel...';
            }

            const wb = new ExcelJS.Workbook();
            wb.creator = "PGMO OJT Admin Portal";
            wb.lastModifiedBy = "PGMO OJT Admin Portal";
            wb.created = new Date();
            wb.modified = new Date();
            wb.properties = {
                title:"PGMO OJT / Work Immersion Student Report",
                subject:"Total student report",
                category:"OJT Report",
                keywords:"PGMO,OJT,student report,work immersion"
            };

            reportBuildSummarySheet(wb, list);
            reportBuildStudentDetailsSheet(wb, list);
            reportBuildSchoolSummarySheet(wb, list);
            reportBuildOfficeSummarySheet(wb, list);
            reportBuildSchoolOfficeSheet(wb, list);

            wb.eachSheet(sheet => {
                sheet.eachRow(row => {
                    row.eachCell(cell => {
                        if(!cell.font) cell.font = {name:"Segoe UI", size:10};
                    });
                });
            });

            const buffer = await wb.xlsx.writeBuffer();
            reportDownloadBuffer(buffer, `PGMO_Clean_Student_Report_${reportFileDate()}.xlsx`);

            if(typeof showToast === "function"){
                showToast("Clean Excel report generated successfully.");
            }

            if(button){
                button.disabled = false;
                button.innerHTML = oldButtonText;
            }
        }catch(error){
            console.error("PGMO Excel report error:", error);
            alert(error?.message || "Could not generate Excel report.");
            const button = document.querySelector('[onclick="generateReportExcel()"]');
            if(button){
                button.disabled = false;
                button.innerHTML = '<i class="fa fa-file-excel"></i> Download Report';
            }
        }
    }

    window.renderReports = renderAdminReports;
    window.getFilteredReportStudents = getFilteredStudents;
    window.resetAdminReportFilters = resetAdminReportFilters;
    window.generateReportExcel = generateAdminSchoolOfficeReportExcel;

    try{
        renderReports = renderAdminReports;
        getFilteredReportStudents = getFilteredStudents;
        generateReportExcel = generateAdminSchoolOfficeReportExcel;
    }catch(error){
        console.warn("PGMO admin report override warning:", error?.message || error);
    }

    document.addEventListener("DOMContentLoaded", function(){
        if(document.body?.dataset?.page === "reports"){
            setTimeout(renderAdminReports, 200);
        }
    });
})();


/* PGMO PATCH 2026-07-02: editable certificate gender pronoun */
(function(){
    "use strict";

    function certSafe(value){
        return typeof certificateEscape === "function" ? certificateEscape(value) : String(value ?? "")
            .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    function normalizeGender(value){
        const raw = String(value || "").trim().toLowerCase();
        if(raw === "m" || raw === "male") return "Male";
        if(raw === "f" || raw === "female") return "Female";
        return "";
    }

    function defaultPronounForGender(value){
        const gender = normalizeGender(value);
        if(gender === "Male") return "his";
        if(gender === "Female") return "her";
        return "his/her";
    }

    function fullOfficeName(value){
        const raw = String(value || "").trim();
        const key = raw.toUpperCase().replace(/\s+/g, " ");
        const map = {
            "HRMO": "Human Resource Management Office",
            "PGSO": "Provincial General Services Office",
            "MIS": "Management Information System Office",
            "HRIS": "Human Resource Information System",
            "PAGRO": "Provincial Agriculture Office",
            "PAGRO - MOPADC": "Misamis Oriental Provincial Agricultural Development Complex",
            "MOPADC": "Misamis Oriental Provincial Agricultural Development Complex",
            "PTO": "Provincial Treasurer's Office",
            "PBO": "Provincial Budget Office",
            "PACCO": "Provincial Accounting Office",
            "PPDO": "Provincial Planning and Development Office",
            "PGO": "Provincial Governor's Office",
            "PESO": "Public Employment Service Office",
            "PHO": "Provincial Health Office",
            "PSWDO": "Provincial Social Welfare and Development Office",
            "PEO": "Provincial Engineer's Office",
            "PLO": "Provincial Legal Office",
            "PDRRMO": "Provincial Disaster Risk Reduction and Management Office"
        };
        return map[key] || raw || "Not assigned";
    }

    function certValueOrBlank(value){
        if(typeof certificateValueOrBlank === "function") return certificateValueOrBlank(value);
        const text = String(value || "").trim();
        return text || "__________";
    }

    function certTextSize(value, baseSize, minSize, limit){
        if(typeof getCertificateTextSize === "function") return getCertificateTextSize(value, baseSize, minSize, limit);
        const text = String(value || "");
        if(text.length <= limit) return baseSize;
        return Math.max(minSize, Math.round(baseSize - ((text.length - limit) * 0.45)));
    }

    function certGivenDate(value){
        if(typeof formatCertificateGivenDate === "function") return formatCertificateGivenDate(value);
        if(typeof formatCertificateDate === "function") return formatCertificateDate(value);
        return value || "";
    }

    function certDate(value){
        if(typeof formatCertificateDate === "function") return formatCertificateDate(value);
        return value || "";
    }

    const oldMapCertificateStudent = typeof mapCertificateStudent === "function" ? mapCertificateStudent : null;
    mapCertificateStudent = function(row){
        const student = oldMapCertificateStudent ? oldMapCertificateStudent(row) : {};
        student.uuid = student.uuid || row.id || "";
        student.studentId = student.studentId || row.student_id || "";
        student.name = student.name || row.full_name || "Unnamed Student";
        student.school = student.school || (typeof getStudentSchool === "function" ? getStudentSchool(row) : row.school) || "School not set";
        student.course = student.course || row.course || "-";
        student.office = student.office || row.office_assigned || "Not assigned";
        student.officeFullName = fullOfficeName(student.office);
        student.gender = normalizeGender(row.gender || row.sex || student.gender || "");
        student.pronoun = defaultPronounForGender(student.gender);
        student.completed = Number(student.completed ?? row.completed_hours ?? 0);
        student.required = Number(student.required ?? row.required_hours ?? 0);
        student.status = student.status || row.ojt_status || row.status || (student.required > 0 && student.completed >= student.required ? "Completed" : "Pending");
        student.email = student.email || row.email || "";
        return student;
    };

    const oldRenderCertificates = typeof renderCertificates === "function" ? renderCertificates : null;
    renderCertificates = async function(){
        const tbody = document.getElementById("certificatesTableBody");
        if(!tbody || typeof fetchCertificateStudents !== "function"){
            if(oldRenderCertificates) return oldRenderCertificates();
            return;
        }

        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-spinner fa-spin"></i><h5>Loading certificates...</h5><p>Checking student completion records from Supabase.</p></div></td></tr>`;
        const result = await fetchCertificateStudents();
        if(result.error){
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa fa-triangle-exclamation"></i><h5>Unable to load students</h5><p>${certSafe(result.error)}</p></div></td></tr>`;
            return;
        }

        certificateStudentsCache = result.students || [];
        const eligibleCount = certificateStudentsCache.filter(isCertificateEligible).length;
        const completedCount = certificateStudentsCache.filter(student => String(student.status).toLowerCase() === "completed" || isCertificateEligible(student)).length;
        const pendingCount = Math.max(certificateStudentsCache.length - eligibleCount, 0);
        const eligibleEl = document.getElementById("certEligibleCount");
        const completedEl = document.getElementById("certCompletedCount");
        const pendingEl = document.getElementById("certPendingCount");
        if(eligibleEl) eligibleEl.textContent = eligibleCount;
        if(completedEl) completedEl.textContent = completedCount;
        if(pendingEl) pendingEl.textContent = pendingCount;

        const search = (document.getElementById("certificateSearch")?.value || "").toLowerCase();
        const filter = document.getElementById("certificateEligibility")?.value || "All";
        const list = certificateStudentsCache.filter(student => {
            const eligible = isCertificateEligible(student);
            const searchSource = [student.name, student.studentId, student.email, student.school, student.course, student.office, student.gender].join(" ").toLowerCase();
            return searchSource.includes(search) && (filter === "All" || (filter === "Eligible" && eligible) || (filter === "Not Eligible" && !eligible));
        });

        if(!list.length){
            tbody.innerHTML = typeof emptyRow === "function" ? emptyRow(7, "fa fa-award", "No certificate records found", "Completed students will appear here once their required OJT hours are reached.") : "";
            return;
        }

        tbody.innerHTML = list.map(student => {
            const eligible = isCertificateEligible(student);
            const requiredLabel = student.required > 0 ? student.required : "Not set";
            const readyLabel = student.certificateReady ? `<span class="badge-soft badge-approved">Ready</span>` : (eligible ? `<span class="badge-soft badge-eligible">Eligible</span>` : `<span class="badge-soft badge-pending">Locked</span>`);
            const action = eligible
                ? `<button type="button" class="btn btn-sm btn-outline-primary" onclick="openCertificatePreview('${certSafe(student.uuid)}')"><i class="fa fa-award"></i> Generate</button>`
                : `<button type="button" class="btn btn-sm btn-outline-secondary" disabled>Locked</button>`;
            return `<tr>
                <td><strong>${certSafe(student.name)}</strong><br><small class="text-secondary">${certSafe(student.studentId)} · ${certSafe(student.email)}</small></td>
                <td>${certSafe(student.school)}</td>
                <td>${certSafe(student.course)}</td>
                <td>${certSafe(student.office)}</td>
                <td>${student.completed} / ${requiredLabel}</td>
                <td>${readyLabel}</td>
                <td>${action}</td>
            </tr>`;
        }).join("");
    };

    function populateCertificateEditableFields(student){
        const nameInput = document.getElementById("certificateStudentNameEdit");
        const courseInput = document.getElementById("certificateCourseEdit");
        const schoolInput = document.getElementById("certificateSchoolEdit");
        const officeInput = document.getElementById("certificateOfficeEdit");
        const pronounInput = document.getElementById("certificatePronounEdit");
        const signatoryInput = document.getElementById("certificateSignatoryNameEdit");
        if(nameInput) nameInput.value = student?.name || "";
        if(courseInput) courseInput.value = student?.course || "";
        if(schoolInput) schoolInput.value = student?.school || "";
        if(officeInput) officeInput.value = fullOfficeName(student?.officeFullName || student?.office || "");
        if(pronounInput) pronounInput.value = student?.pronoun || defaultPronounForGender(student?.gender || "");
        if(signatoryInput) signatoryInput.value = student?.certificateSignatoryName || CERTIFICATE_DEFAULT_SIGNATORY_NAME;
    }

    getCertificateFormValues = function(){
        const issueDate = document.getElementById("certificateIssueDate")?.value || (typeof getCertificateToday === "function" ? getCertificateToday() : new Date().toISOString().slice(0,10));
        return {
            issueDate,
            trainingStart: document.getElementById("certificateTrainingStart")?.value || "",
            trainingEnd: document.getElementById("certificateTrainingEnd")?.value || "",
            editableName: document.getElementById("certificateStudentNameEdit")?.value.trim() || "",
            editableCourse: document.getElementById("certificateCourseEdit")?.value.trim() || "",
            editableSchool: document.getElementById("certificateSchoolEdit")?.value.trim() || "",
            editableOffice: document.getElementById("certificateOfficeEdit")?.value.trim() || "",
            editablePronoun: document.getElementById("certificatePronounEdit")?.value.trim() || "",
            editableSignatoryName: document.getElementById("certificateSignatoryNameEdit")?.value.trim() || CERTIFICATE_DEFAULT_SIGNATORY_NAME
        };
    };

    openCertificatePreview = function(uuid){
        const student = certificateStudentsCache.find(item => item.uuid === uuid);
        if(!student){ alert("Student record not found."); return; }
        selectedCertificateStudent = student;
        const issue = document.getElementById("certificateIssueDate");
        if(issue && !issue.value) issue.value = typeof getCertificateToday === "function" ? getCertificateToday() : new Date().toISOString().slice(0,10);
        const start = document.getElementById("certificateTrainingStart");
        const end = document.getElementById("certificateTrainingEnd");
        if(start) start.value = "";
        if(end) end.value = "";
        populateCertificateEditableFields(student);
        refreshCertificatePreview();
        const modalEl = document.getElementById("certificatePreviewModal");
        if(modalEl && window.bootstrap){ new bootstrap.Modal(modalEl).show(); }
    };

    certificateHtml = function(student, options = {}){
        const issueDate = options.issueDate || (typeof getCertificateToday === "function" ? getCertificateToday() : new Date().toISOString().slice(0,10));
        const requiredHours = Number(student.required || 0);
        const completedHours = Number(student.completed || 0);
        const hours = requiredHours > 0 ? requiredHours : completedHours;
        const studentName = certValueOrBlank(options.editableName || student.name);
        const course = certValueOrBlank(options.editableCourse || student.course);
        const pronoun = certValueOrBlank(options.editablePronoun || student.pronoun || defaultPronounForGender(student.gender));
        const school = certValueOrBlank(options.editableSchool || student.school || "School not set");
        const startDate = options.trainingStart ? certDate(options.trainingStart) : "__________";
        const endDate = options.trainingEnd ? certDate(options.trainingEnd) : "__________";
        const office = certValueOrBlank(options.editableOffice || fullOfficeName(student.officeFullName || student.office));
        const hoursText = hours ? `${hours} hours` : "__________ hours";
        const givenText = certGivenDate(issueDate);

        return `
            <div class="certificate-template-preview liceo-cert-template" id="certificatePrintable">
                <img src="${getCertificateTemplateUrl()}" alt="Certificate Template">
                <div class="cert-overlay cert-student-name" style="font-size:${certTextSize(studentName, 46, 22, 18)}px; font-family:'Rustic Roadway','Rustic Roadway - Personal use','Times New Roman',serif !important; font-weight:400 !important;">${certSafe(studentName)}</div>
                <div class="cert-name-underline" aria-hidden="true"></div>
                <div class="cert-overlay cert-course-line" style="font-size:${certTextSize(course, 22, 15, 42)}px">${certSafe(course)}</div>
                <div class="cert-overlay cert-student-label">Student</div>
                <div class="cert-overlay cert-school-line cert-multiline" style="font-size:${certTextSize(school, 21, 14, 62)}px">of ${certSafe(school)}, for</div>
                <div class="cert-overlay cert-training-line cert-multiline" style="font-size:${certTextSize(hoursText, 21, 15, 24)}px">having completed ${certSafe(pronoun)} ${certSafe(hoursText)} On-the-Job Training</div>
                <div class="cert-overlay cert-dates-line cert-multiline" style="font-size:${certTextSize(startDate + endDate, 21, 14, 44)}px">course requirement from ${certSafe(startDate)} to ${certSafe(endDate)} in</div>
                <div class="cert-overlay cert-office-line cert-multiline" style="font-size:${certTextSize(office, 21, 14, 48)}px">the ${certSafe(office)}.</div>
                <div class="cert-overlay cert-given-line cert-multiline" style="font-size:${certTextSize(givenText, 19, 16, 52)}px">Given this ${certSafe(givenText)} at the Provincial Capitol</div>
                <div class="cert-overlay cert-location-line cert-multiline">Compound, Cagayan de Oro City, Misamis Oriental,</div>
                <div class="cert-overlay cert-country-line cert-multiline">Philippines.</div>
            </div>
        `;
    };

    refreshCertificatePreview = function(){
        if(!selectedCertificateStudent) return;
        const body = document.getElementById("certificatePreviewBody");
        if(!body) return;
        body.innerHTML = certificateHtml(selectedCertificateStudent, getCertificateFormValues());
        if(typeof fitCertificateOverlayText === "function") requestAnimationFrame(() => fitCertificateOverlayText(body));
    };

    async function downloadEditableCertificatePdf(){
        if(!selectedCertificateStudent){ alert("Please select a completed student first."); return; }
        const options = getCertificateFormValues();
        const student = selectedCertificateStudent;
        const studentName = certValueOrBlank(options.editableName || student.name);
        const requiredHours = Number(student.required || 0);
        const completedHours = Number(student.completed || 0);
        const hours = requiredHours > 0 ? requiredHours : completedHours;
        const fileName = `${studentName.replace(/[^a-z0-9]+/gi, "_")}_Certificate.pdf`;
        if(!window.jspdf || !window.jspdf.jsPDF){ printCertificate(); return; }

        const { jsPDF } = window.jspdf;
        const pageW = 1414;
        const pageH = 2000;
        const centerX = pageW / 2;
        const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[pageW, pageH] });
        const templateData = await loadImageAsDataUrl(getCertificateTemplateUrl());
        if(!templateData){ alert("Certificate template could not be loaded."); return; }
        pdf.addImage(templateData, "PNG", 0, 0, pageW, pageH);

        function fitText(text, y, maxWidth, baseSize, minSize, weight = "normal"){
            text = String(text || "").trim();
            if(!text) return;
            pdf.setFont("times", weight);
            let size = baseSize;
            pdf.setFontSize(size);
            while(size > minSize && pdf.getTextWidth(text) > maxWidth){
                size -= 1;
                pdf.setFontSize(size);
            }
            pdf.text(text, centerX, y, { align:"center" });
        }

        const course = certValueOrBlank(options.editableCourse || student.course);
        const pronoun = certValueOrBlank(options.editablePronoun || student.pronoun || defaultPronounForGender(student.gender));
        const school = certValueOrBlank(options.editableSchool || student.school || "School not set");
        const startDate = options.trainingStart ? certDate(options.trainingStart) : "__________";
        const endDate = options.trainingEnd ? certDate(options.trainingEnd) : "__________";
        const office = certValueOrBlank(options.editableOffice || fullOfficeName(student.officeFullName || student.office));
        const hoursText = hours ? `${hours} hours` : "__________ hours";
        const givenText = certGivenDate(options.issueDate || (typeof getCertificateToday === "function" ? getCertificateToday() : new Date().toISOString().slice(0,10)));

        pdf.setTextColor(0, 0, 0);
        fitText(studentName, 955, 1080, 48, 26, "italic");
        fitText(course, 1038, 800, 35, 20, "normal");
        fitText("Student", 1078, 260, 32, 22, "normal");
        fitText(`of ${school}, for`, 1152, 1100, 32, 18, "normal");
        fitText(`having completed ${pronoun} ${hoursText} On-the-Job Training`, 1206, 1120, 32, 18, "normal");
        fitText(`course requirement from ${startDate} to ${endDate} in`, 1260, 1160, 31, 17, "normal");
        fitText(`the ${office}.`, 1315, 900, 32, 18, "normal");
        fitText(`Given this ${givenText} at the Provincial Capitol`, 1438, 1100, 32, 18, "normal");
        fitText("Compound, Cagayan de Oro City, Misamis Oriental,", 1490, 1000, 32, 18, "normal");
        fitText("Philippines.", 1542, 500, 32, 20, "normal");
        pdf.save(fileName);
    }

    downloadCertificatePdf = downloadEditableCertificatePdf;

    if(typeof printCertificate === "function"){
        const oldPrintCertificate = printCertificate;
        printCertificate = function(){
            refreshCertificatePreview();
            oldPrintCertificate();
        };
    }

    window.mapCertificateStudent = mapCertificateStudent;
    window.renderCertificates = renderCertificates;
    window.openCertificatePreview = openCertificatePreview;
    window.getCertificateFormValues = getCertificateFormValues;
    window.certificateHtml = certificateHtml;
    window.refreshCertificatePreview = refreshCertificatePreview;
    window.downloadCertificatePdf = downloadCertificatePdf;
    window.printCertificate = printCertificate;
})();


/* PGMO PATCH 2026-07-03: admin student profile picture in personal data modal
   Adds the student's uploaded profile picture to the admin Students > View modal.
   Visible UI only; no invisible buttons or hidden click layers. */
(function(){
    "use strict";

    function safe(value){
        if(typeof safeText === "function") return safeText(value);
        if(typeof pgmoSafe === "function") return pgmoSafe(value);
        return String(value ?? "").replace(/[&<>'"]/g, function(char){
            return ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"})[char];
        });
    }

    function initialsFromStudent(student){
        const first = String(student?.firstName || "").trim();
        const last = String(student?.lastName || "").trim();
        if(first || last){
            return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "ST";
        }
        const name = String(student?.name || "Student").replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
        return ((name[0]?.[0] || "S") + (name[1]?.[0] || "T")).toUpperCase();
    }

    function statusBadge(value){
        if(typeof badge === "function") return badge(value);
        if(typeof pgmoStatusBadge === "function") return pgmoStatusBadge(value);
        return `<span class="badge-soft">${safe(value || "-")}</span>`;
    }

    function profilePhotoMarkup(student){
        const url = student?.profilePictureUrl || student?.profile_picture_url || student?.avatarUrl || student?.photoUrl || "";
        const initials = initialsFromStudent(student);
        if(url){
            return `
                <div class="pgmo-student-view-photo-frame" aria-label="Student profile picture">
                    <img src="${safe(url)}" alt="${safe(student?.name || 'Student')} profile picture" loading="lazy"
                         onerror="this.remove(); this.parentElement.classList.add('has-fallback');">
                    <span>${safe(initials)}</span>
                </div>`;
        }
        return `<div class="pgmo-student-view-photo-frame has-fallback" aria-label="Student profile picture placeholder"><span>${safe(initials)}</span></div>`;
    }

    const previousAccountMapper = (typeof accountToAdminStudent === "function") ? accountToAdminStudent : window.accountToAdminStudent;
    if(typeof previousAccountMapper === "function"){
        const enhancedMapper = function(row){
            const student = previousAccountMapper(row) || {};
            student.profilePictureUrl = row?.profile_picture_url || row?.avatar_url || row?.photo_url || row?.profile_url || student.profilePictureUrl || "";
            student.profilePicturePath = row?.profile_picture_path || student.profilePicturePath || "";
            student.gender = row?.gender || student.gender || "";
            student.school = row?.school || student.school || "";
            return student;
        };
        accountToAdminStudent = enhancedMapper;
        window.accountToAdminStudent = enhancedMapper;
    }

    const enhancedViewStudent = function(uuid){
        const student = (window.adminStudentsCache || adminStudentsCache || []).find(function(item){ return item.uuid === uuid; });
        if(!student){
            alert("Student not found. Please refresh.");
            return;
        }
        const body = document.querySelector("#studentViewBody");
        if(!body) return;

        body.innerHTML = `
            <div class="pgmo-student-view-card">
                <div class="pgmo-student-view-head">
                    ${profilePhotoMarkup(student)}
                    <div class="pgmo-student-view-title">
                        <h4>${safe(student.name || "Unnamed Student")}</h4>
                        <p>${safe(student.id || "No student ID")} · ${safe(student.school || "School not set")}</p>
                    </div>
                </div>

                <div class="pgmo-student-view-grid">
                    <div><span>Student ID</span><strong>${safe(student.id || "-")}</strong></div>
                    <div><span>Status</span><strong>${statusBadge(student.status || "Pending")}</strong></div>
                    <div><span>Full Name</span><strong>${safe(student.name || "-")}</strong></div>
                    <div><span>Gender</span><strong>${safe(student.gender || "Not set")}</strong></div>
                    <div><span>School</span><strong>${safe(student.school || "Not set")}</strong></div>
                    <div><span>Course</span><strong>${safe(student.course || "-")}</strong></div>
                    <div><span>Office Assigned</span><strong>${safe(student.office || "Not assigned")}</strong></div>
                    <div><span>OJT Progress</span><strong>${safe(student.completed || 0)} / ${safe(student.required || "Not set")} hours</strong></div>
                    <div><span>Email</span><strong>${safe(student.email || "-")}</strong></div>
                    <div><span>Contact Number</span><strong>${safe(student.phone || "-")}</strong></div>
                </div>
            </div>`;

        new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
    };

    viewStudent = enhancedViewStudent;
    window.viewStudent = enhancedViewStudent;
})();


/* PGMO PATCH 2026-07-06: Admin-selectable student gender.
   This only adds the gender field to Students Management save/edit flow.
   It does not change DTR or certificate generation logic. */
(function(){
    "use strict";

    const oldOpenStudentAdd = typeof openStudentAdd === "function" ? openStudentAdd : null;
    if(oldOpenStudentAdd){
        openStudentAdd = function(){
            oldOpenStudentAdd.apply(this, arguments);
            const genderInput = document.querySelector("#studentGenderInput");
            if(genderInput) genderInput.value = "";
        };
        window.openStudentAdd = openStudentAdd;
    }
})();


/* PGMO DOCUMENT PREVIEW MODAL - Admin side */
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

/* PGMO PATCH 2026-07-13: clearer admin student profile photo viewer.
   Admin Students > View now shows a larger profile picture and a click-to-enlarge preview.
   No student, DTR, certificate, or SQL logic is changed. */
(function(){
    "use strict";

    function safe(value){
        if(typeof safeText === "function") return safeText(value);
        if(typeof pgmoSafe === "function") return pgmoSafe(value);
        return String(value ?? "").replace(/[&<>'"]/g, function(char){
            return ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"})[char];
        });
    }

    function initialsFromStudent(student){
        const first = String(student?.firstName || "").trim();
        const last = String(student?.lastName || "").trim();
        if(first || last){
            return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "ST";
        }
        const name = String(student?.name || "Student").replace(/,/g, " ").trim().split(/\s+/).filter(Boolean);
        return ((name[0]?.[0] || "S") + (name[1]?.[0] || "T")).toUpperCase();
    }

    function statusBadge(value){
        if(typeof badge === "function") return badge(value);
        if(typeof pgmoStatusBadge === "function") return pgmoStatusBadge(value);
        return `<span class="badge-soft">${safe(value || "-")}</span>`;
    }

    function getStudentPhotoUrl(student){
        return student?.profilePictureUrl || student?.profile_picture_url || student?.avatarUrl || student?.photoUrl || student?.profile_url || "";
    }

    function clearPhotoMarkup(student){
        const url = getStudentPhotoUrl(student);
        const initials = initialsFromStudent(student);
        const name = student?.name || "Student";

        if(url){
            return `
                <div class="pgmo-student-view-photo-column">
                    <button type="button"
                            class="pgmo-student-view-photo-frame pgmo-student-view-photo-clear"
                            data-student-photo-url="${safe(url)}"
                            data-student-photo-name="${safe(name)}"
                            aria-label="View larger profile picture of ${safe(name)}">
                        <img src="${safe(url)}" alt="${safe(name)} profile picture" loading="lazy"
                             onerror="this.remove(); this.parentElement.classList.add('has-fallback'); this.parentElement.removeAttribute('data-student-photo-url');">
                        <span>${safe(initials)}</span>
                    </button>
                    <small class="pgmo-student-photo-hint"><i class="fa fa-magnifying-glass-plus"></i> Click photo to enlarge</small>
                </div>`;
        }

        return `
            <div class="pgmo-student-view-photo-column">
                <div class="pgmo-student-view-photo-frame pgmo-student-view-photo-clear has-fallback" aria-label="Student profile picture placeholder">
                    <span>${safe(initials)}</span>
                </div>
                <small class="pgmo-student-photo-hint"><i class="fa fa-image"></i> No profile photo</small>
            </div>`;
    }

    function ensurePhotoLightbox(){
        let box = document.querySelector("#pgmoStudentPhotoLightbox");
        if(box) return box;

        box = document.createElement("div");
        box.id = "pgmoStudentPhotoLightbox";
        box.className = "pgmo-student-photo-lightbox";
        box.innerHTML = `
            <div class="pgmo-student-photo-lightbox-backdrop" data-close-student-photo="true"></div>
            <div class="pgmo-student-photo-lightbox-card" role="dialog" aria-modal="true" aria-label="Student profile picture preview">
                <div class="pgmo-student-photo-lightbox-head">
                    <strong id="pgmoStudentPhotoLightboxName">Student Profile Picture</strong>
                    <button type="button" class="pgmo-student-photo-lightbox-close" data-close-student-photo="true" aria-label="Close profile picture preview">
                        <i class="fa fa-xmark"></i>
                    </button>
                </div>
                <div class="pgmo-student-photo-lightbox-body">
                    <img id="pgmoStudentPhotoLightboxImg" src="" alt="Student profile picture preview">
                </div>
            </div>`;
        document.body.appendChild(box);
        return box;
    }

    function openPhotoLightbox(url, name){
        if(!url) return;
        const box = ensurePhotoLightbox();
        const img = box.querySelector("#pgmoStudentPhotoLightboxImg");
        const label = box.querySelector("#pgmoStudentPhotoLightboxName");
        if(img) img.src = url;
        if(label) label.textContent = `${name || "Student"} - Profile Picture`;
        box.classList.add("show");
        document.body.classList.add("pgmo-student-photo-lightbox-open");
    }

    function closePhotoLightbox(){
        const box = document.querySelector("#pgmoStudentPhotoLightbox");
        if(!box) return;
        box.classList.remove("show");
        document.body.classList.remove("pgmo-student-photo-lightbox-open");
        const img = box.querySelector("#pgmoStudentPhotoLightboxImg");
        if(img) img.src = "";
    }

    document.addEventListener("click", function(event){
        const photoButton = event.target.closest("[data-student-photo-url]");
        if(photoButton){
            openPhotoLightbox(photoButton.dataset.studentPhotoUrl, photoButton.dataset.studentPhotoName);
            return;
        }

        if(event.target.closest("[data-close-student-photo]")){
            closePhotoLightbox();
        }
    });

    document.addEventListener("keydown", function(event){
        if(event.key === "Escape"){
            closePhotoLightbox();
        }
    });

    const enhancedClearViewStudent = function(uuid){
        const students = window.adminStudentsCache || (typeof adminStudentsCache !== "undefined" ? adminStudentsCache : []);
        const student = students.find(function(item){ return item.uuid === uuid; });
        if(!student){
            alert("Student not found. Please refresh.");
            return;
        }

        const body = document.querySelector("#studentViewBody");
        if(!body) return;

        body.innerHTML = `
            <div class="pgmo-student-view-card">
                <div class="pgmo-student-view-head pgmo-student-view-head-clear-photo">
                    ${clearPhotoMarkup(student)}
                    <div class="pgmo-student-view-main-info">
                        <h4>${safe(student.name || "Unnamed Student")}</h4>
                        <p>${safe(student.id || "No student ID")} · ${safe(student.school || "School not set")}</p>
                        <span class="pgmo-student-photo-email"><i class="fa fa-envelope"></i> ${safe(student.email || "No email saved")}</span>
                    </div>
                </div>

                <div class="pgmo-student-view-grid">
                    <div><span>Student ID</span><strong>${safe(student.id || "-")}</strong></div>
                    <div><span>Status</span><strong>${statusBadge(student.status || "Pending")}</strong></div>
                    <div><span>Full Name</span><strong>${safe(student.name || "-")}</strong></div>
                    <div><span>Gender</span><strong>${safe(student.gender || "Not set")}</strong></div>
                    <div><span>School</span><strong>${safe(student.school || "Not set")}</strong></div>
                    <div><span>Course</span><strong>${safe(student.course || "-")}</strong></div>
                    <div><span>Office Assigned</span><strong>${safe(student.office || "Not assigned")}</strong></div>
                    <div><span>OJT Progress</span><strong>${safe(student.completed || 0)} / ${safe(student.required || "Not set")} hours</strong></div>
                    <div><span>Email</span><strong>${safe(student.email || "-")}</strong></div>
                    <div><span>Contact Number</span><strong>${safe(student.phone || "-")}</strong></div>
                </div>
            </div>`;

        new bootstrap.Modal(document.querySelector("#studentViewModal")).show();
    };

    window.viewStudent = enhancedClearViewStudent;
    if(typeof viewStudent !== "undefined"){
        viewStudent = enhancedClearViewStudent;
    }
})();
