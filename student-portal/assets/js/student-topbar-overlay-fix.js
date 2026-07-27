/* PGMO FINAL STUDENT TOPBAR OVERLAY FIX 2026-07-02
   Keeps hidden notification elements from catching clicks/scrolls.
   This file is student-portal only. */
(function(){
    "use strict";

    function isPortalPage(){
        return document.body && document.body.classList.contains("portal-body");
    }

    function dropdown(){
        return document.getElementById("liveNotificationDropdown");
    }

    function bell(){
        return document.querySelector(".top-actions .top-icon");
    }

    function isOpen(){
        return document.body && document.body.classList.contains("live-notification-open");
    }

    function setImportant(el, prop, value){
        if(el) el.style.setProperty(prop, value, "important");
    }

    function closeDropdown(){
        if(!document.body) return;
        document.body.classList.remove("live-notification-open");
        const b = bell();
        const d = dropdown();
        if(b) b.setAttribute("aria-expanded", "false");
        if(d) d.setAttribute("aria-hidden", "true");
        applyDropdownState();
    }

    function applyDropdownState(){
        if(!isPortalPage()) return;
        const d = dropdown();
        const b = bell();
        if(!d) return;

        d.setAttribute("aria-hidden", isOpen() ? "false" : "true");
        if(b) b.setAttribute("aria-expanded", isOpen() ? "true" : "false");

        if(isOpen()){
            setImportant(d, "display", "flex");
            setImportant(d, "visibility", "visible");
            setImportant(d, "opacity", "1");
            setImportant(d, "pointer-events", "auto");
            setImportant(d, "overflow", "hidden");
        }else{
            setImportant(d, "display", "none");
            setImportant(d, "visibility", "hidden");
            setImportant(d, "opacity", "0");
            setImportant(d, "pointer-events", "none");
            setImportant(d, "overflow", "hidden");
        }
    }

    function normalizeBellButton(){
        document.querySelectorAll(".top-actions a.top-icon").forEach(function(anchor){
            const button = document.createElement("button");
            button.type = "button";
            button.className = anchor.className;
            button.innerHTML = anchor.innerHTML;
            button.setAttribute("aria-haspopup", anchor.getAttribute("aria-haspopup") || "true");
            button.setAttribute("aria-expanded", anchor.getAttribute("aria-expanded") || "false");
            button.setAttribute("aria-label", anchor.getAttribute("aria-label") || "Open notifications");
            anchor.replaceWith(button);
        });
    }

    function bindGuards(){
        if(!isPortalPage() || document.body.dataset.pgmoTopbarOverlayFixed === "1") return;
        document.body.dataset.pgmoTopbarOverlayFixed = "1";

        document.addEventListener("click", function(event){
            const d = dropdown();
            const clickedBell = event.target.closest(".top-actions .top-icon");
            const clickedDropdown = event.target.closest("#liveNotificationDropdown");
            const clickedTopAvatar = event.target.closest(".top-actions .top-avatar");
            const clickedRealControl = event.target.closest("a, button, input, select, textarea, label, [role='button']");
            const clickedPortalTop = event.target.closest(".portal-top");

            // Hidden dropdowns must never receive clicks or redirect to DTR/Notifications.
            if(clickedDropdown && !isOpen()){
                event.preventDefault();
                event.stopPropagation();
                if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
                closeDropdown();
                return false;
            }

            // Empty parts of the header must not act like links.
            if(clickedPortalTop && !clickedBell && !clickedDropdown && !clickedTopAvatar && !clickedRealControl){
                event.preventDefault();
                event.stopPropagation();
                return false;
            }

            // Keep display state accurate after the old notification scripts toggle classes.
            setTimeout(applyDropdownState, 0);
            setTimeout(applyDropdownState, 40);
        }, true);

        document.addEventListener("scroll", function(){
            if(!isOpen()) applyDropdownState();
        }, true);

        document.addEventListener("keydown", function(event){
            if(event.key === "Escape") closeDropdown();
        }, true);
    }

    function init(){
        if(!isPortalPage()) return;
        normalizeBellButton();
        applyDropdownState();
        bindGuards();

        // PERFORMANCE FIX: no body-wide MutationObserver here.
        // The previous observer ran on large page changes and could make weak devices freeze.
        setTimeout(applyDropdownState, 100);
        setTimeout(applyDropdownState, 500);
        setTimeout(applyDropdownState, 1200);
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", init);
    }else{
        init();
    }
})();
