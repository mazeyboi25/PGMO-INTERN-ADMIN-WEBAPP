/* PGMO STUDENT RESPONSIVE UI 2026-07-20
   Adds phone-friendly bottom navigation and small accessibility fixes.
   Existing desktop navigation and page behavior are preserved.
*/
(function(){
    "use strict";

    function isPortalPage(){
        return document.body && document.body.classList.contains("portal-body") && document.querySelector(".portal-sidebar");
    }

    function currentFile(){
        var file = (window.location.pathname.split("/").pop() || "dashboard.html").toLowerCase();
        return file === "" ? "dashboard.html" : file;
    }

    function pageMatches(file, target){
        if(target === "dashboard.html") return file === "dashboard.html" || file === "index.html";
        if(target === "upload.html") return file === "upload.html" || file === "documents.html" || file === "submissions.html";
        return file === target;
    }

    function createNavItem(tag, href, icon, label, file){
        var element = document.createElement(tag);
        if(href) element.setAttribute("href", href);
        else element.type = "button";
        element.className = "student-bottom-nav-item";
        element.innerHTML = '<i class="fa ' + icon + '" aria-hidden="true"></i><span>' + label + '</span>';
        if(file && pageMatches(currentFile(), file)){
            element.classList.add("active");
            element.setAttribute("aria-current", "page");
        }
        return element;
    }

    function syncNotificationBadge(nav){
        var source = document.getElementById("notificationBadge");
        var target = nav.querySelector(".student-bottom-notification-badge");
        if(!source || !target) return;

        function copy(){
            var text = (source.textContent || "").trim();
            target.textContent = text;
            target.hidden = !text || text === "0";
        }

        copy();
        new MutationObserver(copy).observe(source, { childList:true, subtree:true, characterData:true, attributes:true });
    }

    function makeBottomNav(){
        if(!isPortalPage() || document.getElementById("studentBottomNav")) return;

        var nav = document.createElement("nav");
        nav.id = "studentBottomNav";
        nav.className = "student-bottom-nav";
        nav.setAttribute("aria-label", "Mobile student navigation");

        nav.appendChild(createNavItem("a", "dashboard.html", "fa-house", "Home", "dashboard.html"));
        nav.appendChild(createNavItem("a", "dtr.html", "fa-calendar-days", "DTR", "dtr.html"));
        nav.appendChild(createNavItem("a", "upload.html", "fa-cloud-arrow-up", "Upload", "upload.html"));

        var alerts = createNavItem("a", "notifications.html", "fa-bell", "Alerts", "notifications.html");
        var badge = document.createElement("span");
        badge.className = "student-bottom-notification-badge";
        badge.hidden = true;
        alerts.appendChild(badge);
        nav.appendChild(alerts);

        var more = createNavItem("button", "", "fa-bars", "More", "");
        more.setAttribute("aria-controls", "studentSidebar");
        more.setAttribute("aria-expanded", "false");
        more.addEventListener("click", function(event){
            event.preventDefault();
            event.stopPropagation();
            var menuButton = document.getElementById("mobileMenuBtn");
            if(menuButton) menuButton.click();
            else document.body.classList.toggle("mobile-menu-open");
            more.setAttribute("aria-expanded", document.body.classList.contains("mobile-menu-open") ? "true" : "false");
        });
        nav.appendChild(more);

        document.body.appendChild(nav);
        syncNotificationBadge(nav);
    }

    function improveControls(){
        var sidebar = document.querySelector(".portal-sidebar");
        if(sidebar && !sidebar.id) sidebar.id = "studentSidebar";

        document.querySelectorAll("button:not([type])").forEach(function(button){
            button.type = "button";
        });

        var avatar = document.querySelector(".top-avatar");
        if(avatar){
            avatar.setAttribute("role", "link");
            avatar.setAttribute("tabindex", "0");
            avatar.setAttribute("aria-label", "Open my profile");
            if(avatar.dataset.keyboardProfileBound !== "1"){
                avatar.dataset.keyboardProfileBound = "1";
                avatar.addEventListener("keydown", function(event){
                    if(event.key === "Enter" || event.key === " "){
                        event.preventDefault();
                        avatar.click();
                    }
                });
            }
        }

        var menuButton = document.getElementById("mobileMenuBtn");
        if(menuButton){
            menuButton.setAttribute("aria-controls", "studentSidebar");
            menuButton.setAttribute("aria-expanded", document.body.classList.contains("mobile-menu-open") ? "true" : "false");
        }
    }

    function init(){
        if(!isPortalPage()) return;
        improveControls();
        makeBottomNav();
    }

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
