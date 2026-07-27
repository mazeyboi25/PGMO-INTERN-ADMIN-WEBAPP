/* PGMO DTR PHONE INTERACTION FIX 2026-07-20
   Removes duplicate mobile-menu touch handlers and clears stale scroll locks.
   Student portal only; no database behavior is changed. */
(function(){
    "use strict";

    function isDtrPage(){
        return document.body && document.body.dataset.page === "monthly-dtr";
    }

    function isPhone(){
        return window.matchMedia("(max-width: 900px)").matches;
    }

    function previewIsOpen(){
        var modal = document.getElementById("dtrPreviewModal");
        return Boolean(modal && modal.classList.contains("show") && modal.getAttribute("aria-hidden") !== "true");
    }

    function syncPreviewInteractionState(){
        if(!isDtrPage() || !isPhone()) return;

        var modal = document.getElementById("dtrPreviewModal");
        if(!modal) return;

        var open = previewIsOpen();
        var wasOpen = modal.dataset.pgmoPreviewWasOpen === "1";
        document.documentElement.classList.toggle("dtr-preview-open", open);
        modal.dataset.pgmoPreviewWasOpen = open ? "1" : "0";

        /* A previous phone patch disabled pointer events on the closed modal.
           The modal was later shown without clearing that inline rule, so it
           looked open while blocking every tap and swipe. Keep the state in
           sync whenever the modal's class or aria-hidden value changes. */
        modal.style.setProperty("pointer-events", open ? "auto" : "none", "important");
        modal.style.setProperty("visibility", open ? "visible" : "hidden", "important");
        modal.style.setProperty("opacity", open ? "1" : "0", "important");

        var previewBody = document.getElementById("dtrPreviewBody");
        if(previewBody){
            previewBody.style.setProperty("touch-action", open ? "pan-x pan-y" : "auto", "important");
            if(open && !wasOpen){
                requestAnimationFrame(function(){
                    previewBody.scrollTo({ top:0, left:0, behavior:"auto" });
                });
            }
        }
    }

    function clearStaleScrollLocks(){
        if(!isDtrPage() || !isPhone()) return;

        if(!previewIsOpen()){
            document.body.classList.remove("dtr-preview-open", "modal-open");
            var modal = document.getElementById("dtrPreviewModal");
            if(modal){
                modal.setAttribute("aria-hidden", "true");
            }
        }

        syncPreviewInteractionState();

        if(!document.body.classList.contains("live-notification-open")){
            var dropdown = document.getElementById("liveNotificationDropdown");
            if(dropdown){
                dropdown.setAttribute("aria-hidden", "true");
                dropdown.style.pointerEvents = "none";
            }
        }
    }

    function installStablePhoneMenu(){
        if(!isDtrPage() || !isPhone()) return;

        var oldButton = document.getElementById("mobileMenuBtn");
        var sidebar = document.querySelector(".portal-sidebar");
        if(!oldButton || !sidebar || oldButton.dataset.pgmoDtrStableMenu === "1") return;

        /* student.js previously attached both click and touchend handlers. On
           real phones one tap could toggle twice. Replacing the button removes
           those duplicate handlers while keeping the same markup and ID. */
        var button = oldButton.cloneNode(true);
        button.dataset.pgmoDtrStableMenu = "1";
        oldButton.replaceWith(button);

        var icon = button.querySelector("i");
        var label = button.querySelector("span");

        function setOpen(open){
            document.body.classList.toggle("mobile-menu-open", open);
            button.setAttribute("aria-expanded", open ? "true" : "false");
            sidebar.setAttribute("aria-hidden", open ? "false" : "true");

            if(icon){
                icon.classList.toggle("fa-bars", !open);
                icon.classList.toggle("fa-xmark", open);
            }
            if(label) label.textContent = open ? "Close" : "Menu";
        }

        function close(){
            setOpen(false);
        }

        button.addEventListener("click", function(event){
            event.preventDefault();
            event.stopPropagation();
            if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
            setOpen(!document.body.classList.contains("mobile-menu-open"));
        }, true);

        sidebar.addEventListener("click", function(event){
            if(event.target.closest("a")) close();
        });

        document.addEventListener("click", function(event){
            if(!document.body.classList.contains("mobile-menu-open")) return;
            if(button.contains(event.target) || sidebar.contains(event.target)) return;
            close();
        });

        window.addEventListener("resize", function(){
            if(!isPhone()) close();
            clearStaleScrollLocks();
        }, { passive:true });

        window.pgmoCloseStudentMobileMenu = close;
        setOpen(false);
    }

    function keepInputsUsable(){
        if(!isDtrPage() || !isPhone()) return;

        document.querySelectorAll("#monthlyDtrRows input:not([readonly]):not([disabled])").forEach(function(input){
            if(input.dataset.pgmoPhoneInputReady === "1") return;
            input.dataset.pgmoPhoneInputReady = "1";
            input.addEventListener("focus", function(){
                setTimeout(function(){
                    var rect = input.getBoundingClientRect();
                    if(rect.top < 88 || rect.bottom > window.innerHeight - 92){
                        input.scrollIntoView({ behavior:"smooth", block:"center", inline:"nearest" });
                    }
                }, 180);
            });
        });
    }

    function init(){
        if(!isDtrPage()) return;
        clearStaleScrollLocks();
        installStablePhoneMenu();
        keepInputsUsable();

        var rows = document.getElementById("monthlyDtrRows");
        if(rows){
            new MutationObserver(function(){
                keepInputsUsable();
                clearStaleScrollLocks();
            }).observe(rows, { childList:true, subtree:true });
        }

        var previewModal = document.getElementById("dtrPreviewModal");
        if(previewModal){
            new MutationObserver(syncPreviewInteractionState).observe(previewModal, {
                attributes:true,
                attributeFilter:["class", "aria-hidden"]
            });
        }

        syncPreviewInteractionState();
        window.addEventListener("pageshow", clearStaleScrollLocks, { passive:true });
        document.addEventListener("visibilitychange", function(){
            if(!document.hidden) clearStaleScrollLocks();
        });
    }

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
