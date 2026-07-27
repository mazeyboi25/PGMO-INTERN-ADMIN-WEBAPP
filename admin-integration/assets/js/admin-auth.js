/* ADMIN AUTHENTICATION + SESSION CONTROL
   - Admin accounts stay saved in localStorage.
   - Login sessions use sessionStorage only, so closing the browser logs out the admin.
   - Protected pages auto logout after inactivity.
*/

const ADMIN_ACCOUNTS_KEY = "interntrack_admin_accounts_hrmo_v1";
const ADMIN_SESSION_KEYS = [
    "interntrack_logged_in",
    "interntrack_username",
    "interntrack_full_name",
    "interntrack_role",
    "interntrack_last_activity"
];
const ADMIN_AUTO_LOGOUT_MS = 30 * 60 * 1000;
const ADMIN_BOOTSTRAP_CONFIG = window.PGMO_CONFIG || {};
const DEFAULT_ADMIN_USERNAME = String(ADMIN_BOOTSTRAP_CONFIG.ADMIN_DEFAULT_USERNAME || "").trim();
const DEFAULT_ADMIN_FULL_NAME = String(ADMIN_BOOTSTRAP_CONFIG.ADMIN_DEFAULT_FULL_NAME || "PGMO Administrator").trim();
const DEFAULT_ADMIN_ROLE = String(ADMIN_BOOTSTRAP_CONFIG.ADMIN_DEFAULT_ROLE || "Super Admin").trim();
const DEFAULT_ADMIN_HASH = String(ADMIN_BOOTSTRAP_CONFIG.ADMIN_DEFAULT_PASSWORD_HASH || "").trim();

async function hashAdminPassword(password){
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function seedAdminAccounts(){
    const existing = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
    let existingAccounts = [];

    if(existing){
        try{
            existingAccounts = JSON.parse(existing) || [];
        }catch(error){
            console.error("Admin accounts data is invalid:", error);
            localStorage.removeItem(ADMIN_ACCOUNTS_KEY);
        }
    }

    if(Array.isArray(existingAccounts) && existingAccounts.length){
        return;
    }

    // The public repository never contains a default administrator password.
    // A local bootstrap account is created only when config.local.js provides
    // both a username and a SHA-256 password hash.
    if(!DEFAULT_ADMIN_USERNAME || !DEFAULT_ADMIN_HASH){
        localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify([]));
        return;
    }

    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify([
        {
            id: "ADM-001",
            fullName: DEFAULT_ADMIN_FULL_NAME || DEFAULT_ADMIN_USERNAME,
            username: DEFAULT_ADMIN_USERNAME,
            role: DEFAULT_ADMIN_ROLE || "Super Admin",
            passwordHash: DEFAULT_ADMIN_HASH,
            createdAt: new Date().toISOString()
        }
    ]));
}

function getAdminAccounts(){
    seedAdminAccounts();

    try{
        return JSON.parse(localStorage.getItem(ADMIN_ACCOUNTS_KEY)) || [];
    }catch(error){
        console.error("Admin accounts data is invalid:", error);
        localStorage.removeItem(ADMIN_ACCOUNTS_KEY);
        seedAdminAccounts();
        return JSON.parse(localStorage.getItem(ADMIN_ACCOUNTS_KEY)) || [];
    }
}

function saveAdminAccounts(accounts){
    localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function setAdminSession(account){
    sessionStorage.setItem("interntrack_logged_in", "true");
    sessionStorage.setItem("interntrack_username", account.username || "admin");
    sessionStorage.setItem("interntrack_full_name", account.fullName || account.username || "Admin");
    sessionStorage.setItem("interntrack_role", account.role || "OJT Coordinator");
    sessionStorage.setItem("interntrack_last_activity", String(Date.now()));

    // Remove old persistent login values from the previous version.
    localStorage.removeItem("interntrack_logged_in");
    localStorage.removeItem("interntrack_username");
}

function clearAdminSession(){
    ADMIN_SESSION_KEYS.forEach(key => sessionStorage.removeItem(key));

    // Also clean old persistent login values from the previous version.
    localStorage.removeItem("interntrack_logged_in");
    localStorage.removeItem("interntrack_username");
}

function isAdminLoggedIn(){
    return sessionStorage.getItem("interntrack_logged_in") === "true";
}

function getAdminSessionUsername(){
    return sessionStorage.getItem("interntrack_username") || "admin";
}

function getAdminSessionName(){
    return sessionStorage.getItem("interntrack_full_name") || getAdminSessionUsername();
}

function requireAdminLogin(){
    if(!isAdminLoggedIn()){
        window.location.href = "login.html";
        return false;
    }

    const lastActivity = Number(sessionStorage.getItem("interntrack_last_activity") || 0);
    const expired = lastActivity && Date.now() - lastActivity > ADMIN_AUTO_LOGOUT_MS;

    if(expired){
        clearAdminSession();
        sessionStorage.setItem("admin_session_expired", "Your session expired. Please log in again.");
        window.location.href = "login.html";
        return false;
    }

    sessionStorage.setItem("interntrack_last_activity", String(Date.now()));
    return true;
}

function startAdminAutoLogout(){
    if(!isAdminLoggedIn()){
        return;
    }

    const updateActivity = () => {
        sessionStorage.setItem("interntrack_last_activity", String(Date.now()));
    };

    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(eventName => {
        document.addEventListener(eventName, updateActivity, {passive:true});
    });

    setInterval(() => {
        if(!isAdminLoggedIn()){
            return;
        }

        const lastActivity = Number(sessionStorage.getItem("interntrack_last_activity") || 0);
        if(lastActivity && Date.now() - lastActivity > ADMIN_AUTO_LOGOUT_MS){
            clearAdminSession();
            sessionStorage.setItem("admin_session_expired", "Your session expired. Please log in again.");
            window.location.href = "login.html";
        }
    }, 30000);
}
