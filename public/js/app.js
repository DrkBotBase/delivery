let cropper = null;
let originalFile = null;
let croppedImageBlob = null;
let currentShiftToken = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeFileInput();
    setupEventListeners();
    checkPendingSync();
    addCustomStyles();
    checkShiftStatus();
    if(typeof checkShiftStatus === 'function') checkShiftStatus();
    const searchInput = document.getElementById('searchInput');
    if(searchInput && searchInput.value) {
        // searchInput.focus(); // Opcional: enfocar si hay búsqueda
    }
});

function addCustomStyles() {
    if (document.getElementById('cropper-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'cropper-styles';
    style.textContent = `
        body.modal-open {
            overflow: hidden !important;
            position: fixed;
            width: 100%;
            height: 100%;
        }
        
        .zoom-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(to right, #e5e7eb, #e5e7eb);
            background-size: 100% 100%;
            background-repeat: no-repeat;
            outline: none;
            margin: 15px 0;
        }
        
        .zoom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #4f46e5;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(79, 70, 229, 0.4);
            transition: all 0.2s;
        }
        
        .zoom-slider::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 15px rgba(79, 70, 229, 0.6);
        }
        
        .zoom-slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #4f46e5;
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(79, 70, 229, 0.4);
            transition: all 0.2s;
        }
        
        .zoom-slider::-moz-range-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 15px rgba(79, 70, 229, 0.6);
        }
        
        .modal-enter {
            animation: modalFadeIn 0.3s ease-out;
        }
        
        @keyframes modalFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        .cropper-container {
            max-width: 100% !important;
            max-height: 500px !important;
        }
        
        .aspect-btn.active {
            background-color: #4f46e5 !important;
            color: white !important;
        }
        
        .crop-modal {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }
    `;
    document.head.appendChild(style);
}

function initializeFileInput() {
    const fileInput = document.getElementById('receipt');
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const fileName = document.getElementById('fileName');
            
            if (file) {
                fileName.textContent = file.name;
                originalFile = file;
                croppedImageBlob = null;
                
                if (!file.type.match('image.*')) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Por favor, selecciona solo archivos de imagen',
                        confirmButtonColor: '#4f46e5'
                    });
                    fileInput.value = '';
                    fileName.textContent = '';
                    return;
                }
                
                if (file.size > 5 * 1024 * 1024) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Archivo muy grande',
                        text: 'La imagen no debe superar los 5MB',
                        confirmButtonColor: '#4f46e5'
                    });
                    fileInput.value = '';
                    fileName.textContent = '';
                    return;
                }
                
                openImageEditor(file);
            } else {
                fileName.textContent = '';
            }
        });
    }
}

function setupEventListeners() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleFormSubmit);
    }
}

function openImageEditor(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        createCropModal(e.target.result);
    };
    
    reader.onerror = function() {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la imagen',
            confirmButtonColor: '#4f46e5'
        });
    };
    
    reader.readAsDataURL(file);
}

function createCropModal(imageSrc) {
    const existingModal = document.getElementById('cropModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.classList.add('modal-open');
    
    const modalHTML = `
        <div id="cropModal" class="crop-modal fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-90 flex items-center justify-center p-4 modal-enter">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" id="cropModalContent">
                <!-- Header -->
                <div class="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
                    <h3 class="text-xl font-bold text-gray-800">Editar Foto</h3>
                    <button id="closeCropModal" type="button" class="text-gray-400 hover:text-gray-600 transition-transform hover:scale-110 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Contenido -->
                <div class="p-6 overflow-auto flex-grow">
                    <div class="flex flex-col lg:flex-row gap-6">
                        <!-- Área de la imagen -->
                        <div class="lg:w-2/3">
                            <div class="bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center" style="min-height: 400px; max-height: 500px;">
                                <img id="imageToCrop" src="${imageSrc}" alt="Imagen a recortar" style="max-width: 100%; max-height: 100%; display: block;">
                            </div>
                        </div>
                        
                        <!-- Controles -->
                        <div class="lg:w-1/3 space-y-6">
                            <div>
                                <h4 class="font-medium text-gray-700 mb-3">Controles</h4>
                                <div class="space-y-4">
                                    <!-- Zoom -->
                                    <div>
                                        <div class="flex justify-between items-center mb-2">
                                            <label class="block text-sm font-medium text-gray-600">Zoom</label>
                                            <span id="zoomValue" class="text-sm font-bold text-indigo-600">1.0x</span>
                                        </div>
                                        <input type="range" id="zoomSlider" min="0.1" max="3" step="0.1" value="1" 
                                               class="zoom-slider w-full">
                                        <div class="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>0.1x</span>
                                            <span>1.0x</span>
                                            <span>3.0x</span>
                                        </div>
                                    </div>
                                    
                                    <!-- Rotación -->
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-2">Rotar</label>
                                        <div class="flex gap-2">
                                            <button type="button" id="rotateLeft" 
                                                    class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition active:scale-95 flex items-center justify-center">
                                                <i class="fas fa-undo-alt mr-2"></i>Izquierda
                                            </button>
                                            <button type="button" id="rotateRight" 
                                                    class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition active:scale-95 flex items-center justify-center">
                                                <i class="fas fa-redo-alt mr-2"></i>Derecha
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- Relación de aspecto -->
                                    <div>
                                        <label class="block text-sm font-medium text-gray-600 mb-2">Formato</label>
                                        <div class="grid grid-cols-2 gap-2">
                                            <button type="button" data-ratio="free" 
                                                    class="aspect-btn active bg-indigo-600 text-white py-2 rounded-lg font-medium transition active:scale-95">
                                                Libre
                                            </button>
                                            <button type="button" data-ratio="1" 
                                                    class="aspect-btn bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition active:scale-95">
                                                1:1
                                            </button>
                                            <button type="button" data-ratio="4/3" 
                                                    class="aspect-btn bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition active:scale-95">
                                                4:3
                                            </button>
                                            <button type="button" data-ratio="16/9" 
                                                    class="aspect-btn bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition active:scale-95">
                                                16:9
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Botones de acción -->
                            <div class="pt-4 border-t border-gray-200">
                                <div class="flex gap-3">
                                    <button type="button" id="cancelCrop" 
                                            class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition active:scale-95">
                                        Cancelar
                                    </button>
                                    <button type="button" id="saveCrop" 
                                            class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/30 transition active:scale-95">
                                        <i class="fas fa-check mr-2"></i>Guardar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    initializeCropper();
    setupCropModalListeners();
}

function initializeCropper() {
    const image = document.getElementById('imageToCrop');
    
    if (!image) {
        console.error('No se encontró la imagen para cropper');
        return;
    }
    
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    if (!image.complete) {
        image.onload = function() {
            setupCropperInstance(image);
        };
    } else {
        setupCropperInstance(image);
    }
}

function setupCropperInstance(image) {
    try {
        cropper = new Cropper(image, {
            viewMode: 1,
            dragMode: 'crop',
            responsive: true,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            minContainerWidth: 300,
            minContainerHeight: 300,
            ready: function() {
                console.log('Cropper listo');
                setupZoomSlider();
            }
        });
        
        console.log('Cropper inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar cropper:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo inicializar el editor de imágenes',
            confirmButtonColor: '#4f46e5'
        });
    }
}

function setupZoomSlider() {
    const zoomSlider = document.getElementById('zoomSlider');
    const zoomValue = document.getElementById('zoomValue');
    
    if (!zoomSlider || !zoomValue) {
        console.error('No se encontró el slider de zoom');
        return;
    }
    
    zoomSlider.addEventListener('input', function() {
        if (!cropper) return;
        
        const zoomLevel = parseFloat(this.value);
        try {
            cropper.zoomTo(zoomLevel);
            zoomValue.textContent = zoomLevel.toFixed(1) + 'x';
            
            const percentage = ((zoomLevel - 0.1) / (3 - 0.1)) * 100;
            this.style.background = `linear-gradient(to right, #4f46e5 ${percentage}%, #e5e7eb ${percentage}%)`;
        } catch (error) {
            console.error('Error al aplicar zoom:', error);
        }
    });
    
    const initialPercentage = ((1 - 0.1) / (3 - 0.1)) * 100;
    zoomSlider.style.background = `linear-gradient(to right, #4f46e5 ${initialPercentage}%, #e5e7eb ${initialPercentage}%)`;
    
    if (cropper) {
        cropper.cropper.addEventListener('zoom', function(event) {
            if (!event.detail || !event.detail.ratio) return;
            
            const ratio = event.detail.ratio;
            const sliderValue = Math.min(Math.max(ratio, 0.1), 3);
            zoomSlider.value = sliderValue;
            zoomValue.textContent = sliderValue.toFixed(1) + 'x';
            
            const percentage = ((sliderValue - 0.1) / (3 - 0.1)) * 100;
            zoomSlider.style.background = `linear-gradient(to right, #4f46e5 ${percentage}%, #e5e7eb ${percentage}%)`;
        });
    }
}

function setupCropModalListeners() {
    const closeBtn = document.getElementById('closeCropModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCropModal);
    }
    
    const cancelBtn = document.getElementById('cancelCrop');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCropModal);
    }
    
    const saveBtn = document.getElementById('saveCrop');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCroppedImage);
    }
    
    const rotateLeft = document.getElementById('rotateLeft');
    if (rotateLeft) {
        rotateLeft.addEventListener('click', () => rotateImage(-90));
    }
    
    const rotateRight = document.getElementById('rotateRight');
    if (rotateRight) {
        rotateRight.addEventListener('click', () => rotateImage(90));
    }
    
    const aspectBtns = document.querySelectorAll('.aspect-btn');
    aspectBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const ratio = this.dataset.ratio;
            setAspectRatio(ratio);
            
            aspectBtns.forEach(b => {
                b.classList.remove('active', 'bg-indigo-600', 'text-white');
                b.classList.add('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
            });
            
            this.classList.remove('bg-gray-100', 'hover:bg-gray-200', 'text-gray-700');
            this.classList.add('active', 'bg-indigo-600', 'text-white');
        });
    });
    
    const modalContent = document.getElementById('cropModalContent');
    if (modalContent) {
        modalContent.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });
        
        modalContent.addEventListener('touchmove', function(e) {
            e.stopPropagation();
        }, { passive: false });
    }
    
    const modal = document.getElementById('cropModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeCropModal();
            }
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('cropModal');
            if (modal) {
                closeCropModal();
            }
        }
    });
}

function rotateImage(degrees) {
    if (cropper) {
        cropper.rotate(degrees);
    }
}

function setAspectRatio(ratio) {
    if (!cropper) return;
    
    if (ratio === 'free') {
        cropper.setAspectRatio(NaN);
    } else {
        try {
            cropper.setAspectRatio(eval(ratio));
        } catch (error) {
            console.error('Error al establecer relación de aspecto:', error);
        }
    }
}

function closeCropModal() {
    document.body.classList.remove('modal-open');
    
    const modal = document.getElementById('cropModal');
    if (modal) {
        modal.remove();
    }
    
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    
    const fileInput = document.getElementById('receipt');
    if (fileInput && !croppedImageBlob) {
        fileInput.value = '';
        const fileNameDisplay = document.getElementById('fileName');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
        }
    }
}

async function saveCroppedImage() {
    if (!cropper) {
        console.error('No hay cropper activo');
        closeCropModal();
        return;
    }
    
    try {
        const loader = Swal.fire({
            title: 'Procesando imagen...',
            text: 'Por favor espera',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const canvas = cropper.getCroppedCanvas({
            width: 800,
            height: 800,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        
        if (!canvas) {
            throw new Error('No se pudo generar el canvas recortado');
        }
        
        canvas.toBlob(async function(blob) {
            if (!blob) {
                Swal.close();
                throw new Error('Error al generar la imagen recortada');
            }
            
            croppedImageBlob = blob;
            
            const fileName = originalFile?.name || 'factura_recortada.jpg';
            const croppedFile = new File([blob], fileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(croppedFile);
            
            const fileInput = document.getElementById('receipt');
            if (fileInput) {
                fileInput.files = dataTransfer.files;
                
                const fileNameDisplay = document.getElementById('fileName');
                if (fileNameDisplay) {
                    const baseName = fileName.replace(/\.[^/.]+$/, "");
                    fileNameDisplay.textContent = baseName + ' (editada).jpg';
                }
                
                closeCropModal();
                
                Swal.close();
                
                await Swal.fire({
                    icon: 'success',
                    title: '¡Imagen editada!',
                    text: 'La imagen ha sido recortada exitosamente',
                    timer: 1500,
                    showConfirmButton: false,
                    backdrop: 'rgba(0,0,0,0.4)'
                });
                
                console.log('Imagen recortada guardada correctamente');
            } else {
                Swal.close();
                throw new Error('No se encontró el input de archivo');
            }
        }, 'image/jpeg', 0.9); // 90% de calidad para mejor rendimiento
        
    } catch (error) {
        console.error('Error al guardar imagen recortada:', error);
        Swal.close();
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar la imagen recortada: ' + error.message,
            confirmButtonColor: '#4f46e5'
        });
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const uploadBtn = document.getElementById('uploadText');
    const spinner = document.getElementById('spinner');
    const btnElement = form.querySelector('button[type="submit"]');
    
    const fileInput = document.getElementById('receipt');
    if (!fileInput || !fileInput.files[0]) {
        Swal.fire({
            icon: 'warning',
            title: 'Imagen requerida',
            text: 'Por favor, selecciona una foto de la factura',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    uploadBtn.textContent = 'Subiendo...';
    spinner.classList.remove('hidden');
    btnElement.disabled = true;
    btnElement.classList.add('opacity-75');
    
    try {
        const formData = new FormData(form);

        if (typeof croppedImageBlob !== 'undefined' && croppedImageBlob && originalFile) {
            const fileName = originalFile.name;
            const croppedFile = new File([croppedImageBlob], fileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
            });
            formData.set('receipt', croppedFile, fileName);
        }
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!checkSession(response)) return;

        const result = await response.json();
        
        if (result.success) {
            await Swal.fire({
                icon: 'success',
                title: '¡Listo!',
                text: 'Factura procesada correctamente',
                timer: 1500,
                showConfirmButton: false,
                backdrop: 'rgba(0,0,0,0.4)'
            });
            
            if(typeof croppedImageBlob !== 'undefined') croppedImageBlob = null;
            if(typeof originalFile !== 'undefined') originalFile = null;
            
            setTimeout(() => {
                location.reload();
            }, 500);
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonColor: '#4f46e5'
        });
        
        uploadBtn.textContent = 'Procesar Factura';
        spinner.classList.add('hidden');
        btnElement.disabled = false;
        btnElement.classList.remove('opacity-75');
    }
}

function openDeliveryModal(id) {
    const delivery = window.deliveriesData.find(d => d._id === id);
    
    if (!delivery) {
        Swal.fire('Error', 'No se encontró la información', 'error');
        return;
    }
    
    const fechaObj = new Date(delivery.date);
    const fecha = fechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
    const hora = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    Swal.fire({
        html: `
            <div class="text-left">
                <div class="flex justify-between items-start mb-4 border-b pb-3">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">#${delivery.numberComanda || delivery.invoiceNumber}</h2>
                        <p class="text-sm text-gray-500 capitalize">${fecha} - ${hora}</p>
                    </div>
                    <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold mr-5">
                        $${Number(delivery.amount)}
                    </span>
                </div>

                <div class="space-y-4">
                    <div class="bg-gray-50 p-3 rounded-xl">
                        <label class="text-xs font-bold text-gray-400 uppercase">Cliente</label>
                        <p class="font-medium text-gray-800">${delivery.customerName || 'No registrado'}</p>
                    </div>

                    <div class="bg-gray-50 p-3 rounded-xl">
                        <label class="text-xs font-bold text-gray-400 uppercase">Dirección</label>
                        <p class="font-medium text-gray-800 break-words">${delivery.address}</p>
                        <a href="https://waze.com/ul?q=${encodeURIComponent(delivery.address)}" target="_blank" class="text-xs text-indigo-500 font-bold mt-1 inline-block">
                            <i class="fas fa-map-marked-alt"></i> Abrir en Mapa
                        </a>
                    </div>

                    <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100 cursor-pointer active:scale-95 transition"
                         onclick="openContactOptions('${delivery.phone}')">
                        <label class="text-xs font-bold text-indigo-400 uppercase">Teléfono</label>
                        <p class="font-bold text-indigo-700 text-lg flex items-center justify-between">
                            ${delivery.phone}
                            <i class="fas fa-phone-alt text-indigo-400"></i>
                        </p>
                    </div>

                    ${delivery.notes ? `
                    <div class="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                        <label class="text-xs font-bold text-yellow-600 uppercase">Notas</label>
                        <p class="text-sm text-gray-700 italic">"${delivery.notes}"</p>
                    </div>` : ''}
                </div>

                <div class="mt-6 grid grid-cols-2 gap-3">
                    <button onclick="viewInvoice('${delivery.imageUrl || '/manual.png'}')" class="col-span-2 py-2.5 bg-gray-800 text-white rounded-xl font-medium shadow-lg shadow-gray-400/30 active:scale-95 transition">
                        <i class="fas fa-receipt mr-2"></i> Ver Factura Original
                    </button>
                    
                    <button onclick="editDelivery('${delivery._id}')" class="py-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition">
                        Editar
                    </button>
                    <button onclick="deleteDelivery('${delivery._id}')" class="py-2.5 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 active:scale-95 transition">
                        Eliminar
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'rounded-3xl',
            closeButton: 'focus:outline-none'
        }
    });
}

function openContactOptions(phone) {
    let cleanPhone = phone.replace(/\D/g, ''); 

    if (!cleanPhone.startsWith('57')) {
        cleanPhone = '57' + cleanPhone;
    }

    Swal.fire({
        title: 'Contactar Cliente',
        text: `+${cleanPhone}`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fab fa-whatsapp text-xl"></i> WhatsApp',
        denyButtonText: '<i class="fas fa-phone-alt text-xl"></i> Llamar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#25D366',
        denyButtonColor: '#4f46e5',
        customClass: {
            popup: 'rounded-2xl',
            actions: 'flex-col gap-3 w-full',
            confirmButton: 'py-2 rounded-xl font-bold text-lg',
            denyButton: 'py-2 rounded-xl font-bold text-lg order-2',
            cancelButton: 'text-gray-400 font-medium order-3'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = `https://wa.me/${cleanPhone}`;
        } else if (result.isDenied) {
            window.location.href = `tel:+${cleanPhone}`;
        }
    });
}

function viewInvoice(url) {
    Swal.fire({
        imageUrl: url,
        imageAlt: 'Factura Original',
        showConfirmButton: false,
        showCloseButton: true,
        background: 'transparent',
        backdrop: 'rgba(0,0,0,0.9)',
        customClass: {
            popup: 'p-0 overflow-hidden bg-transparent shadow-none',
            image: 'max-h-[85vh] w-auto rounded-lg object-contain m-0',
            closeButton: 'bg-white rounded-full m-2 text-black focus:outline-none'
        }
    });
}

async function editDelivery(id) {
    try {
        const resGet = await fetch(`/api/deliveries/${id}`);
        if (!checkSession(resGet)) return;
        const delivery = await resGet.json();
        
        Swal.close();

        const { value: formValues } = await Swal.fire({
            title: 'Editar Domicilio',
            html: `
                <input id="swal-invoice" class="swal2-input" placeholder="Factura #" value="${delivery.invoiceNumber}">
                <input id="swal-name" class="swal2-input" placeholder="Nombre" value="${delivery.customerName}">
                <input id="swal-phone" class="swal2-input" placeholder="Teléfono" value="${delivery.phone}">
                <input id="swal-address" class="swal2-input" placeholder="Dirección" value="${delivery.address}">
                <input id="swal-amount" type="number" step="0.01" class="swal2-input" placeholder="Valor" value="${delivery.amount}">
                <textarea id="swal-notes" class="swal2-textarea" placeholder="Notas">${delivery.notes || ''}</textarea>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            confirmButtonText: 'Guardar Cambios',
            preConfirm: () => {
                return {
                    invoiceNumber: document.getElementById('swal-invoice').value,
                    customerName: document.getElementById('swal-name').value,
                    phone: document.getElementById('swal-phone').value,
                    address: document.getElementById('swal-address').value,
                    amount: parseFloat(document.getElementById('swal-amount').value),
                    notes: document.getElementById('swal-notes').value,
                    date: delivery.date
                }
            }
        });

        if (formValues) {
            const response = await fetch(`/api/deliveries/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });

            if (!checkSession(response)) return;

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    showConfirmButton: false,
                    timer: 1000
                }).then(() => location.reload());
            }
        } else {
            if(typeof openDeliveryModal === 'function') openDeliveryModal(delivery._id);
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    }
}

function deleteDelivery(id) {
    Swal.close();

    Swal.fire({
        title: '¿Eliminar entrega?',
        text: "No podrás revertir esto",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#e5e7eb',
        cancelButtonText: '<span class="text-gray-600">Cancelar</span>',
        confirmButtonText: 'Sí, eliminar',
        customClass: {
            popup: 'rounded-2xl'
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/deliveries/${id}`, { method: 'DELETE' });
                
                if (!checkSession(response)) return;

                if (response.ok) {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Eliminado',
                        showConfirmButton: false,
                        timer: 1000
                    });
                    location.reload();
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    });
}

window.addEventListener('online', () => {
    const toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
    toast.fire({ icon: 'success', title: 'Conexión restablecida' });
    checkPendingSync();
});

window.addEventListener('offline', () => {
    const toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
    toast.fire({ icon: 'warning', title: 'Sin conexión a internet' });
});

let pendingSync = [];

function checkPendingSync() {
    const pending = localStorage.getItem('pendingSync');
    if (pending) {
        pendingSync = JSON.parse(pending);
        if (pendingSync.length > 0 && navigator.onLine) {
            syncPendingData();
        }
    }
}

async function syncPendingData() {
    console.log("Sincronizando datos pendientes...");
}

async function checkShiftStatus() {
    try {
        const loading = document.getElementById('shiftLoading');
        const inactive = document.getElementById('shiftInactive');
        const active = document.getElementById('shiftActive');

        if(!loading || !inactive || !active) return;

        const res = await fetch('/api/shift/current');
        
        if (res.status === 401) {
            window.location.href = '/auth/login';
            return;
        }

        const data = await res.json();
        
        loading.classList.add('hidden');

        if (data.active) {
            inactive.classList.add('hidden');
            active.classList.remove('hidden');
            
            document.getElementById('shiftGrandTotal').textContent = '$' + data.stats.grandTotal.toLocaleString('es-CO');
            document.getElementById('shiftBase').textContent = '$' + data.shift.baseMoney.toLocaleString('es-CO');
            
            if(typeof currentShiftToken !== 'undefined') currentShiftToken = data.shift.shareToken;
            else window.currentShiftToken = data.shift.shareToken;

        } else {
            inactive.classList.remove('hidden');
            active.classList.add('hidden');
        }
    } catch (e) { 
        console.error("Error verificando jornada:", e);
    }
}

async function startShift() {
    const { value: base } = await Swal.fire({
        title: 'Iniciar Jornada',
        text: '¿Con cuánto dinero (base) inicias en caja?',
        input: 'number',
        inputValue: 0,
        inputAttributes: { min: 0, step: 5000 },
        showCancelButton: true,
        confirmButtonText: 'Iniciar Turno',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Cancelar'
    });

    if (base !== undefined && base !== null) {
        try {
            const res = await fetch('/api/shift/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ base: parseFloat(base) })
            });
            
            if (!checkSession(res)) return;

            const data = await res.json();
            
            if (data.success) {
                await Swal.fire({
                    icon: 'success', 
                    title: '¡Jornada Iniciada!', 
                    timer: 1500, 
                    showConfirmButton: false
                });
                checkShiftStatus();
            } else {
                Swal.fire('Error', data.error || 'No se pudo iniciar', 'error');
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo de conexión', 'error');
        }
    }
}

async function endShift() {
    const result = await Swal.fire({
        title: '¿Cerrar Caja?',
        text: "Se generará el reporte final y se cerrará el turno actual.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Sí, cerrar caja',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/api/shift/end', { method: 'POST' });
            
            if (!checkSession(res)) return;

            if (res.ok) {
                const data = await res.json();
                await Swal.fire({
                    title: 'Jornada Cerrada',
                    html: `<p class="text-xl">Ventas Totales: <b>$${data.total}</b></p>`,
                    icon: 'success'
                });
                location.reload();
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo cerrar la jornada', 'error');
        }
    }
}

function copyToClipboard(text, btnElement) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(btnElement);
        }).catch(() => {
            fallbackCopyTextToClipboard(text, btnElement);
        });
    } else {
        fallbackCopyTextToClipboard(text, btnElement);
    }
}

function fallbackCopyTextToClipboard(text, btnElement) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if(successful) showCopyFeedback(btnElement);
        else Swal.showValidationMessage('Error al copiar :(');
    } catch (err) {
        console.error('Error al copiar', err);
        Swal.showValidationMessage('No se pudo copiar automáticamente');
    }

    document.body.removeChild(textArea);
}

function showCopyFeedback(btn) {
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
    btn.classList.remove('bg-gray-800', 'hover:bg-gray-900');
    btn.classList.add('bg-green-600');
    
    setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('bg-green-600');
        btn.classList.add('bg-gray-800');
    }, 2000);
}

function shareShift(tokenOverride = null) {
    const tokenToUse = tokenOverride || currentShiftToken;

    if (!tokenToUse) {
        Swal.fire('Info', 'No hay token disponible para compartir', 'info');
        return;
    }
    
    const url = `${window.location.origin}/report/${tokenToUse}`;
    
    Swal.fire({
        title: 'Compartir Reporte',
        html: `
            <div class="space-y-4">
                <p class="text-sm text-gray-500">Enlace al reporte detallado:</p>
                
                <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-2">
                    <input type="text" value="${url}" readonly 
                        class="w-full bg-transparent text-xs text-gray-600 font-mono focus:outline-none select-all">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <a href="https://wa.me/?text=Reporte%20de%20Jornada:%20${encodeURIComponent(url)}" target="_blank" 
                       class="bg-[#25D366] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition shadow-sm active:scale-95">
                       <i class="fab fa-whatsapp text-xl"></i> WhatsApp
                    </a>
                    
                    <button onclick="copyToClipboard('${url}', this)" 
                       class="bg-gray-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-900 transition shadow-sm active:scale-95">
                       <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { 
            popup: 'rounded-3xl p-2' 
        }
    });
}

function applyFilters() {
    const search = document.getElementById('searchInput').value;
    const url = new URL(window.location.href);
    
    if(search) {
        url.searchParams.set('search', search);
    } else {
        url.searchParams.delete('search');
    }
    
    url.searchParams.set('page', 1);
    window.location.href = url.toString();
}

function changePage(newPage) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', newPage);
    window.location.href = url.toString();
}

function clearShiftFilter() {
    const url = new URL(window.location.href);
    url.searchParams.delete('shiftId');
    window.location.href = url.toString();
}

async function addExpense() {
    const { value: formValues } = await Swal.fire({
        title: 'Registrar Gasto',
        html: `
            <div class="space-y-3">
                <input id="swal-exp-desc" class="w-full p-3 border rounded-xl bg-gray-50" placeholder="¿En qué gastaste? (ej: Gasolina)">
                <input id="swal-exp-amount" type="number" class="w-full p-3 border rounded-xl bg-gray-50" placeholder="Valor ($)">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        confirmButtonColor: '#ef4444',
        preConfirm: () => {
            return {
                description: document.getElementById('swal-exp-desc').value,
                amount: document.getElementById('swal-exp-amount').value
            }
        }
    });

    if (formValues && formValues.description && formValues.amount) {
        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            
            if (!checkSession(res)) return;

            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Gasto registrado', timer: 1000, showConfirmButton: false });
                checkShiftStatus();
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo guardar', 'error');
        }
    }
}

async function addManualDelivery() {
    const { value: formValues } = await Swal.fire({
        title: 'Ingreso Extra / Manual',
        html: `
            <div class="space-y-3">
                <input id="swal-man-amount" type="number" class="w-full p-3 border rounded-xl bg-gray-50 text-lg font-bold text-center" placeholder="Valor ($) *Requerido">
                <input id="swal-man-phone" class="w-full p-3 border rounded-xl bg-gray-50" placeholder="Teléfono (Opcional)">
                <input id="swal-man-address" class="w-full p-3 border rounded-xl bg-gray-50" placeholder="Dirección (Opcional)">
                <input id="swal-man-notes" class="w-full p-3 border rounded-xl bg-gray-50" placeholder="Nota (Propina, Pedido por WhatsApp)">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Agregar Dinero',
        confirmButtonColor: '#10b981',
        preConfirm: () => {
            const amount = document.getElementById('swal-man-amount').value;
            if (!amount) Swal.showValidationMessage('¡El valor es obligatorio!');
            return {
                amount: amount,
                phone: document.getElementById('swal-man-phone').value,
                address: document.getElementById('swal-man-address').value,
                notes: document.getElementById('swal-man-notes').value
            }
        }
    });

    if (formValues) {
        try {
            const res = await fetch('/api/deliveries/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            
            if (!checkSession(res)) return;

            if (res.ok) {
                Swal.fire({ icon: 'success', title: 'Agregado', timer: 1000, showConfirmButton: false });
                setTimeout(() => location.reload(), 1000);
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo guardar', 'error');
        }
    }
}

async function loadPage(page) {
    const container = document.getElementById('deliveriesContainer');
    if(container) container.style.opacity = '0.5';
    
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search') || '';
    const shiftId = urlParams.get('shiftId') || '';

    try {
        const res = await fetch(`/api/transactions?page=${page}&search=${search}&shiftId=${shiftId}`);
        
        if (!checkSession(res)) return;

        const data = await res.json();
        
        if(typeof renderTransactions === 'function') renderTransactions(data.items);
        if(typeof updatePaginationControls === 'function') updatePaginationControls(data.page, data.totalPages);
      
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('page', page);
        window.history.pushState({}, '', newUrl);

    } catch (error) {
        console.error('Error cargando página:', error);
    } finally {
        if(container) container.style.opacity = '1';
    }
}

function renderTransactions(items) {
    const container = document.getElementById('deliveriesContainer');
    
    if (items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No hay movimientos</p>
            </div>`;
        return;
    }

    window.deliveriesData = items;

    container.innerHTML = items.map(item => {
        const isExpense = item.type === 'expense';
        
        const borderColor = isExpense ? 'border-red-100' : 'border-gray-100';
        const indicatorColor = isExpense ? 'bg-red-500' : 'bg-indigo-500';
        const numColor = isExpense ? 'text-red-600' : 'text-indigo-600';
        const amountSign = isExpense ? '-' : '';
        const icon = isExpense ? 'fa-minus-circle' : 'fa-map-marker-alt';
        
        const clickAction = isExpense 
            ? `Swal.fire('Gasto', '${item.description}: $${item.amount}', 'info')` 
            : `openDeliveryModal('${item._id}')`;

        return `
        <div onclick="${clickAction}" 
             class="bg-white p-4 rounded-2xl shadow-sm border ${borderColor} flex justify-between items-center active:bg-gray-50 transition cursor-pointer relative overflow-hidden">
            
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${indicatorColor}"></div>

            <div class="pl-2">
                <h3 class="font-bold text-gray-800 flex items-center gap-2">
                    <span class="${numColor}">${isExpense ? 'Gasto' : '#' + item.invoiceNumber}</span>
                </h3>
                <p class="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <i class="fas ${icon} text-xs text-gray-400"></i>
                    ${item.address ? (item.address.substring(0, 25) + (item.address.length > 25 ? '...' : '')) : 'Sin detalle'}
                </p>
            </div>
            
            <div class="text-right">
                <span class="block font-bold ${isExpense ? 'text-red-500' : 'text-gray-800'}">
                    ${amountSign}$${item.amount}
                </span>
                <span class="text-[10px] text-gray-400">
                    ${new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
            </div>
        </div>
        `;
    }).join('');
}

function updatePaginationControls(page, totalPages) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageLabel = document.getElementById('pageLabel');

    if(prevBtn) {
        prevBtn.disabled = page <= 1;
        prevBtn.onclick = () => loadPage(page - 1);
    }
    if(nextBtn) {
        nextBtn.disabled = page >= totalPages;
        nextBtn.onclick = () => loadPage(page + 1);
    }
    if(pageLabel) {
        pageLabel.textContent = `Página ${page} de ${totalPages}`;
    }
}

function applyFilters() {
  const search = document.getElementById('searchInput').value;
  const url = new URL(window.location.href);
  url.searchParams.set('search', search);
  url.searchParams.set('page', 1);
  window.location.href = url.toString();
}

function changePage(newPage) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', newPage);
    window.location.href = url.toString();
}

function clearShiftFilter() {
  const url = new URL(window.location.href);
  url.searchParams.delete('shiftId');
  window.location.href = url.toString();
}

async function showShiftHistory() {
    try {
        const res = await fetch('/api/shifts/history'); 
        
        if (!checkSession(res)) return;

        const shifts = await res.json();
        
        if(shifts.length === 0) {
            Swal.fire('Info', 'No hay historial de jornadas aún', 'info');
            return;
        }

        let htmlContent = '<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">';
        
        shifts.forEach(shift => {
            const date = new Date(shift.startTime).toLocaleDateString('es-ES', {weekday: 'short', day:'numeric', month:'short'});
            const total = (shift.totalDeliveryAmount || 0) + (shift.baseMoney || 0);
            
            htmlContent += `
                <div class="group flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors">
                    
                    <div onclick="window.location.href='/panel/?shiftId=${shift._id}'" 
                         class="flex-1 cursor-pointer">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-bold text-gray-700 capitalize">${date}</p>
                                <div class="flex items-center gap-2 text-xs">
                                    <span class="${shift.status==='active'?'text-green-500 font-bold':'text-gray-400'}">
                                        ${shift.status==='active'?'● Activo':'Cerrado'}
                                    </span>
                                    <span class="text-gray-300">|</span>
                                    <span class="text-gray-500">Base: $${shift.baseMoney}</span>
                                </div>
                            </div>
                            <span class="font-bold text-indigo-600 text-lg mr-2">$${total}</span>
                        </div>
                    </div>

                    <button onclick="shareShift('${shift.shareToken}');" 
                            class="w-10 h-10 flex items-center justify-center bg-white rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 shadow-sm transition active:scale-90"
                            title="Compartir enlace">
                        <i class="fas fa-share-alt"></i>
                    </button>

                </div>
            `;
        });
        htmlContent += '</div>';

        Swal.fire({
            title: 'Historial de Jornadas',
            html: htmlContent,
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
                popup: 'rounded-3xl'
            }
        });

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo cargar el historial', 'error');
    }
}

function confirmLogout() {
    Swal.fire({
        title: '¿Cerrar Sesión?',
        text: "¿Estás seguro que deseas salir?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar',
        customClass: {
            popup: 'rounded-2xl'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/auth/logout';
        }
    });
}

function checkSession(response) {
    if (response.status === 401) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión Expirada',
            text: 'Tu sesión ha terminado. Por favor ingresa nuevamente.',
            confirmButtonText: 'Ir al Login',
            confirmButtonColor: '#4f46e5',
            allowOutsideClick: false
        }).then(() => {
            window.location.href = '/auth/login';
        });
        return false;
    }
    return true;
}

// Nueva funcion
async function importFromVinApp() {
    const input = document.getElementById('vinappInput');
    const btn = document.getElementById('btnVinApp');
    const number = input.value.trim();

    if (!number) {
        return Swal.fire('Espera', 'Número de factura requerido', 'warning');
    }

    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/deliveries/import-vinapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceNumber: number })
        });

        const data = await res.json();

        if (data.success) {
            input.value = '';
            
            await Swal.fire({
                icon: 'success',
                title: '¡Encontrada!',
                text: `${data.delivery.address} - ${data.delivery.customerName}`,
                timer: 1500,
                showConfirmButton: false
            });
            
            editDelivery(data.delivery._id); 
        } else {
            Swal.fire('Error', data.error, 'error');
        }

    } catch (error) {
        Swal.fire('Error', 'Fallo de conexión', 'error');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}
document.getElementById('vinappInput')?.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        importFromVinApp();
    }
});