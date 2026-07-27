/* PGMO DTR TIME INPUT FORMATTER
   One clean formatter for DTR time fields.
   - Typing 8 becomes 8:
   - Typing 0800 becomes 8:00
   - Backspace/Delete can remove the colon and clear the input normally.
   - After deleting, the colon appears again only when the user types another number.
*/
(function(){
    "use strict";

    function isDtrPage(){
        return document.body && document.body.dataset && document.body.dataset.page === "monthly-dtr";
    }

    function isDtrTimeInput(input){
        return input && input.classList && input.classList.contains("dtr-time-input");
    }

    function cleanValue(value){
        return String(value || "")
            .replace(/[^0-9:]/g, "")
            .replace(/:{2,}/g, ":")
            .slice(0, 5);
    }

    function formatTypedValue(value, finalize){
        var digits = String(value || "").replace(/\D/g, "").slice(0, 4);
        if(!digits) return "";

        if(digits.length === 1){
            var one = Number(digits);
            if(finalize) return one >= 1 && one <= 12 ? one + ":00" : null;
            return one >= 2 && one <= 9 ? digits + ":" : digits;
        }

        var hour = "";
        var minute = "";

        if(digits.length === 2){
            var two = Number(digits);
            if(two >= 10 && two <= 12){
                hour = digits;
                minute = "";
            }else{
                hour = digits.slice(0, 1);
                minute = digits.slice(1, 2);
            }
        }else if(digits.length === 3){
            hour = digits.slice(0, 1);
            minute = digits.slice(1, 3);
        }else{
            var firstTwo = Number(digits.slice(0, 2));
            if(firstTwo >= 10 && firstTwo <= 12){
                hour = digits.slice(0, 2);
                minute = digits.slice(2, 4);
            }else{
                hour = digits.slice(0, 1);
                minute = digits.slice(1, 3);
            }
        }

        var hourNumber = Number(hour);
        var minuteNumber = minute === "" ? 0 : Number(minute);
        if(hourNumber < 1 || hourNumber > 12 || minuteNumber < 0 || minuteNumber > 59) return finalize ? null : "";

        if(finalize) return hourNumber + ":" + String(minuteNumber).padStart(2, "0");
        return minute === "" ? hour + ":" : hour + ":" + minute;
    }

    function refreshTotal(){
        if(typeof window.updateMonthlyDtrTotal === "function") window.updateMonthlyDtrTotal();
    }

    function cursorEnd(input){
        try{ input.setSelectionRange(input.value.length, input.value.length); }catch(error){}
    }

    document.addEventListener("input", function(event){
        var input = event.target;
        if(!isDtrPage() || !isDtrTimeInput(input)) return;

        var inputType = String(event.inputType || "");
        var deleting = inputType.indexOf("delete") !== -1;

        if(deleting){
            input.value = cleanValue(input.value);
            input.dataset.pgmoDtrLastAction = "delete";
            refreshTotal();
            return;
        }

        var formatted = formatTypedValue(input.value, false);
        input.value = formatted === null ? "" : formatted;
        input.dataset.pgmoDtrLastAction = "type";
        cursorEnd(input);
        refreshTotal();
    }, true);

    document.addEventListener("focusout", function(event){
        var input = event.target;
        if(!isDtrPage() || !isDtrTimeInput(input)) return;

        if(input.dataset.pgmoDtrLastAction === "delete"){
            input.value = cleanValue(input.value);
            refreshTotal();
            return;
        }

        var formatted = formatTypedValue(input.value, true);
        input.value = formatted === null ? "" : formatted;
        refreshTotal();
    }, true);
})();
