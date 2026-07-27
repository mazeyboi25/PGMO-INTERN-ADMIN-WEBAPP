/* PGMO Profile Picture Cropper
   Student-portal only. This changes only the profile picture upload flow.
   The cropped image is placed back into #profilePictureInput so the existing
   saveStudentProfile() logic uploads the cropped file normally. */
(function(){
    let cropper = null;
    let objectUrl = "";
    let lastInput = null;
    let originalFileName = "profile-picture";

    function $(id){
        return document.getElementById(id);
    }

    function getExtension(file){
        const name = file && file.name ? file.name : "";
        const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "jpg";
        return ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    }

    function setFileInputFile(input, file){
        if(!input || !file) return false;

        try{
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
            return true;
        }catch(error){
            console.warn("Could not replace selected profile picture file:", error);
            return false;
        }
    }

    function destroyCropper(){
        if(cropper){
            cropper.destroy();
            cropper = null;
        }

        if(objectUrl){
            URL.revokeObjectURL(objectUrl);
            objectUrl = "";
        }
    }

    function closeCropModal(clearInput){
        const modal = $("profileCropModal");
        if(modal){
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden", "true");
        }

        destroyCropper();

        if(clearInput && lastInput){
            lastInput.value = "";

            const fileName = $("profilePictureFileName");
            if(fileName) fileName.textContent = "JPG, PNG, or WEBP only";

            if(typeof getStudent === "function" && typeof applyProfilePicture === "function"){
                const student = getStudent();
                applyProfilePicture(student.profilePictureUrl || "");
            }
        }
    }

    function openCropModal(file, input){
        const modal = $("profileCropModal");
        const image = $("profileCropImage");

        if(!modal || !image || !file || !input){
            return;
        }

        if(typeof Cropper === "undefined"){
            if(typeof showToast === "function"){
                showToast("Image cropper could not load. Your original photo will be used.", "error");
            }
            return;
        }

        lastInput = input;
        originalFileName = file.name || "profile-picture";
        destroyCropper();

        objectUrl = URL.createObjectURL(file);
        image.src = objectUrl;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        cropper = new Cropper(image, {
            aspectRatio: 1,
            viewMode: 1,
            dragMode: "move",
            autoCropArea: 0.9,
            background: false,
            responsive: true,
            restore: false,
            movable: true,
            zoomable: true,
            rotatable: false,
            scalable: false,
            preview: ".profile-crop-preview"
        });
    }

    function useCroppedPhoto(){
        if(!cropper || !lastInput){
            closeCropModal(false);
            return;
        }

        const ext = getExtension(lastInput.files && lastInput.files.length ? lastInput.files[0] : null);
        const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
        const outputName = originalFileName.replace(/\.[^.]+$/, "") + "-cropped." + (mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg");

        const canvas = cropper.getCroppedCanvas({
            width: 600,
            height: 600,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high",
            fillColor: "#ffffff"
        });

        if(!canvas){
            if(typeof showToast === "function") showToast("Could not crop this photo.", "error");
            return;
        }

        canvas.toBlob(function(blob){
            if(!blob){
                if(typeof showToast === "function") showToast("Could not prepare cropped photo.", "error");
                return;
            }

            const croppedFile = new File([blob], outputName, {
                type: mimeType,
                lastModified: Date.now()
            });

            const replaced = setFileInputFile(lastInput, croppedFile);
            const previewUrl = URL.createObjectURL(croppedFile);

            const fileName = $("profilePictureFileName");
            if(fileName){
                fileName.textContent = replaced ? croppedFile.name : "Cropped photo ready";
            }

            if(typeof applyProfilePicture === "function"){
                applyProfilePicture(previewUrl);
            }

            closeCropModal(false);

            if(typeof showToast === "function"){
                showToast("Cropped profile picture is ready. Click Save Profile to upload it.");
            }
        }, mimeType, 0.92);
    }

    function bindProfileCropper(){
        const input = $("profilePictureInput");
        if(!input || input.dataset.cropperReady === "true") return;

        input.dataset.cropperReady = "true";

        input.addEventListener("change", function(){
            if(!input.files || !input.files.length) return;

            const file = input.files[0];
            if(!file || !file.type || !file.type.startsWith("image/")){
                if(typeof showToast === "function") showToast("Please select a valid image file.", "error");
                input.value = "";
                return;
            }

            openCropModal(file, input);
        });

        const useBtn = $("profileCropUse");
        if(useBtn){
            useBtn.addEventListener("click", useCroppedPhoto);
        }

        [$("profileCropCancel"), $("profileCropClose")].forEach(button => {
            if(button){
                button.addEventListener("click", function(){
                    closeCropModal(true);
                });
            }
        });

        document.querySelectorAll("[data-close-profile-crop='true']").forEach(backdrop => {
            backdrop.addEventListener("click", function(){
                closeCropModal(true);
            });
        });

        document.addEventListener("keydown", function(event){
            const modal = $("profileCropModal");
            if(event.key === "Escape" && modal && modal.classList.contains("show")){
                closeCropModal(true);
            }
        });
    }

    if(document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", bindProfileCropper);
    }else{
        bindProfileCropper();
    }
})();
