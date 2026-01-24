let cropper = null;
let originalFile = null;
let croppedImageBlob = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeFileInput();
    setupEventListeners();
    checkPendingSync();
    addCustomStyles();
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

        if (croppedImageBlob && originalFile) {
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
            
            croppedImageBlob = null;
            originalFile = null;
            
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
                        <h2 class="text-2xl font-bold text-gray-800">#${delivery.invoiceNumber}</h2>
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
                    <button onclick="viewInvoice('${delivery.imageUrl}')" class="col-span-2 py-2.5 bg-gray-800 text-white rounded-xl font-medium shadow-lg shadow-gray-400/30 active:scale-95 transition">
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
        const delivery = await fetch(`/api/deliveries/${id}`).then(res => res.json());
        
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

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    showConfirmButton: false,
                    timer: 1000
                }).then(() => location.reload());
            }
        } else {
            openDeliveryModal(delivery._id);
        }

    } catch (error) {
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