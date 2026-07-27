/* PGMO DTR MOBILE DATE LABELS 2026-07-20
   Replaces the phone card heading "Day 7" with a complete month/date label,
   while keeping the normal numeric Day column on desktop and printed DTRs.
*/
(function(){
    "use strict";

    function isDtrPage(){
        return document.body && document.body.dataset.page === "monthly-dtr";
    }

    function selectedMonth(){
        return document.getElementById("dtrMonth")?.value || "";
    }

    function parseMonth(value){
        if(!/^\d{4}-\d{2}$/.test(value)) return null;
        var parts = value.split("-").map(Number);
        if(!parts[0] || parts[1] < 1 || parts[1] > 12) return null;
        return { year:parts[0], month:parts[1] };
    }

    function ensureDayMarkup(cell, day){
        var number = cell.querySelector(".dtr-desktop-day");
        if(!number){
            number = document.createElement("span");
            number.className = "dtr-desktop-day";
            number.textContent = String(day);

            Array.from(cell.childNodes).forEach(function(node){
                if(node.nodeType === Node.TEXT_NODE && node.textContent.trim() === String(day)) node.remove();
            });
            cell.insertBefore(number, cell.firstChild);
        }

        var date = cell.querySelector(".dtr-mobile-date");
        if(!date){
            date = document.createElement("span");
            date.className = "dtr-mobile-date";
            cell.insertBefore(date, number);
        }

        var weekday = cell.querySelector(".dtr-mobile-weekday");
        if(!weekday){
            weekday = document.createElement("span");
            weekday.className = "dtr-mobile-weekday";
            date.insertAdjacentElement("afterend", weekday);
        }

        return { number:number, date:date, weekday:weekday };
    }

    function refreshLabels(){
        if(!isDtrPage()) return;
        var month = parseMonth(selectedMonth());
        document.querySelectorAll("#monthlyDtrRows tr[data-day]").forEach(function(row){
            var day = Number(row.dataset.day || 0);
            var cell = row.querySelector(".day-cell");
            if(!cell || !day) return;

            var parts = ensureDayMarkup(cell, day);
            if(!month){
                parts.date.textContent = "Select a month";
                parts.weekday.textContent = "Date " + day;
                return;
            }

            var date = new Date(month.year, month.month - 1, day, 12, 0, 0);
            if(date.getMonth() !== month.month - 1){
                parts.date.textContent = "";
                parts.weekday.textContent = "";
                return;
            }

            parts.date.textContent = date.toLocaleDateString("en-US", {
                month:"long",
                day:"numeric",
                year:"numeric"
            });
            parts.weekday.textContent = date.toLocaleDateString("en-US", { weekday:"long" });
            row.setAttribute("aria-label", parts.date.textContent + ", " + parts.weekday.textContent);
        });
    }

    function bind(){
        if(!isDtrPage()) return;
        var month = document.getElementById("dtrMonth");
        if(month && month.dataset.mobileDateLabelBound !== "1"){
            month.dataset.mobileDateLabelBound = "1";
            month.addEventListener("input", refreshLabels);
            month.addEventListener("change", refreshLabels);
        }

        var tbody = document.getElementById("monthlyDtrRows");
        if(tbody && tbody.dataset.mobileDateObserverBound !== "1"){
            tbody.dataset.mobileDateObserverBound = "1";
            new MutationObserver(function(){ refreshLabels(); }).observe(tbody, { childList:true });
        }

        refreshLabels();
        requestAnimationFrame(refreshLabels);
        setTimeout(refreshLabels, 100);
    }

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();
})();
