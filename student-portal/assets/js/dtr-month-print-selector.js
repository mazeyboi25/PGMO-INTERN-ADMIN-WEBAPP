/* PGMO DTR MONTH PRINT SELECTOR
   Adds month selection before printing DTR.
   Rule: max 2 months per PDF page. 3 months = page 1 has first 2, page 2 has third.
*/
(function(){
    "use strict";

    var STATE_KEY = "PGMO_DTR_MONTH_PRINT_STATE";

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
        else alert(message);
    }

    function safeText(value){
        return String(value === null || value === undefined ? "" : value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function valueOrBlank(value){
        if(value === null || value === undefined || value === "") return "";
        var number = Number(value);
        return Number.isFinite(number) && number > 0 ? String(value) : "";
    }

    function monthLabel(monthValue){
        if(!monthValue) return "";
        var parts = String(monthValue).split("-").map(Number);
        if(parts.length < 2 || !parts[0] || !parts[1]) return monthValue;
        return new Date(parts[0], parts[1] - 1, 1).toLocaleString("en-US", {
            month:"long",
            year:"numeric"
        });
    }

    function chunkPanels(panels){
        var pages = [];
        for(var i = 0; i < panels.length; i += 2){
            pages.push(panels.slice(i, i + 2));
        }
        return pages;
    }

    function getCurrentMonth(){
        return document.getElementById("dtrMonth")?.value || "";
    }

    function getCurrentDraftForm(student){
        var selectedMonth = getCurrentMonth();
        if(!selectedMonth || typeof window.getMonthlyDtrEntries !== "function") return null;

        var result = window.getMonthlyDtrEntries();
        if(!result || !Array.isArray(result.entries) || !result.entries.length) return null;

        if(result.entries.some(function(item){ return item && item.invalid; })){
            toast("Please fix invalid time entries before previewing your DTR.", "error");
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
            status: "Draft",
            created_at: new Date().toISOString()
        };
    }

    async function loadAllPrintableDtrForms(student){
        var forms = [];

        if(
            typeof window.initSupabase === "function" &&
            typeof window.getDtrFormsTable === "function"
        ){
            try{
                if(window.initSupabase() && typeof supabaseClient !== "undefined" && supabaseClient){
                    var response = await supabaseClient
                        .from(window.getDtrFormsTable())
                        .select("*")
                        .eq("student_id", student.id)
                        .order("month", { ascending:true })
                        .order("created_at", { ascending:true });

                    if(response.error){
                        console.warn("DTR month lookup failed:", response.error.message);
                    }else{
                        forms = response.data || [];
                    }
                }
            }catch(error){
                console.warn("DTR month lookup failed:", error);
            }
        }

        var draft = getCurrentDraftForm(student);
        if(draft === "invalid") return null;
        if(draft) forms.push(draft);

        return forms;
    }

    function getPrintableMonths(forms){
        var monthSet = new Set();
        (forms || []).forEach(function(form){
            if(form && form.month) monthSet.add(form.month);
        });
        return Array.from(monthSet).sort().map(function(month){
            return {
                value: month,
                label: monthLabel(month),
                count: (forms || []).filter(function(form){ return form.month === month; }).length
            };
        });
    }

    function compileMonth(forms, monthValue){
        var parts = String(monthValue).split("-").map(Number);
        var year = parts[0];
        var month = parts[1];
        var daysInMonth = new Date(year, month, 0).getDate();
        var monthForms = (forms || []).filter(function(form){ return form.month === monthValue; });
        var mergedEntries = {};

        monthForms.forEach(function(form){
            (form.entries || []).forEach(function(entry){
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

        var body = [];
        var totalHours = 0;

        for(var day = 1; day <= 31; day++){
            if(day > daysInMonth){
                body.push([String(day), "", "", "", "", "", ""]);
                continue;
            }

            var weekday = new Date(year, month - 1, day).getDay();
            if(weekday === 0){
                body.push([String(day), "SUN", "", "", "", "", ""]);
                continue;
            }
            if(weekday === 6){
                body.push([String(day), "SAT", "", "", "", "", ""]);
                continue;
            }

            var entry = mergedEntries[day] || {};
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
            year: year,
            monthNumber: month,
            daysInMonth: daysInMonth,
            forms: monthForms,
            body: body,
            totalHours: Number(totalHours.toFixed(2))
        };
    }

    function renderMonthSelector(months, selectedMonths){
        var selectedSet = new Set(selectedMonths || []);
        return `
            <div class="dtr-month-selector-card">
                <div class="dtr-month-selector-head">
                    <div>
                        <strong>Select DTR months to print</strong>
                        <span>Only two months are placed on one paper. Extra months continue on the next paper.</span>
                    </div>
                    <label class="dtr-month-select-all">
                        <input type="checkbox" id="dtrSelectAllMonths">
                        Select all
                    </label>
                </div>
                <div class="dtr-month-checkbox-grid">
                    ${months.map(function(month){
                        return `
                            <label class="dtr-month-checkbox">
                                <input type="checkbox" class="dtr-print-month-option" value="${safeText(month.value)}" ${selectedSet.has(month.value) ? "checked" : ""}>
                                <span>
                                    <strong>${safeText(month.label)}</strong>
                                    <small>${month.count} submitted record${month.count === 1 ? "" : "s"}</small>
                                </span>
                            </label>
                        `;
                    }).join("")}
                </div>
            </div>
        `;
    }

    function previewDateParts(panel, day){
        var date = new Date(panel.year, panel.monthNumber - 1, day, 12, 0, 0);
        return {
            full: date.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" }),
            weekday: date.toLocaleDateString("en-US", { weekday:"long" })
        };
    }

    function displayPreviewValue(value){
        return value === null || value === undefined || value === "" ? "—" : safeText(value);
    }

    function renderMobilePreviewDay(panel, row){
        var day = Number(row[0] || 0);
        if(!day || day > panel.daysInMonth) return "";

        var date = previewDateParts(panel, day);
        var weekendCode = row[1] === "SUN" || row[1] === "SAT" ? row[1] : "";
        var weekendLabel = weekendCode === "SUN" ? "Sunday" : (weekendCode === "SAT" ? "Saturday" : "");

        if(weekendLabel){
            return `
                <article class="dtr-preview-mobile-day-card is-weekend">
                    <div class="dtr-preview-mobile-day-head">
                        <div>
                            <strong>${safeText(date.full)}</strong>
                            <span>${safeText(date.weekday)}</span>
                        </div>
                        <em>Rest day</em>
                    </div>
                    <div class="dtr-preview-mobile-empty">${safeText(weekendLabel)} · No regular office hours</div>
                </article>
            `;
        }

        var hasTime = row.slice(1).some(function(value){ return value !== "" && value !== null && value !== undefined; });
        if(!hasTime){
            return `
                <article class="dtr-preview-mobile-day-card is-empty">
                    <div class="dtr-preview-mobile-day-head">
                        <div>
                            <strong>${safeText(date.full)}</strong>
                            <span>${safeText(date.weekday)}</span>
                        </div>
                        <em>No entry</em>
                    </div>
                    <div class="dtr-preview-mobile-empty">No DTR time recorded for this date.</div>
                </article>
            `;
        }

        var undertimeHours = row[5] === "" || row[5] === null || row[5] === undefined ? "0" : safeText(row[5]);
        var undertimeMinutes = row[6] === "" || row[6] === null || row[6] === undefined ? "0" : safeText(row[6]);
        return `
            <article class="dtr-preview-mobile-day-card has-time">
                <div class="dtr-preview-mobile-day-head">
                    <div>
                        <strong>${safeText(date.full)}</strong>
                        <span>${safeText(date.weekday)}</span>
                    </div>
                    <em>Recorded</em>
                </div>
                <div class="dtr-preview-mobile-shift">
                    <h5>A.M.</h5>
                    <div class="dtr-preview-mobile-values">
                        <div><span>Arrival</span><strong>${displayPreviewValue(row[1])}</strong></div>
                        <div><span>Departure</span><strong>${displayPreviewValue(row[2])}</strong></div>
                    </div>
                </div>
                <div class="dtr-preview-mobile-shift">
                    <h5>P.M.</h5>
                    <div class="dtr-preview-mobile-values">
                        <div><span>Arrival</span><strong>${displayPreviewValue(row[3])}</strong></div>
                        <div><span>Departure</span><strong>${displayPreviewValue(row[4])}</strong></div>
                    </div>
                </div>
                <div class="dtr-preview-mobile-undertime">
                    <span>Undertime</span>
                    <strong>${undertimeHours} hr · ${undertimeMinutes} min</strong>
                </div>
            </article>
        `;
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
                            ${panel.body.map(function(row){
                                return `<tr>${row.map(function(cell){ return `<td>${safeText(cell)}</td>`; }).join("")}</tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderPreviewPages(panels){
        if(!panels.length){
            return `
                <div class="empty-state">
                    <i class="fa fa-calendar-xmark"></i>
                    <h5>No month selected</h5>
                    <p>Select at least one DTR month to preview and print.</p>
                </div>
            `;
        }

        return chunkPanels(panels).map(function(pagePanels, index){
            return `
                <div class="dtr-preview-print-page">
                    <div class="dtr-preview-page-label">Paper ${index + 1}</div>
                    <div class="dtr-preview-grid ${pagePanels.length === 2 ? "two-months" : "one-month"}">
                        ${pagePanels.map(renderPreviewTable).join("")}
                    </div>
                </div>
            `;
        }).join("");
    }

    function getCheckedMonths(){
        return Array.from(document.querySelectorAll(".dtr-print-month-option:checked"))
            .map(function(input){ return input.value; })
            .sort();
    }

    function updatePreviewFromSelection(){
        var state = window[STATE_KEY];
        if(!state) return;

        var selectedMonths = getCheckedMonths();
        var panels = selectedMonths.map(function(month){
            return compileMonth(state.forms, month);
        }).filter(function(panel){
            return panel.forms.length || panel.totalHours > 0;
        });

        state.selectedMonths = selectedMonths;
        state.panels = panels;
        window[STATE_KEY] = state;

        var preview = document.getElementById("dtrSelectedMonthsPreview");
        if(preview) preview.innerHTML = renderPreviewPages(panels);

        var download = document.getElementById("downloadDtrFromPreviewButton");
        if(download) download.disabled = panels.length === 0;

        var selectAll = document.getElementById("dtrSelectAllMonths");
        var options = Array.from(document.querySelectorAll(".dtr-print-month-option"));
        if(selectAll && options.length){
            selectAll.checked = options.every(function(input){ return input.checked; });
            selectAll.indeterminate = options.some(function(input){ return input.checked; }) && !selectAll.checked;
        }

        var subtitle = document.getElementById("dtrPreviewSubtitle");
        if(subtitle){
            var mobileHint = window.matchMedia && window.matchMedia("(max-width:700px)").matches
                ? " · Swipe in any direction to view the desktop preview"
                : "";
            subtitle.textContent = panels.length
                ? `${panels.length} month${panels.length === 1 ? "" : "s"} selected · ${chunkPanels(panels).length} paper${chunkPanels(panels).length === 1 ? "" : "s"}${mobileHint}`
                : `Select at least one month to print.${mobileHint}`;
        }
    }

    function bindSelectorEvents(){
        document.querySelectorAll(".dtr-print-month-option").forEach(function(input){
            input.addEventListener("change", updatePreviewFromSelection);
        });

        var selectAll = document.getElementById("dtrSelectAllMonths");
        if(selectAll){
            selectAll.addEventListener("change", function(){
                document.querySelectorAll(".dtr-print-month-option").forEach(function(input){
                    input.checked = selectAll.checked;
                });
                updatePreviewFromSelection();
            });
        }
    }

    function closePreviewModal(){
        var modal = document.getElementById("dtrPreviewModal");
        if(modal){
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("dtr-preview-open");
    }

    function drawPanel(doc, panel, x, y, width){
        var center = x + (width / 2);
        var tableWidth = Math.min(310, width - 34);
        var tableLeft = center - (tableWidth / 2);
        var tableRight = center + (tableWidth / 2);

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

        var finalY = doc.lastAutoTable.finalY + 9;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.2);
        doc.text(`Total: ${panel.totalHours} hour(s)`, tableRight, finalY, { align:"right" });
    }

    function drawName(doc, student, pageWidth){
        var center = pageWidth / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.2);
        doc.text(student.name || "Student", center, 54, { align:"center", maxWidth: 430 });
        doc.setDrawColor(25, 25, 25);
        doc.line(center - 190, 59, center + 190, 59);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("(Name)", center, 67, { align:"center" });
    }

    function drawSignature(doc, pageWidth){
        var center = pageWidth / 2;
        var half = 170;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.text("I certify on my honor that the above is a true and correct report of the hours of work performed.", center, 448, { align:"center", maxWidth: 680 });
        doc.setDrawColor(25, 25, 25);
        doc.line(center - half, 496, center + half, 496);
        doc.text("Student Signature", center, 505, { align:"center" });
        doc.text("VERIFIED as to prescribed office hours:", center, 528, { align:"center" });
        doc.line(center - half, 558, center + half, 558);
        doc.text("In Charge", center, 567, { align:"center" });
    }

    function generateSelectedDtrPdf(state){
        if(!state || !state.panels || !state.panels.length){
            toast("Select at least one DTR month to download.", "error");
            return;
        }

        if(!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable){
            toast("PDF library is not loaded. Please reload the DTR page.", "error");
            return;
        }

        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF("l", "pt", "a4");
        var pages = chunkPanels(state.panels);

        pages.forEach(function(pagePanels, pageIndex){
            if(pageIndex > 0) doc.addPage("a4", "l");

            var pageWidth = doc.internal.pageSize.getWidth();
            var center = pageWidth / 2;
            var monthTitle = pagePanels.map(function(panel){ return panel.monthLabel; }).join(" and ");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("PGMO OJT DAILY TIME RECORD", center, 26, { align:"center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.text(`${monthTitle} · ${state.student.id || ""} · Paper ${pageIndex + 1} of ${pages.length}`, center, 39, { align:"center" });

            drawName(doc, state.student, pageWidth);

            if(pagePanels.length === 1){
                var singleWidth = 430;
                drawPanel(doc, pagePanels[0], center - (singleWidth / 2), 78, singleWidth);
            }else{
                var pageMargin = 46;
                var panelGap = 34;
                var panelWidth = (pageWidth - (pageMargin * 2) - panelGap) / 2;
                var leftX = pageMargin;
                var rightX = pageMargin + panelWidth + panelGap;

                drawPanel(doc, pagePanels[0], leftX, 78, panelWidth);
                doc.setDrawColor(180, 180, 180);
                doc.line(center, 76, center, 432);
                drawPanel(doc, pagePanels[1], rightX, 78, panelWidth);
            }

            drawSignature(doc, pageWidth);
        });

        var safeStudentId = String(state.student.id || "student").replace(/[^a-zA-Z0-9_-]/g, "");
        var safeMonths = state.panels.map(function(panel){ return panel.month; }).join("_");
        doc.save(`DTR_${safeStudentId}_${safeMonths}.pdf`);
    }

    function replaceDownloadButton(){
        var button = document.getElementById("downloadDtrFromPreviewButton");
        if(!button) return null;

        var cleanButton = button.cloneNode(true);
        cleanButton.id = "downloadDtrFromPreviewButton";
        cleanButton.type = "button";
        cleanButton.innerHTML = '<i class="fa fa-download"></i> Download DTR PDF';
        button.replaceWith(cleanButton);
        cleanButton.addEventListener("click", function(event){
            stop(event);
            updatePreviewFromSelection();
            generateSelectedDtrPdf(window[STATE_KEY]);
            return false;
        });
        return cleanButton;
    }

    function bindModalCloseButtons(){
        document.querySelectorAll("[data-close-dtr-preview]").forEach(function(button){
            button.onclick = function(event){
                stop(event);
                closePreviewModal();
                return false;
            };
        });

        var modal = document.getElementById("dtrPreviewModal");
        if(modal && modal.dataset.monthSelectorCloseBound !== "1"){
            modal.dataset.monthSelectorCloseBound = "1";
            modal.addEventListener("click", function(event){
                if(event.target === modal) closePreviewModal();
            });
        }
    }

    async function openMonthPrintSelector(event){
        stop(event);

        if(!isDtrPage()) return false;
        if(typeof window.getStudent !== "function"){
            toast("Student session was not found. Please log in again.", "error");
            return false;
        }

        var button = document.getElementById("downloadJointDtrPdfButton");
        var originalHtml = button ? button.innerHTML : "";
        if(button){
            button.disabled = true;
            button.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Loading months...';
        }

        try{
            var student = window.getStudent();
            var forms = await loadAllPrintableDtrForms(student);
            if(forms === null) return false;

            var months = getPrintableMonths(forms);
            if(!months.length){
                toast("No DTR entries found. Input or submit at least one DTR month first.", "error");
                return false;
            }

            var currentMonth = getCurrentMonth();
            var selectedMonths = months.some(function(item){ return item.value === currentMonth; })
                ? [currentMonth]
                : months.map(function(item){ return item.value; });

            var panels = selectedMonths.map(function(month){ return compileMonth(forms, month); });
            var state = { student: student, forms: forms, months: months, selectedMonths: selectedMonths, panels: panels };
            window[STATE_KEY] = state;

            var modal = document.getElementById("dtrPreviewModal");
            var body = document.getElementById("dtrPreviewBody");
            var title = document.getElementById("dtrPreviewTitle");
            var subtitle = document.getElementById("dtrPreviewSubtitle");

            if(!modal || !body){
                generateSelectedDtrPdf(state);
                return false;
            }

            if(title) title.textContent = "Select DTR Months to Print";
            if(subtitle) subtitle.textContent = "Choose one or more months. Two months will print per paper.";

            body.innerHTML = `
                <div class="dtr-preview-student">
                    <strong>${safeText(student.name || "Student")}</strong>
                    <span>${safeText(student.id || "")}</span>
                </div>
                ${renderMonthSelector(months, selectedMonths)}
                <div class="dtr-preview-mobile-guide" role="note">
                    <i class="fa fa-hand-pointer" aria-hidden="true"></i>
                    <span>Swipe left or right to view the full table, and swipe up or down to review all dates.</span>
                </div>
                <div id="dtrSelectedMonthsPreview" class="dtr-selected-months-preview">
                    ${renderPreviewPages(panels)}
                </div>
            `;

            bindSelectorEvents();
            replaceDownloadButton();
            bindModalCloseButtons();
            updatePreviewFromSelection();

            modal.classList.add("show");
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("dtr-preview-open");
        }finally{
            if(button){
                button.disabled = false;
                button.innerHTML = originalHtml || '<i class="fa fa-print"></i> Print DTR';
            }
        }

        return false;
    }

    function normalizePrintButton(){
        if(!isDtrPage()) return;
        var print = document.getElementById("downloadJointDtrPdfButton");
        if(print){
            print.type = "button";
            print.removeAttribute("href");
            print.removeAttribute("form");
            print.removeAttribute("formaction");
            print.removeAttribute("formmethod");
            print.onclick = openMonthPrintSelector;
        }
    }

    window.PGMO_DTR_MONTH_PRINT_SELECTOR = openMonthPrintSelector;
    window.PGMO_DTR_PREVIEW = openMonthPrintSelector;
    window.PGMO_DTR_FORCE_PRINT_PREVIEW = openMonthPrintSelector;
    window.PGMO_DTR_NO_REFRESH_PREVIEW = openMonthPrintSelector;
    window.PGMO_DTR_HARD_PREVIEW = openMonthPrintSelector;
    window.PGMO_PRINT_DTR_PREVIEW_NOW = openMonthPrintSelector;

    document.addEventListener("click", function(event){
        if(!isDtrPage()) return;
        var print = event.target && event.target.closest ? event.target.closest("#downloadJointDtrPdfButton") : null;
        if(print) return openMonthPrintSelector(event);
    }, true);

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", normalizePrintButton);
    }else{
        normalizePrintButton();
    }

    window.addEventListener("load", normalizePrintButton);
    setTimeout(normalizePrintButton, 250);
    setTimeout(normalizePrintButton, 900);
})();
