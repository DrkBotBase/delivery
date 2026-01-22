document.getElementById('receipt').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name;
    document.getElementById('fileName').textContent = fileName || '';
});

document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const uploadBtn = document.getElementById('uploadText');
    const spinner = document.getElementById('spinner');
    const btnElement = this.querySelector('button[type="submit"]');
    
    uploadBtn.textContent = 'Subiendo...';
    spinner.classList.remove('hidden');
    btnElement.disabled = true;
    btnElement.classList.add('opacity-75');
    
    try {
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
                backdrop: `rgba(0,0,0,0.4)`
            });
            location.reload();
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
});

/**
 * Muestra el Modal Principal buscando los datos por ID
 */
function openDeliveryModal(id) {
    const delivery = window.deliveriesData.find(d => d._id === id);
    
    if (!delivery) {
        Swal.fire('Error', 'No se encontró la información de este pedido', 'error');
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
                    <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
                        $${Number(delivery.amount).toFixed(2)}
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
                        <label class="text-xs font-bold text-indigo-400 uppercase">Teléfono (Tocar para contactar)</label>
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
                    <a href="${delivery.imageUrl}" target="_blank" class="col-span-2 text-center py-2.5 bg-gray-800 text-white rounded-xl font-medium shadow-lg shadow-gray-400/30">
                        <i class="fas fa-receipt mr-2"></i> Ver Factura Original
                    </a>
                    <button onclick="editDelivery('${delivery._id}')" class="py-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50">
                        Editar
                    </button>
                    <button onclick="deleteDelivery('${delivery._id}')" class="py-2.5 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100">
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


/**
 * Modal para seleccionar método de contacto (Llamada o WhatsApp)
 */
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

/**
 * Edición de Domicilio usando SweetAlert inputs
 */
async function editDelivery(id) {
    try {
        const delivery = await fetch(`/api/deliveries/${id}`).then(res => res.json());
        
        Swal.close();

        const { value: formValues } = await Swal.fire({
            title: 'Editar Domicilio',
            html: `
                <input id="swal-invoice" class="swal2-input" placeholder="Factura #" value="${delivery.invoiceNumber}">
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
            showDeliveryDetails(delivery);
        }

    } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar los datos', 'error');
    }
}

/**
 * Eliminar domicilio
 */
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

document.addEventListener('DOMContentLoaded', () => {
    checkPendingSync();
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