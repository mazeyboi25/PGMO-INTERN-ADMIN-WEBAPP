/* PGMO STUDENT DTR RELOCATED ACTIONS 2026-07-01
   One clean binding for the moved Clear and Print DTR buttons. */
(function(){
    "use strict";

    function isDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function stop(event){
        if(!event) return;
        event.preventDefault();
        event.stopPropagation();
        if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    function toast(message, type){
        if(typeof window.showToast === "function") window.showToast(message, type || "info");
        else console.warn(message);
    }

    function clearDtr(event){
        stop(event);

        if(typeof window.clearMonthlyDtr === "function"){
            window.clearMonthlyDtr();
            return false;
        }

        document.querySelectorAll("#monthlyDtrRows input").forEach(function(input){
            input.value = "";
            input.dispatchEvent(new Event("input", { bubbles:true }));
        });

        var notes = document.getElementById("dtrNotes");
        if(notes) notes.value = "";

        if(typeof window.updateMonthlyDtrTotal === "function") window.updateMonthlyDtrTotal();
        else {
            var total = document.getElementById("monthlyDtrTotal");
            if(total) total.textContent = "0 hours";
        }

        return false;
    }

    async function printDtr(event){
        stop(event);

        if(typeof window.PGMO_DTR_PREVIEW === "function"){
            await window.PGMO_DTR_PREVIEW(event || null);
            return false;
        }

        if(typeof window.PGMO_PRINT_DTR_PREVIEW_NOW === "function"){
            await window.PGMO_PRINT_DTR_PREVIEW_NOW(event || null);
            return false;
        }

        toast("DTR preview is still loading. Please wait a moment and try again.", "warning");
        return false;
    }

    function prepareButton(button, handler){
        if(!button || button.dataset.relocatedDtrBound === "1") return;
        button.dataset.relocatedDtrBound = "1";
        button.type = "button";
        button.removeAttribute("onclick");
        button.removeAttribute("href");
        button.removeAttribute("form");
        button.removeAttribute("formaction");
        button.removeAttribute("formmethod");
        button.addEventListener("click", handler, true);
        button.addEventListener("touchend", handler, { capture:true, passive:false });
    }

    function bind(){
        if(!isDtrPage()) return;

        document.querySelectorAll('.portal-menu a.active[href="dtr.html"], .portal-menu a.active[href$="/dtr.html"]').forEach(function(link){
            link.setAttribute("href", "javascript:void(0)");
            link.classList.add("current-page-link");
        });

        prepareButton(document.getElementById("clearDtrButton"), clearDtr);
        prepareButton(document.getElementById("downloadJointDtrPdfButton"), printDtr);

        var form = document.getElementById("monthlyDtrForm");
        if(form && form.dataset.dtrSubmitGuard !== "1"){
            form.dataset.dtrSubmitGuard = "1";
            form.addEventListener("submit", function(event){
                var submitter = event.submitter || document.activeElement;
                if(submitter && (submitter.id === "clearDtrButton" || submitter.id === "downloadJointDtrPdfButton")){
                    stop(event);
                    return false;
                }
            }, true);
        }
    }

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();

    window.addEventListener("load", bind);
    setTimeout(bind, 250);
    setTimeout(bind, 900);
    setTimeout(bind, 1800);
})();
