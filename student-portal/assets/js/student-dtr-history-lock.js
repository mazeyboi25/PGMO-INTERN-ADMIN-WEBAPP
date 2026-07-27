/* PGMO DTR SAVED-ENTRY VIEW + DUPLICATE-DAY LOCK
   Loads previously submitted times, keeps them visible, and prevents the
   same date from being submitted twice. No database file is changed.
*/
(function(){
    "use strict";

    var state = {
        month: "",
        token: 0,
        ready: false,
        savedDays: new Set(),
        savedEntries: {},
        forms: [],
        submittingDay: 0
    };

    function onDtrPage(){
        return document.body && document.body.dataset.page === "monthly-dtr";
    }

    function toast(message, type){
        if(typeof window.showToast === "function") window.showToast(message, type || "info");
        else console.warn(message);
    }

    function safe(value){
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function rows(){
        return Array.from(document.querySelectorAll("#monthlyDtrRows tr[data-day]"));
    }

    function submitButtons(){
        return Array.from(document.querySelectorAll(
            "#submitMonthlyDtrButton, #submitDtrTopButton, .dtr-card-submit-button"
        ));
    }

    function monthValue(){
        return document.getElementById("dtrMonth")?.value || "";
    }

    function ensureNotice(){
        var notice = document.getElementById("dtrSavedEntriesNotice");
        if(notice) return notice;
        var paper = document.querySelector(".dtr-paper");
        if(!paper) return null;
        notice = document.createElement("div");
        notice.id = "dtrSavedEntriesNotice";
        notice.className = "dtr-saved-entries-notice loading";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        paper.insertBefore(notice, paper.firstChild);
        return notice;
    }

    function notice(kind, html){
        var box = ensureNotice();
        if(!box) return;
        box.className = "dtr-saved-entries-notice " + kind;
        box.innerHTML = html;
    }

    function setBusy(busy, failed){
        var form = document.getElementById("monthlyDtrForm");
        if(form){
            form.classList.toggle("dtr-history-loading", !!busy);
            form.dataset.dtrHistoryReady = (!busy && !failed) ? "1" : "0";
        }

        rows().forEach(function(row){
            row.querySelectorAll("input").forEach(function(input){
                if(busy){
                    input.dataset.historyWasDisabled = input.disabled ? "1" : "0";
                    input.disabled = true;
                }else if(input.dataset.pgmoLocked !== "1"){
                    input.disabled = input.dataset.historyWasDisabled === "1";
                    delete input.dataset.historyWasDisabled;
                }
            });
        });

        submitButtons().forEach(function(button){
            button.disabled = !!busy || !!failed;
            if(button.disabled) button.setAttribute("aria-disabled", "true");
            else button.removeAttribute("aria-disabled");
        });

        syncCardSubmitButtons();
    }

    function resetRows(){
        rows().forEach(function(row){
            row.classList.remove("dtr-row-submitted", "dtr-row-approved", "dtr-row-pending", "dtr-row-rejected", "dtr-weekend-row", "dtr-current-entry");
            row.removeAttribute("data-pgmo-submitted");
            row.removeAttribute("data-pgmo-status");
            row.querySelector(".dtr-row-lock-badge")?.remove();
            row.querySelectorAll("td").forEach(function(cell){
                cell.classList.remove("dtr-weekend-hidden-cell");
            });
            row.querySelectorAll("input").forEach(function(input){
                input.readOnly = false;
                input.disabled = false;
                input.classList.remove("dtr-saved-input");
                input.removeAttribute("aria-readonly");
                input.removeAttribute("title");
                input.removeAttribute("tabindex");
                delete input.dataset.pgmoLocked;
                delete input.dataset.pgmoWeekendDisabled;
                delete input.dataset.historyWasDisabled;
            });
        });
    }

    function decorateWeekends(month){
        if(!/^\d{4}-\d{2}$/.test(month)) return;
        var parts = month.split("-").map(Number);
        var daysInMonth = new Date(parts[0], parts[1], 0).getDate();

        rows().forEach(function(row){
            var day = Number(row.dataset.day || 0);
            if(!day || day > daysInMonth) return;
            var weekday = new Date(parts[0], parts[1] - 1, day).getDay();
            if(weekday !== 0 && weekday !== 6) return;

            row.classList.add("dtr-weekend-row");
            var cells = row.querySelectorAll("td");
            for(var i = 2; i < Math.min(cells.length, 7); i++){
                if(!cells[i].classList.contains("dtr-card-submit-cell")){
                    cells[i].classList.add("dtr-weekend-hidden-cell");
                }
            }
            row.querySelectorAll('[data-field="undertime_hours"], [data-field="undertime_minutes"]').forEach(function(input){
                input.value = "";
                input.disabled = true;
                input.dataset.pgmoWeekendDisabled = "1";
            });
        });
    }

    function mergeForms(forms){
        var merged = {};
        (forms || []).forEach(function(form){
            (form.entries || []).forEach(function(entry){
                var day = Number(entry?.day || 0);
                if(!day) return;
                merged[day] = {
                    day: day,
                    am_in: entry.am_in || "",
                    am_out: entry.am_out || "",
                    pm_in: entry.pm_in || "",
                    pm_out: entry.pm_out || "",
                    undertime_hours: entry.manual_undertime_hours ?? entry.undertime_hours ?? 0,
                    undertime_minutes: entry.manual_undertime_minutes ?? entry.undertime_minutes ?? 0,
                    hours: Number(entry.hours || 0),
                    status: String(form.status || "Submitted")
                };
            });
        });
        return merged;
    }

    function applyWeekendValues(row, entry){
        var cells = row.querySelectorAll("td");
        var values = [entry.am_in, entry.am_out, entry.pm_in, entry.pm_out];
        var labels = ["AM Arrival", "AM Departure", "PM Arrival", "PM Departure"];
        values.forEach(function(value, index){
            var cell = cells[index + 1];
            if(!cell) return;
            cell.classList.remove("dtr-weekend-hidden-cell");
            cell.innerHTML = value
                ? '<span class="dtr-weekend-saved-time" aria-label="' + labels[index] + '">' + safe(value) + '</span>'
                : '<span class="dtr-weekend-saved-time empty" aria-hidden="true">—</span>';
        });
    }

    function lockRow(row, entry){
        var status = String(entry.status || "Submitted");
        var statusClass = status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        row.dataset.pgmoSubmitted = "1";
        row.dataset.pgmoStatus = status;
        row.classList.add("dtr-row-submitted", "dtr-row-" + statusClass);

        var dayCell = row.querySelector(".day-cell");
        if(dayCell){
            var badge = document.createElement("span");
            badge.className = "dtr-row-lock-badge";
            badge.innerHTML = '<i class="fa fa-lock" aria-hidden="true"></i><span>' + safe(status) + '</span>';
            dayCell.appendChild(badge);
        }

        if(row.classList.contains("dtr-weekend-row")) applyWeekendValues(row, entry);

        var values = {
            am_in: entry.am_in,
            am_out: entry.am_out,
            pm_in: entry.pm_in,
            pm_out: entry.pm_out,
            undertime_hours: entry.undertime_hours,
            undertime_minutes: entry.undertime_minutes
        };

        Object.keys(values).forEach(function(field){
            var input = row.querySelector('[data-field="' + field + '"]');
            if(!input) return;
            input.value = values[field] === null || values[field] === undefined ? "" : String(values[field]);
            if(input.value) input.closest("td")?.classList.remove("dtr-weekend-hidden-cell");
            input.readOnly = true;
            input.disabled = false;
            input.dataset.pgmoLocked = "1";
            input.classList.add("dtr-saved-input");
            input.setAttribute("aria-readonly", "true");
            input.setAttribute("title", "Previously submitted time. This date is locked.");
            input.setAttribute("tabindex", "-1");
        });
    }

    async function fetchForms(month){
        if(typeof window.initSupabase !== "function" || !window.initSupabase()) throw new Error("Supabase is unavailable.");
        if(typeof supabaseClient === "undefined" || !supabaseClient) throw new Error("Supabase did not initialize.");
        var student = typeof window.getStudent === "function" ? window.getStudent() : null;
        if(!student?.id) throw new Error("Student session was not found.");
        var table = typeof window.getDtrFormsTable === "function" ? window.getDtrFormsTable() : "ojt_dtr_forms";
        var response = await supabaseClient
            .from(table)
            .select("*")
            .eq("student_id", student.id)
            .eq("month", month)
            .order("created_at", { ascending:true });
        if(response.error) throw response.error;
        return response.data || [];
    }

    async function load(options){
        options = options || {};
        if(!onDtrPage()) return [];

        var month = monthValue();
        var token = ++state.token;
        state.month = month;
        state.ready = false;
        state.savedDays = new Set();
        state.savedEntries = {};
        state.forms = [];

        resetRows();
        decorateWeekends(month);

        if(!month){
            setBusy(false, true);
            notice("warning", '<i class="fa fa-calendar-day" aria-hidden="true"></i><span>Select a month to load your saved entries.</span>');
            return [];
        }

        setBusy(true, false);
        notice("loading", '<i class="fa fa-circle-notch fa-spin" aria-hidden="true"></i><span>Checking previously submitted times…</span>');

        try{
            var forms = await fetchForms(month);
            if(token !== state.token || month !== monthValue()) return [];

            state.forms = forms;
            state.savedEntries = mergeForms(forms);
            Object.keys(state.savedEntries).forEach(function(dayKey){
                var day = Number(dayKey);
                var row = document.querySelector('#monthlyDtrRows tr[data-day="' + day + '"]');
                if(!row) return;
                state.savedDays.add(day);
                lockRow(row, state.savedEntries[day]);
            });

            state.ready = true;
            setBusy(false, false);
            addCardSubmitButtons();
            syncCardSubmitButtons();
            if(typeof window.updateMonthlyDtrTotal === "function") window.updateMonthlyDtrTotal();

            if(state.savedDays.size){
                notice("success", '<i class="fa fa-lock" aria-hidden="true"></i><span><strong>' + state.savedDays.size + ' saved day' + (state.savedDays.size === 1 ? '' : 's') + '</strong> loaded. Submitted times stay visible and cannot be entered again.</span>');
            }else{
                notice("info", '<i class="fa fa-calendar-plus" aria-hidden="true"></i><span>No saved entries for this month yet. You may enter new dates below.</span>');
            }
            return forms;
        }catch(error){
            if(token !== state.token) return [];
            console.error("Could not load saved DTR entries:", error);
            setBusy(false, true);
            notice("error", '<i class="fa fa-triangle-exclamation" aria-hidden="true"></i><span>Previously submitted times could not be checked. Reload the page before entering another date to prevent duplicates.</span>');
            if(!options.silent) toast(error?.message || "Could not load saved DTR entries.", "error");
            return [];
        }
    }

    function installEntryWrapper(){
        if(typeof window.getMonthlyDtrEntries !== "function" || window.getMonthlyDtrEntries.__savedAware) return;
        var original = window.getMonthlyDtrEntries;

        function wrapped(options){
            options = options || {};
            var result = original();
            var newEntries = (result.entries || []).filter(function(entry){
                return !state.savedDays.has(Number(entry.day));
            });

            if(options.onlyNew){
                var newTotal = newEntries.reduce(function(sum, entry){ return sum + Number(entry?.hours || 0); }, 0);
                return { entries:newEntries, total:Number(newTotal.toFixed(2)) };
            }

            var savedEntries = Object.keys(state.savedEntries).map(function(dayKey){
                var entry = state.savedEntries[dayKey];
                return {
                    day:Number(entry.day || dayKey),
                    am_in:entry.am_in || "",
                    am_out:entry.am_out || "",
                    pm_in:entry.pm_in || "",
                    pm_out:entry.pm_out || "",
                    undertime_hours:entry.undertime_hours || 0,
                    undertime_minutes:entry.undertime_minutes || 0,
                    hours:Number(entry.hours || 0),
                    saved:true
                };
            });

            var all = savedEntries.concat(newEntries).sort(function(a,b){ return Number(a.day) - Number(b.day); });
            var total = all.reduce(function(sum, entry){ return sum + Number(entry?.hours || 0); }, 0);
            return { entries:all, total:Number(total.toFixed(2)) };
        }

        wrapped.__savedAware = true;
        window.getMonthlyDtrEntries = wrapped;
    }

    function installClearWrapper(){
        if(window.clearMonthlyDtr?.__savedAware) return;
        function clearProtected(){
            document.querySelectorAll("#monthlyDtrRows tr:not([data-pgmo-submitted='1']) input").forEach(function(input){
                if(input.dataset.pgmoWeekendDisabled === "1") return;
                input.value = "";
                input.dispatchEvent(new Event("input", { bubbles:true }));
            });
            var notes = document.getElementById("dtrNotes");
            if(notes) notes.value = "";
            if(typeof window.updateMonthlyDtrTotal === "function") window.updateMonthlyDtrTotal();
            if(state.savedDays.size) toast("New entries were cleared. Previously submitted times were kept.", "info");
        }
        clearProtected.__savedAware = true;
        window.clearMonthlyDtr = clearProtected;
    }

    function rowHasNewValues(row){
        return Array.from(row.querySelectorAll("input[data-field]")).some(function(input){
            return String(input.value || "").trim() !== "";
        });
    }

    function syncCardSubmitButton(row){
        if(!row) return;
        var button = row.querySelector(".dtr-card-submit-button");
        if(!button) return;

        var locked = row.dataset.pgmoSubmitted === "1";
        var inactive = row.classList.contains("inactive-day");
        var hasEditableInput = Array.from(row.querySelectorAll("input[data-field]")).some(function(input){
            return !input.disabled && !input.readOnly;
        });
        var ready = state.ready && document.getElementById("monthlyDtrForm")?.dataset.dtrHistoryReady === "1";
        var enabled = ready && !locked && !inactive && hasEditableInput && rowHasNewValues(row);

        var cell = button.closest(".dtr-card-submit-cell");
        if(cell){
            cell.classList.toggle("dtr-card-submit-visible", enabled);
            cell.setAttribute("aria-hidden", enabled ? "false" : "true");
        }

        button.disabled = !enabled;
        button.setAttribute("aria-disabled", enabled ? "false" : "true");
        button.setAttribute("aria-label", "Submit new hours for day " + String(row.dataset.day || ""));
        button.tabIndex = enabled ? 0 : -1;
    }

    function syncCardSubmitButtons(){
        rows().forEach(syncCardSubmitButton);
    }

    function addCardSubmitButtons(){
        rows().forEach(function(row){
            if(row.querySelector(".dtr-card-submit-cell")){
                syncCardSubmitButton(row);
                return;
            }

            var day = Number(row.dataset.day || 0);
            if(!day) return;

            var cell = document.createElement("td");
            cell.className = "dtr-card-submit-cell";
            cell.setAttribute("data-mobile-only", "true");

            var button = document.createElement("button");
            button.type = "submit";
            button.className = "main-btn dtr-card-submit-button";
            button.dataset.dtrSubmitDay = String(day);
            button.setAttribute("form", "monthlyDtrForm");
            button.innerHTML = '<i class="fa fa-paper-plane" aria-hidden="true"></i><span>Submit New Hours</span>';

            cell.appendChild(button);
            row.appendChild(cell);
            syncCardSubmitButton(row);
        });
    }

    function bindCardSubmitInteractions(){
        var tbody = document.getElementById("monthlyDtrRows");
        if(!tbody || tbody.dataset.cardSubmitBound === "1") return;
        tbody.dataset.cardSubmitBound = "1";

        function activateRow(target){
            var row = target?.closest?.("tr[data-day]");
            if(!row || row.dataset.pgmoSubmitted === "1") return;
            rows().forEach(function(item){
                item.classList.toggle("dtr-current-entry", item === row);
            });
            syncCardSubmitButton(row);
        }

        tbody.addEventListener("focusin", function(event){
            if(event.target.matches("input[data-field]")) activateRow(event.target);
        });
        tbody.addEventListener("input", function(event){
            if(!event.target.matches("input[data-field]")) return;
            activateRow(event.target);
            syncCardSubmitButton(event.target.closest("tr[data-day]"));
        });
        tbody.addEventListener("change", function(event){
            if(!event.target.matches("input[data-field]")) return;
            activateRow(event.target);
            syncCardSubmitButton(event.target.closest("tr[data-day]"));
        });
    }

    function requestedSubmitDay(event){
        var day = Number(event?.submitter?.dataset?.dtrSubmitDay || 0);
        return Number.isInteger(day) && day > 0 ? day : 0;
    }

    function filterResultToDay(result, day){
        if(!day) return result;
        var entries = (result.entries || []).filter(function(entry){
            return Number(entry?.day || 0) === day;
        });
        var total = entries.reduce(function(sum, entry){
            return sum + Number(entry?.hours || 0);
        }, 0);
        return { entries:entries, total:Number(total.toFixed(2)) };
    }

    function installSubmitWrapper(){
        if(window.submitMonthlyDtr?.__savedAware) return;

        async function submitProtected(event){
            event?.preventDefault?.();
            if(!onDtrPage()) return false;

            var submitDay = requestedSubmitDay(event);
            state.submittingDay = submitDay;
            var form = document.getElementById("monthlyDtrForm");
            if(!state.ready || form?.dataset.dtrHistoryReady !== "1"){
                toast("Wait until previously submitted times finish loading before submitting.", "error");
                return false;
            }

            var month = monthValue();
            if(!month){
                toast("Please select the DTR month.", "error");
                return false;
            }

            try{
                var latest = await fetchForms(month);
                state.forms = latest;
                state.savedEntries = mergeForms(latest);
                state.savedDays = new Set(Object.keys(state.savedEntries).map(Number));
            }catch(error){
                toast("Could not recheck saved dates. Nothing was submitted. Please try again.", "error");
                return false;
            }

            var result = window.getMonthlyDtrEntries({ onlyNew:true });
            result = filterResultToDay(result, submitDay);
            if(result.entries.some(function(entry){ return entry?.invalid; })){
                toast("Please fix invalid time entries.", "error");
                return false;
            }
            if(!result.entries.length || result.total <= 0){
                toast(submitDay
                    ? "Complete a valid arrival and departure time in this day card before submitting."
                    : "Please input at least one new valid DTR date. Saved dates are already locked.", "error");
                return false;
            }

            var student = typeof window.getStudent === "function" ? window.getStudent() : null;
            if(!student?.id){
                toast("Student session was not found. Please log in again.", "error");
                return false;
            }

            var buttons = submitButtons();
            var buttonStates = buttons.map(function(button){
                return { button:button, html:button.innerHTML, disabled:button.disabled };
            });
            var activeButton = event?.submitter || document.getElementById("submitMonthlyDtrButton");
            buttons.forEach(function(button){
                button.disabled = true;
                button.setAttribute("aria-disabled", "true");
            });
            if(activeButton){
                activeButton.innerHTML = '<i class="fa fa-circle-notch fa-spin" aria-hidden="true"></i><span>Submitting…</span>';
            }

            var payload = {
                student_account_id: student.accountId || null,
                student_id: student.id,
                student_name: student.name,
                course: student.course,
                office_assigned: student.office,
                month: month,
                month_label: new Date(month + "-01T00:00:00").toLocaleString("en-US", { month:"long", year:"numeric" }),
                regular_days: document.getElementById("regularDays")?.value || "8:00 - 5:00",
                saturdays: document.getElementById("saturdays")?.value || "",
                entries: result.entries,
                total_hours: Number(result.total.toFixed(2)),
                notes: (document.getElementById("dtrNotes")?.value || "").trim(),
                status: "Pending"
            };

            var table = typeof window.getDtrFormsTable === "function" ? window.getDtrFormsTable() : "ojt_dtr_forms";
            var response;
            try{
                response = await supabaseClient.from(table).insert([payload]);
            }catch(error){
                response = { error:error };
            }

            buttonStates.forEach(function(item){
                item.button.disabled = item.disabled;
                item.button.innerHTML = item.html;
                if(item.button.disabled) item.button.setAttribute("aria-disabled", "true");
                else item.button.removeAttribute("aria-disabled");
            });
            state.submittingDay = 0;
            syncCardSubmitButtons();

            if(response?.error){
                toast(response.error.message || "Could not submit DTR.", "error");
                return false;
            }

            var notes = document.getElementById("dtrNotes");
            if(notes) notes.value = "";
            toast(submitDay
                ? "New hours for day " + submitDay + " were submitted. This day is now locked."
                : "New DTR dates submitted. Previously submitted dates remain locked.", "success");
            await load({ silent:true });
            if(typeof window.loadMonthlyDtrStats === "function") await window.loadMonthlyDtrStats();
            return false;
        }

        submitProtected.__savedAware = true;
        window.submitMonthlyDtr = submitProtected;
    }

    function addTopSubmit(){
        var actions = document.querySelector(".dtr-action-buttons");
        if(!actions || document.getElementById("submitDtrTopButton")) return;
        var button = document.createElement("button");
        button.id = "submitDtrTopButton";
        button.className = "main-btn dtr-top-submit-btn";
        button.type = "submit";
        button.setAttribute("form", "monthlyDtrForm");
        button.innerHTML = '<i class="fa fa-paper-plane" aria-hidden="true"></i> Submit New Dates';
        actions.appendChild(button);
    }

    function bind(){
        if(!onDtrPage()) return;
        addTopSubmit();
        addCardSubmitButtons();
        bindCardSubmitInteractions();
        ensureNotice();
        installEntryWrapper();
        installClearWrapper();
        installSubmitWrapper();

        var tbody = document.getElementById("monthlyDtrRows");
        if(tbody && tbody.dataset.cardSubmitObserverBound !== "1"){
            tbody.dataset.cardSubmitObserverBound = "1";
            new MutationObserver(function(){
                addCardSubmitButtons();
                syncCardSubmitButtons();
            }).observe(tbody, { childList:true });
        }

        var month = document.getElementById("dtrMonth");
        if(month && month.dataset.savedEntryBound !== "1"){
            month.dataset.savedEntryBound = "1";
            month.addEventListener("change", function(){
                setTimeout(function(){ load(); }, 0);
            });
        }

        load({ silent:true });
    }

    window.PGMO_DTR_RELOAD_SAVED_ENTRIES = load;
    window.PGMO_DTR_SAVED_ENTRY_STATE = state;

    /* Install before DOMContentLoaded so student.js binds the protected submit. */
    installEntryWrapper();
    installClearWrapper();
    installSubmitWrapper();

    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
    else bind();
})();
