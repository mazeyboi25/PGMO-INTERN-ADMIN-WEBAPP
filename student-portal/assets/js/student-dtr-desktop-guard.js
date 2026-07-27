/* PGMO STUDENT DTR DESKTOP GUARD 2026-07-01
   Fixes the desktop-only issue where an invisible same-page DTR layer/link can catch clicks,
   causing refresh instead of Clear or Preview. Mobile layout is not changed. */
(function(){
    "use strict";

    function isDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function hardStop(event){
        if(!event) return;
        event.preventDefault();
        event.stopPropagation();
        if(typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    function notify(message, type){
        if(typeof window.showToast === "function"){
            window.showToast(message, type || "info");
            return;
        }
        console.warn(message);
    }

    function pointInside(element, event){
        if(!element || !event || typeof event.clientX !== "number" || typeof event.clientY !== "number") return false;
        var rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    function getActionFromEvent(event){
        var target = event.target && event.target.closest ? event.target : null;
        if(target){
            if(target.closest("#clearDtrButton")) return "clear";
            if(target.closest("#downloadJointDtrPdfButton")) return "preview";
        }

        /* Desktop safety: if a transparent/oversized layer catches the click, the click target
           may be the form/card/sidebar link instead of the real button. Use the actual pointer
           position against the visible button rectangles. */
        if(pointInside(document.getElementById("clearDtrButton"), event)) return "clear";
        if(pointInside(document.getElementById("downloadJointDtrPdfButton"), event)) return "preview";

        return "";
    }

    function normalizeButtons(){
        if(!isDtrPage()) return;

        var clearButton = document.getElementById("clearDtrButton");
        var printButton = document.getElementById("downloadJointDtrPdfButton");

        [clearButton, printButton].forEach(function(button){
            if(!button) return;
            button.setAttribute("type", "button");
            button.removeAttribute("form");
            button.removeAttribute("formaction");
            button.removeAttribute("formmethod");
            button.removeAttribute("href");
            button.style.cursor = "pointer";
        });

        if(clearButton){
            clearButton.setAttribute("aria-label", "Clear DTR entries");
        }
        if(printButton){
            printButton.setAttribute("aria-label", "Preview and print DTR");
        }

        /* The current DTR sidebar link should not reload the same page. If a desktop CSS layer
           accidentally stretches it over the main content, pointer-events:none lets the DTR
           buttons below receive the click. */
        document.querySelectorAll('.portal-menu a.active[href="dtr.html"], .portal-menu a.active[href$="/dtr.html"]').forEach(function(link){
            link.addEventListener("click", function(event){
                event.preventDefault();
                event.stopPropagation();
            }, true);
        });
    }

    function clearDtr(event){
        hardStop(event);

        if(typeof window.clearMonthlyDtr === "function"){
            window.clearMonthlyDtr();
        }else{
            document.querySelectorAll("#monthlyDtrRows input").forEach(function(input){
                input.value = "";
                input.dispatchEvent(new Event("input", { bubbles:true }));
            });
            if(typeof window.updateMonthlyDtrTotal === "function") window.updateMonthlyDtrTotal();
            else {
                var total = document.getElementById("monthlyDtrTotal");
                if(total) total.textContent = "0 hours";
            }
        }

        return false;
    }

    function fallbackPreview(){
        var modal = document.getElementById("dtrPreviewModal");
        var body = document.getElementById("dtrPreviewBody");
        var title = document.getElementById("dtrPreviewTitle");
        var subtitle = document.getElementById("dtrPreviewSubtitle");
        var month = document.getElementById("dtrMonth") ? document.getElementById("dtrMonth").value : "";
        var studentName = document.getElementById("dtrName") ? document.getElementById("dtrName").value : "Student";
        var rows = Array.from(document.querySelectorAll("#monthlyDtrRows tr"));
        var hasEntry = rows.some(function(row){
            return Array.from(row.querySelectorAll("input")).some(function(input){ return input.value.trim(); });
        });

        if(!hasEntry){
            notify("Input at least one DTR entry before printing.", "error");
            return;
        }
        if(!modal || !body){
            notify("DTR preview modal was not found.", "error");
            return;
        }

        if(title) title.textContent = "DTR Preview";
        if(subtitle) subtitle.textContent = month || "Selected month";

        var tableRows = rows.map(function(row){
            var cells = Array.from(row.children).map(function(cell){
                var input = cell.querySelector("input");
                return "<td>" + escapeHtml(input ? input.value : cell.textContent.trim()) + "</td>";
            }).join("");
            return "<tr>" + cells + "</tr>";
        }).join("");

        body.innerHTML =
            '<div class="dtr-preview-student"><strong>' + escapeHtml(studentName || "Student") + '</strong><span>' + escapeHtml(month || "") + '</span></div>' +
            '<div class="dtr-preview-grid one-month"><div class="dtr-preview-panel"><div class="dtr-preview-table-wrap">' +
            '<table class="dtr-preview-table"><tbody>' + tableRows + '</tbody></table>' +
            '</div></div></div>';

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("dtr-preview-open");
    }

    function escapeHtml(value){
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async function previewDtr(event){
        hardStop(event);
        normalizeButtons();

        try{
            if(typeof window.PGMO_DTR_PREVIEW === "function"){
                await window.PGMO_DTR_PREVIEW(null);
                var modal = document.getElementById("dtrPreviewModal");
                if(modal && modal.classList.contains("show")) return false;
            }
        }catch(error){
            console.warn("Primary DTR preview failed. Using fallback preview.", error);
        }

        fallbackPreview();
        return false;
    }

    function handleClick(event){
        if(!isDtrPage()) return;

        var action = getActionFromEvent(event);
        if(action === "clear") return clearDtr(event);
        if(action === "preview") return previewDtr(event);

        /* Stop the current-page DTR link from refreshing the page. This is also a guard for the
           desktop bug where that link can act like an invisible overlay. */
        var sameDtrLink = event.target && event.target.closest
            ? event.target.closest('.portal-menu a.active[href="dtr.html"], .portal-menu a.active[href$="/dtr.html"]')
            : null;
        if(sameDtrLink){
            hardStop(event);
            return false;
        }
    }

    function handleSubmit(event){
        if(!isDtrPage()) return;
        if(!event.target || event.target.id !== "monthlyDtrForm") return;

        var submitter = event.submitter || document.activeElement;
        if(submitter && (submitter.id === "clearDtrButton" || submitter.id === "downloadJointDtrPdfButton")){
            hardStop(event);
            return false;
        }
    }

    window.addEventListener("click", handleClick, true);
    window.addEventListener("submit", handleSubmit, true);
    document.addEventListener("DOMContentLoaded", normalizeButtons);
    window.addEventListener("load", normalizeButtons);
    setTimeout(normalizeButtons, 100);
    setTimeout(normalizeButtons, 800);
})();
