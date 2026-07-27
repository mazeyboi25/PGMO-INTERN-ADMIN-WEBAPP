/* PGMO CERTIFICATE FINAL PATCH 2026-07-02
   Uses the uploaded Kaluna Script font and improves long-text behavior.
   No invisible buttons are created here.

   WHERE TO EDIT CERTIFICATE FONT SIZES:
   Edit the values inside PGMO_CERTIFICATE_FONT_SIZES below.

   baseSize = normal text size
   minSize = smallest allowed text size when text is long
   maxCharsBeforeShrink = when the auto-shrink starts
   maxWidth = PDF line width when using text fallback
   y = PDF vertical position when using text fallback
*/
(function(){
    "use strict";

    const PGMO_CERTIFICATE_FONT_SIZES = {
        /* Edit these numbers to tune the certificate overlay.
           baseSize = normal preview/PDF font size.
           minSize = smallest size for long text.
           y = PDF fallback vertical position.
        */
        studentName: { baseSize: 34, minSize: 13, maxCharsBeforeShrink: 10, maxWidth: 850, y: 955 },
        course: { baseSize: 22, minSize: 15, maxCharsBeforeShrink: 42, maxWidth: 820, y: 1038 },
        studentLabel: { baseSize: 20, minSize: 16, maxCharsBeforeShrink: 12, maxWidth: 260, y: 1078 },
        school: { baseSize: 21, minSize: 14, maxCharsBeforeShrink: 62, maxWidth: 1100, y: 1152 },
        training: { baseSize: 21, minSize: 15, maxCharsBeforeShrink: 68, maxWidth: 1120, y: 1206 },
        dates: { baseSize: 21, minSize: 14, maxCharsBeforeShrink: 58, maxWidth: 1160, y: 1260 },
        office: { baseSize: 21, minSize: 14, maxCharsBeforeShrink: 58, maxWidth: 960, y: 1315 },
        given: { baseSize: 19, minSize: 16, maxCharsBeforeShrink: 52, maxWidth: 1100, y: 1438 },
        location: { baseSize: 19, minSize: 16, maxCharsBeforeShrink: 58, maxWidth: 1000, y: 1490 },
        country: { baseSize: 19, minSize: 16, maxCharsBeforeShrink: 16, maxWidth: 500, y: 1542 },
        signatoryName: { baseSize: 23, minSize: 13, maxCharsBeforeShrink: 30, maxWidth: 760, y: 1718 },
        signatoryTitle: { baseSize: 17, minSize: 13, maxCharsBeforeShrink: 58, maxWidth: 760, y: 1714 },
        signatoryOffice: { baseSize: 17, minSize: 13, maxCharsBeforeShrink: 70, maxWidth: 780, y: 1748 }
    };

    window.PGMO_CERTIFICATE_FONT_SIZES = PGMO_CERTIFICATE_FONT_SIZES;

    function escapeHtml(value){
        if(typeof certificateEscape === "function") return certificateEscape(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    const DEFAULT_CERTIFICATE_SIGNATORY_NAME = "JESSICA B. GALINDO";
    const DEFAULT_CERTIFICATE_SIGNATORY_TITLE = "Provincial Government Assistant Department Head";
    const DEFAULT_CERTIFICATE_SIGNATORY_OFFICE = "Officer In-Charge - Human Resource Management Office";

    function valueOrBlank(value, fallback = "__________"){
        const text = String(value || "").trim();
        return text || fallback;
    }

    function normalizeGender(value){
        const raw = String(value || "").trim().toLowerCase();
        if(raw === "m" || raw === "male") return "Male";
        if(raw === "f" || raw === "female") return "Female";
        return "";
    }

    function defaultPronounForGender(value){
        const gender = normalizeGender(value);
        if(gender === "Male") return "his";
        if(gender === "Female") return "her";
        return "his/her";
    }

    function fullOfficeName(value){
        const raw = String(value || "").trim();
        const key = raw.toUpperCase().replace(/\s+/g, " ");
        const map = {
            "HRMO": "Human Resource Management Office",
            "PGSO": "Provincial General Services Office",
            "MIS": "Management Information System Office",
            "HRIS": "Human Resource Information System",
            "PAGRO": "Provincial Agriculture Office",
            "PAGRO - MOPADC": "Misamis Oriental Provincial Agricultural Development Complex",
            "MOPADC": "Misamis Oriental Provincial Agricultural Development Complex",
            "PTO": "Provincial Treasurer's Office",
            "PBO": "Provincial Budget Office",
            "PACCO": "Provincial Accounting Office",
            "PPDO": "Provincial Planning and Development Office",
            "PGO": "Provincial Governor's Office",
            "PESO": "Public Employment Service Office",
            "PHO": "Provincial Health Office",
            "PSWDO": "Provincial Social Welfare and Development Office",
            "PEO": "Provincial Engineer's Office",
            "PLO": "Provincial Legal Office",
            "PDRRMO": "Provincial Disaster Risk Reduction and Management Office"
        };
        return map[key] || raw || "Not assigned";
    }

    function formatDate(value){
        if(typeof formatCertificateDate === "function") return formatCertificateDate(value);
        if(!value) return "";
        const date = new Date(value + "T00:00:00");
        if(Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
    }

    function formatGivenDate(value){
        if(typeof formatCertificateGivenDate === "function") return formatCertificateGivenDate(value);
        if(!value) return "__________";
        const date = new Date(value + "T00:00:00");
        if(Number.isNaN(date.getTime())) return "__________";
        const day = date.getDate();
        const suffix = (day % 10 === 1 && day !== 11) ? "st" : (day % 10 === 2 && day !== 12) ? "nd" : (day % 10 === 3 && day !== 13) ? "rd" : "th";
        const monthYear = date.toLocaleDateString("en-US", { month:"long", year:"numeric" });
        return `${day}${suffix} day of ${monthYear}`;
    }

    function textSize(value, key){
        const cfg = PGMO_CERTIFICATE_FONT_SIZES[key] || PGMO_CERTIFICATE_FONT_SIZES.course;
        const text = String(value || "");
        if(text.length <= cfg.maxCharsBeforeShrink) return cfg.baseSize;
        const reduced = cfg.baseSize - ((text.length - cfg.maxCharsBeforeShrink) * 0.32);
        return Math.max(cfg.minSize, Math.round(reduced));
    }

    function getOptions(){
        if(typeof getCertificateFormValues === "function") return getCertificateFormValues();
        return {
            issueDate: document.getElementById("certificateIssueDate")?.value || new Date().toISOString().slice(0,10),
            trainingStart: document.getElementById("certificateTrainingStart")?.value || "",
            trainingEnd: document.getElementById("certificateTrainingEnd")?.value || "",
            editableName: document.getElementById("certificateStudentNameEdit")?.value.trim() || "",
            editableCourse: document.getElementById("certificateCourseEdit")?.value.trim() || "",
            editableSchool: document.getElementById("certificateSchoolEdit")?.value.trim() || "",
            editablePronoun: document.getElementById("certificatePronounEdit")?.value.trim() || "",
            editableOffice: document.getElementById("certificateOfficeEdit")?.value.trim() || "",
            editableSignatoryName: document.getElementById("certificateSignatoryNameEdit")?.value.trim() || DEFAULT_CERTIFICATE_SIGNATORY_NAME
        };
    }

    function getStudentData(student, options){
        const requiredHours = Number(student?.required || 0);
        const completedHours = Number(student?.completed || 0);
        const hours = requiredHours > 0 ? requiredHours : completedHours;
        const studentName = valueOrBlank(options.editableName || student?.name, "Student Name");
        const course = valueOrBlank(options.editableCourse || student?.course);
        const school = valueOrBlank(options.editableSchool || student?.school || "School not set");
        const pronoun = valueOrBlank(options.editablePronoun || student?.pronoun || defaultPronounForGender(student?.gender));
        const office = valueOrBlank(options.editableOffice || fullOfficeName(student?.officeFullName || student?.office));
        const startDate = options.trainingStart ? formatDate(options.trainingStart) : "__________";
        const endDate = options.trainingEnd ? formatDate(options.trainingEnd) : "__________";
        const issueDate = options.issueDate || (typeof getCertificateToday === "function" ? getCertificateToday() : new Date().toISOString().slice(0,10));
        const givenText = formatGivenDate(issueDate);
        const hoursText = hours ? `${hours} hours` : "__________ hours";
        const signatoryName = valueOrBlank(options.editableSignatoryName || student?.certificateSignatoryName || DEFAULT_CERTIFICATE_SIGNATORY_NAME, DEFAULT_CERTIFICATE_SIGNATORY_NAME);
        const signatoryTitle = DEFAULT_CERTIFICATE_SIGNATORY_TITLE;
        const signatoryOffice = DEFAULT_CERTIFICATE_SIGNATORY_OFFICE;

        return { studentName, course, school, pronoun, office, startDate, endDate, givenText, hoursText, signatoryName, signatoryTitle, signatoryOffice };
    }

    function getTemplateUrl(){
        if(typeof getCertificateTemplateUrl === "function") return getCertificateTemplateUrl();
        return new URL("assets/img/certificate-template.png", window.location.href).href;
    }

    function line(className, key, text, extraClass = ""){
        return `<div class="cert-overlay ${className} ${extraClass}" style="font-size:${textSize(text, key)}px">${escapeHtml(text)}</div>`;
    }

    window.certificateHtml = function(student, options = {}){
        const d = getStudentData(student, options);
        return `
            <div class="certificate-template-preview liceo-cert-template" id="certificatePrintable">
                <img src="${getTemplateUrl()}" alt="Certificate Template">
                ${line("cert-student-name", "studentName", d.studentName)}
                <div class="cert-name-underline" aria-hidden="true"></div>
                ${line("cert-course-line", "course", d.course)}
                ${line("cert-student-label", "studentLabel", "Student")}
                ${line("cert-school-line", "school", `of ${d.school}, for`, "cert-multiline")}
                ${line("cert-training-line", "training", `having completed ${d.pronoun} ${d.hoursText} On-the-Job Training`, "cert-multiline")}
                ${line("cert-dates-line", "dates", `course requirement from ${d.startDate} to ${d.endDate} in`, "cert-multiline")}
                ${line("cert-office-line", "office", `the ${d.office}.`, "cert-multiline")}
                ${line("cert-given-line", "given", `Given this ${d.givenText} at the Provincial Capitol`, "cert-multiline")}
                ${line("cert-location-line", "location", "Compound, Cagayan de Oro City, Misamis Oriental,", "cert-multiline")}
                ${line("cert-country-line", "country", "Philippines.", "cert-multiline")}
                ${line("cert-signatory-name", "signatoryName", d.signatoryName)}
            </div>
        `;
    };

    function fitSingleLineToBox(el, minPx = 16){
        if(!el) return;

        const computed = window.getComputedStyle(el);
        let size = parseFloat(computed.fontSize) || 38;
        const maxWidth = Math.max(1, el.clientWidth || el.getBoundingClientRect().width || 1);

        el.style.setProperty("white-space", "nowrap", "important");
        el.style.setProperty("overflow", "visible", "important");
        el.style.setProperty("text-overflow", "clip", "important");

        let guard = 0;
        while((el.scrollWidth > maxWidth || el.getBoundingClientRect().width > maxWidth) && size > minPx && guard < 120){
            size -= 1;
            el.style.setProperty("font-size", size + "px", "important");
            guard++;
        }

        if(size <= minPx && (el.scrollWidth > maxWidth || el.getBoundingClientRect().width > maxWidth)){
            el.style.setProperty("letter-spacing", "-.02em", "important");
        }
    }

    function fitCertificateOverlayText(root){
        const scope = root || document;
        fitSingleLineToBox(scope.querySelector(".cert-student-name"), 13);
        fitSingleLineToBox(scope.querySelector(".cert-signatory-name"), 13);
    }

    window.fitCertificateOverlayText = fitCertificateOverlayText;

    window.refreshCertificatePreview = function(){
        if(typeof selectedCertificateStudent === "undefined" || !selectedCertificateStudent) return;
        const body = document.getElementById("certificatePreviewBody");
        if(!body) return;
        body.innerHTML = window.certificateHtml(selectedCertificateStudent, getOptions());
        requestAnimationFrame(() => {
            fitCertificateOverlayText(body);
            if(document.fonts && document.fonts.ready){
                document.fonts.ready.then(() => fitCertificateOverlayText(body)).catch(() => null);
            }
        });
    };

    function safeFileName(value){
        return String(value || "Student").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Student";
    }

    function waitForFonts(){
        if(document.fonts && document.fonts.ready) return document.fonts.ready.catch(() => null);
        return Promise.resolve();
    }

    async function waitForImages(root){
        const images = Array.from(root.querySelectorAll("img"));
        await Promise.all(images.map(img => {
            if(img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(resolve => {
                img.addEventListener("load", resolve, { once:true });
                img.addEventListener("error", resolve, { once:true });
            });
        }));
    }

    function buildCertificateExportCss(){
        return `
            html, body{
                margin:0 !important;
                padding:0 !important;
                width:820px !important;
                height:1160px !important;
                overflow:hidden !important;
                background:#ffffff !important;
            }
            *, *::before, *::after{
                box-sizing:border-box !important;
            }
            #certificatePdfExportRoot{
                width:820px !important;
                height:1160px !important;
                margin:0 !important;
                padding:0 !important;
                overflow:hidden !important;
                background:#ffffff !important;
            }
            .certificate-pdf-export,
            .certificate-pdf-export.liceo-cert-template,
            .certificate-pdf-export.certificate-template-preview{
                width:820px !important;
                min-width:820px !important;
                max-width:820px !important;
                height:1160px !important;
                min-height:1160px !important;
                max-height:1160px !important;
                margin:0 !important;
                padding:0 !important;
                position:relative !important;
                left:0 !important;
                right:auto !important;
                top:0 !important;
                transform:none !important;
                box-shadow:none !important;
                overflow:hidden !important;
                background:#ffffff !important;
                aspect-ratio:auto !important;
            }
            .certificate-pdf-export img{
                position:absolute !important;
                left:0 !important;
                top:0 !important;
                width:820px !important;
                min-width:820px !important;
                max-width:820px !important;
                height:1160px !important;
                min-height:1160px !important;
                max-height:1160px !important;
                display:block !important;
                object-fit:fill !important;
                margin:0 !important;
                padding:0 !important;
            }
            @font-face{
                font-family:"Rustic Roadway";
                src:url("assets/fonts/RusticRoadway.otf") format("opentype");
                font-weight:400;
                font-style:normal;
                font-display:swap;
            }
            .certificate-pdf-export .cert-overlay{
                position:absolute !important;
                right:auto !important;
                transform:none !important;
                text-align:center !important;
                color:#111 !important;
                background:transparent !important;
                font-family:"Times New Roman", Times, serif !important;
                font-weight:400 !important;
                white-space:normal !important;
                overflow:visible !important;
                text-overflow:clip !important;
                word-break:normal !important;
                overflow-wrap:normal !important;
                line-height:1.12 !important;
                z-index:3 !important;
            }
            .certificate-pdf-export .cert-multiline{
                display:flex !important;
                justify-content:center !important;
                align-items:center !important;
                text-align:center !important;
            }
            .certificate-pdf-export .cert-student-name{
                left:14% !important;
                right:auto !important;
                top:47.15% !important;
                width:72% !important;
                max-width:72% !important;
                transform:none !important;
                text-align:center !important;
                font-family:"Rustic Roadway", "Rustic Roadway - Personal use", "Times New Roman", serif !important;
                font-weight:400 !important;
                letter-spacing:0 !important;
                line-height:.95 !important;
                display:block !important;
                white-space:nowrap !important;
                overflow:visible !important;
                text-overflow:clip !important;
            }
            .certificate-pdf-export .cert-name-underline{
                position:absolute !important;
                z-index:4 !important;
                left:14% !important;
                top:51.18% !important;
                width:72% !important;
                transform:none !important;
                border-top:1.6px solid #111 !important;
                height:0 !important;
                pointer-events:none !important;
            }
            .certificate-pdf-export .cert-course-line{ left:17% !important; right:auto !important; transform:none !important; top:51.70% !important; width:66% !important; line-height:1.12 !important; }
            .certificate-pdf-export .cert-student-label{ left:35% !important; right:auto !important; transform:none !important; top:53.55% !important; width:30% !important; line-height:1.1 !important; }
            .certificate-pdf-export .cert-school-line{ left:14% !important; right:auto !important; transform:none !important; top:57.15% !important; width:72% !important; min-height:3.6% !important; max-height:5.4% !important; }
            .certificate-pdf-export .cert-training-line{ left:13% !important; right:auto !important; transform:none !important; top:59.95% !important; width:74% !important; min-height:3.1% !important; }
            .certificate-pdf-export .cert-dates-line{ left:13% !important; right:auto !important; transform:none !important; top:62.70% !important; width:74% !important; min-height:3.1% !important; }
            .certificate-pdf-export .cert-office-line{ left:14% !important; right:auto !important; transform:none !important; top:65.45% !important; width:72% !important; min-height:3.2% !important; }
            .certificate-pdf-export .cert-given-line{ left:13% !important; right:auto !important; transform:none !important; top:71.65% !important; width:74% !important; min-height:2.8% !important; }
            .certificate-pdf-export .cert-location-line{ left:14% !important; right:auto !important; transform:none !important; top:74.05% !important; width:72% !important; font-size:19px !important; line-height:1.14 !important; }
            .certificate-pdf-export .cert-country-line{ left:26% !important; right:auto !important; transform:none !important; top:76.35% !important; width:48% !important; font-size:19px !important; line-height:1.14 !important; }
            .certificate-pdf-export .cert-signatory-name{ left:25% !important; right:auto !important; transform:none !important; top:81.85% !important; width:50% !important; font-family:"Times New Roman", Times, serif !important; font-weight:700 !important; letter-spacing:.01em !important; line-height:1.1 !important; white-space:nowrap !important; }
            .certificate-pdf-export .cert-signatory-underline,
            .certificate-pdf-export .cert-signatory-title,
            .certificate-pdf-export .cert-signatory-office{ display:none !important; }

            /* Final export alignment lock: match preview column and prevent html2canvas drift. */
            .certificate-pdf-export .cert-overlay{ right:auto !important; transform:none !important; text-align:center !important; box-sizing:border-box !important; overflow:visible !important; }
            .certificate-pdf-export .cert-student-name{ left:20% !important; top:47.10% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; font-family:"Rustic Roadway", "Rustic Roadway - Personal use", "Times New Roman", serif !important; font-weight:400 !important; line-height:.95 !important; white-space:nowrap !important; overflow:visible !important; }
            .certificate-pdf-export .cert-name-underline{ left:20% !important; top:51.10% !important; width:60% !important; transform:none !important; }
            .certificate-pdf-export .cert-course-line{ left:20% !important; top:51.62% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-student-label{ left:35% !important; top:53.28% !important; width:30% !important; max-width:30% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-school-line{ left:20% !important; top:57.05% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-training-line{ left:20% !important; top:59.90% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-dates-line{ left:20% !important; top:62.75% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-office-line{ left:20% !important; top:65.55% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-given-line{ left:20% !important; top:71.65% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-location-line{ left:20% !important; top:74.05% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-country-line{ left:26% !important; top:76.35% !important; width:48% !important; max-width:48% !important; transform:none !important; text-align:center !important; }
            .certificate-pdf-export .cert-signatory-name{ left:20% !important; top:85.25% !important; width:60% !important; max-width:60% !important; transform:none !important; text-align:center !important; font-family:"Times New Roman", Times, serif !important; font-weight:700 !important; line-height:1 !important; white-space:nowrap !important; overflow:visible !important; }
            .certificate-pdf-export .cert-signatory-underline,
            .certificate-pdf-export .cert-signatory-title,
            .certificate-pdf-export .cert-signatory-office{ display:none !important; }
        `;
    }

    function createCertificateExportFrame(html){
        const iframe = document.createElement("iframe");
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.position = "fixed";
        iframe.style.left = "-10000px";
        iframe.style.top = "0";
        iframe.style.width = "820px";
        iframe.style.height = "1160px";
        iframe.style.border = "0";
        iframe.style.overflow = "hidden";
        iframe.style.pointerEvents = "none";
        iframe.style.background = "#ffffff";
        iframe.style.zIndex = "0";
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const cssHref = new URL("assets/css/style.css", window.location.href).href;
        const baseHref = new URL("./", window.location.href).href;
        doc.open();
        doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="${baseHref}">
<link rel="stylesheet" href="${cssHref}?v=certificate-download-isolated-v2">
<style>${buildCertificateExportCss()}</style>
</head>
<body>
<div id="certificatePdfExportRoot">${html}</div>
</body>
</html>`);
        doc.close();
        return iframe;
    }

    async function waitForFrameReady(iframe){
        const win = iframe.contentWindow;
        const doc = iframe.contentDocument || win.document;
        if(doc.readyState !== "complete"){
            await new Promise(resolve => iframe.addEventListener("load", resolve, { once:true }));
        }
        if(doc.fonts && doc.fonts.load){
            await doc.fonts.load("48px 'Rustic Roadway'").catch(() => null);
        }
        if(doc.fonts && doc.fonts.ready){
            await doc.fonts.ready.catch(() => null);
        }
        await waitForImages(doc);
        await new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
    }

    async function captureCertificateCanvas(){
        if(!window.html2canvas){
            return null;
        }

        await waitForFonts();

        const exportHtml = window.certificateHtml(selectedCertificateStudent, getOptions());
        const iframe = createCertificateExportFrame(exportHtml);

        try{
            await waitForFrameReady(iframe);
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const exportEl = doc.querySelector("#certificatePrintable");
            if(!exportEl) return null;

            exportEl.classList.add("certificate-pdf-export");
            exportEl.removeAttribute("style");

            if(iframe.contentWindow && typeof iframe.contentWindow.fitCertificateOverlayText === "function"){
                iframe.contentWindow.fitCertificateOverlayText(exportEl);
            }else{
                const nameEl = exportEl.querySelector(".cert-student-name");
                if(nameEl){
                    let size = parseFloat(iframe.contentWindow.getComputedStyle(nameEl).fontSize) || 46;
                    nameEl.style.whiteSpace = "nowrap";
                    while(nameEl.scrollWidth > nameEl.clientWidth && size > 22){
                        size -= 1;
                        nameEl.style.fontSize = size + "px";
                    }
                }
            }

            await waitForFrameReady(iframe);

            return await window.html2canvas(exportEl, {
                scale: 3,
                backgroundColor: "#ffffff",
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: 820,
                height: 1160,
                windowWidth: 820,
                windowHeight: 1160,
                scrollX: 0,
                scrollY: 0
            });
        }finally{
            iframe.remove();
        }
    }

    async function htmlToPdf(element, fileName){
        if(!window.jspdf || !window.jspdf.jsPDF || !window.html2canvas){
            return false;
        }

        const canvas = await captureCertificateCanvas();
        if(!canvas) return false;

        const imgData = canvas.toDataURL("image/png");
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[1414, 2000] });
        pdf.addImage(imgData, "PNG", 0, 0, 1414, 2000);
        pdf.save(fileName);
        return true;
    }

    async function fallbackTextPdf(student, options, fileName){
        if(!window.jspdf || !window.jspdf.jsPDF) return false;
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation:"portrait", unit:"pt", format:[1414, 2000] });
        const templateUrl = getTemplateUrl();
        if(typeof loadImageAsDataUrl === "function"){
            const templateData = await loadImageAsDataUrl(templateUrl);
            if(templateData) pdf.addImage(templateData, "PNG", 0, 0, 1414, 2000);
        }
        const d = getStudentData(student, options);
        const centerX = 707;
        function fitText(text, key, fontStyle){
            const cfg = PGMO_CERTIFICATE_FONT_SIZES[key];
            pdf.setFont("times", fontStyle || "normal");
            let size = cfg.baseSize;
            pdf.setFontSize(size);
            while(size > cfg.minSize && pdf.getTextWidth(text) > cfg.maxWidth){
                size -= 1;
                pdf.setFontSize(size);
            }
            pdf.text(text, centerX, cfg.y, { align:"center", maxWidth:cfg.maxWidth });
        }
        pdf.setTextColor(0, 0, 0);
        fitText(d.studentName, "studentName", "italic");
        pdf.setDrawColor(17, 17, 17);
        pdf.setLineWidth(1.6);
        pdf.line(290, 1008, 1124, 1008);
        fitText(d.course, "course");
        fitText("Student", "studentLabel");
        fitText(`of ${d.school}, for`, "school");
        fitText(`having completed ${d.pronoun} ${d.hoursText} On-the-Job Training`, "training");
        fitText(`course requirement from ${d.startDate} to ${d.endDate} in`, "dates");
        fitText(`the ${d.office}.`, "office");
        fitText(`Given this ${d.givenText} at the Provincial Capitol`, "given");
        fitText("Compound, Cagayan de Oro City, Misamis Oriental,", "location");
        fitText("Philippines.", "country");
        pdf.setFont("times", "bold");
        fitText(d.signatoryName, "signatoryName", "bold");
        pdf.setDrawColor(17, 17, 17);
        pdf.setLineWidth(1.6);
        pdf.line(290, 1689, 1124, 1689);
        fitText(d.signatoryTitle, "signatoryTitle");
        fitText(d.signatoryOffice, "signatoryOffice");
        pdf.save(fileName);
        return true;
    }

    window.downloadCertificatePdf = async function(){
        if(typeof selectedCertificateStudent === "undefined" || !selectedCertificateStudent){
            alert("Please select a completed student first.");
            return;
        }

        window.refreshCertificatePreview();
        const options = getOptions();
        const d = getStudentData(selectedCertificateStudent, options);
        const fileName = `${safeFileName(d.studentName)}_Certificate.pdf`;
        const printable = document.getElementById("certificatePrintable");

        try{
            if(printable && await htmlToPdf(printable, fileName)) return;
            if(await fallbackTextPdf(selectedCertificateStudent, options, fileName)) return;
        }catch(error){
            console.error("Certificate PDF failed:", error);
        }

        if(typeof printCertificate === "function"){
            printCertificate();
        }else{
            alert("PDF tools could not be loaded. Please use Print / Save PDF.");
        }
    };

    const oldPrintCertificate = typeof printCertificate === "function" ? printCertificate : null;

    function writePrintLoadingPage(printWindow){
        printWindow.document.open();
        printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Preparing Certificate</title>
<style>
html,body{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#f4f4f4;color:#222;}
body{display:grid;place-items:center;}
.print-loading{padding:24px 30px;background:#fff;border:1px solid #ddd;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.12);font-size:16px;}
</style>
</head>
<body><div class="print-loading">Preparing the certificate for printing…</div></body>
</html>`);
        printWindow.document.close();
    }

    function writeRenderedCertificateForPrint(printWindow, imageDataUrl, title){
        const safeTitle = escapeHtml(title || "Certificate");
        printWindow.document.open();
        printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
@page{size:A4 portrait;margin:0;}
html,body{
    margin:0 !important;
    padding:0 !important;
    width:210mm !important;
    height:297mm !important;
    overflow:hidden !important;
    background:#fff !important;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
}
body{display:block !important;}
#certificatePrintImage{
    display:block !important;
    width:210mm !important;
    height:297mm !important;
    max-width:none !important;
    max-height:none !important;
    margin:0 !important;
    padding:0 !important;
    object-fit:fill !important;
}
@media print{
    html,body{width:210mm !important;height:297mm !important;}
    #certificatePrintImage{width:210mm !important;height:297mm !important;}
}
</style>
</head>
<body>
<img id="certificatePrintImage" src="${imageDataUrl}" alt="Certificate">
<script>
(function(){
    var image = document.getElementById('certificatePrintImage');
    function startPrint(){
        setTimeout(function(){
            window.focus();
            window.print();
        }, 250);
    }
    if(image.complete && image.naturalWidth > 0){
        startPrint();
    }else{
        image.onload = startPrint;
        image.onerror = startPrint;
    }
    window.onafterprint = function(){ window.close(); };
})();
<\/script>
</body>
</html>`);
        printWindow.document.close();
    }

    window.printCertificate = async function(){
        if(typeof selectedCertificateStudent === "undefined" || !selectedCertificateStudent){
            alert("Please select a completed student first.");
            return;
        }

        window.refreshCertificatePreview();

        /* Open immediately so browsers do not block the print window while the
           certificate is being rendered. */
        const printWindow = window.open("", "_blank");
        if(!printWindow){
            alert("Pop-up was blocked. Please allow pop-ups to print the certificate.");
            return;
        }

        writePrintLoadingPage(printWindow);

        try{
            const canvas = await captureCertificateCanvas();
            if(!canvas) throw new Error("Certificate renderer is unavailable.");

            const options = getOptions();
            const data = getStudentData(selectedCertificateStudent, options);
            const imageDataUrl = canvas.toDataURL("image/png");
            writeRenderedCertificateForPrint(printWindow, imageDataUrl, `${data.studentName} Certificate`);
        }catch(error){
            console.error("Certificate print rendering failed:", error);
            try{ printWindow.close(); }catch(closeError){ /* no-op */ }

            /* Keep the original print flow only as an emergency fallback. */
            if(oldPrintCertificate) oldPrintCertificate();
            else window.print();
        }
    };

    document.addEventListener("DOMContentLoaded", function(){
        if(document.fonts && document.fonts.load){
            document.fonts.load("48px 'Rustic Roadway'").catch(() => null);
        }
    });
})();
