let currentShiftToken = null;

document.addEventListener('DOMContentLoaded', function() {
    checkPendingSync();
    checkShiftStatus();
    if(typeof checkShiftStatus === 'function') checkShiftStatus();
    const searchInput = document.getElementById('searchInput');
    if(searchInput && searchInput.value) {
        // searchInput.focus();
    }
});

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
                    ${(delivery.idOrder && delivery.idOrder !== 0 && delivery.idOrder !== '0') 
                        ? `<button onclick="viewDigitalInvoice('${delivery.idOrder}')" class="col-span-2 py-2.5 bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-400/30 active:scale-95 transition">
                             <i class="fas fa-receipt mr-2"></i> Ver Ticket Digital
                           </button>` 
                        : `<button onclick="viewInvoice('/icons/192.png')" class="col-span-2 py-2.5 bg-gray-800 text-white rounded-xl font-bold shadow-lg shadow-gray-400/30 active:scale-95 transition">
                             <i class="fas fa-image mr-2"></i> Ver Recibo Manual
                           </button>`
                    }
                    
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
        inputAttributes: { min: 0, step: 1000 },
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

        if (!checkSession(res)) return;

        const data = await res.json();

        if (data.success) {
            input.value = '';
            
            await Swal.fire({
                icon: 'success',
                title: '¡Importado!',
                html: `
                    <p class="font-bold text-indigo-600 mb-2">${data.delivery.restaurantName || ''}</p>
                    <p>${data.delivery.address} - ${data.delivery.customerName}</p>
                    <p class="text-sm text-gray-500 mt-2">Valor domicilio: $${data.delivery.amount}</p>
                `,
                timer: 2500,
                showConfirmButton: false
            });
            
            location.reload(); 
        } 
        
        else if (data.error === 'NO_RESTAURANTS') {
            const { value: linkCode } = await Swal.fire({
                title: 'Vincular Restaurante',
                html: `
                    <p class="text-sm text-gray-600 mb-4">${data.message}</p>
                    <p class="text-xs text-gray-400 mb-2">Pídele el código de vinculación al restaurante.</p>
                `,
                input: 'text',
                inputPlaceholder: 'Ej: 8224-1640',
                icon: 'lock',
                showCancelButton: true,
                confirmButtonText: 'Vincular',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#4f46e5'
            });

            if (linkCode) {
                const parts = linkCode.split('-');
                if (parts.length !== 2) {
                    return Swal.fire('Error', 'El código debe tener el formato NUMERO-NUMERO (ej: 8224-1640)', 'error');
                }

                const companyId = parts[0].trim();
                const pointId = parts[1].trim();

                const { value: restName } = await Swal.fire({
                    title: 'Nombre del Restaurante',
                    text: '¿Cómo quieres registrar este lugar en tu app?',
                    input: 'text',
                    inputPlaceholder: 'Nombre a usar',
                    showCancelButton: true,
                    confirmButtonText: 'Guardar',
                    cancelButtonText: 'Saltar (Usar ID)'
                });

                const linkRes = await fetch('/api/users/link-restaurant', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        companyId: companyId, 
                        pointId: pointId, 
                        name: restName || `Restaurante ${pointId}` 
                    })
                });

                const linkData = await linkRes.json();
                
                if (linkData.success) {
                    await Swal.fire('¡Vinculado!', 'Restaurante agregado. Descargando tu factura...', 'success');
                    importFromVinApp();
                } else {
                    Swal.fire('Error', linkData.error || 'No se pudo vincular el restaurante', 'error');
                }
            }
        }
        else {
            Swal.fire('Error', data.error || 'Ocurrió un error', 'error');
        }
    } catch (error) {
        console.error("Error importando:", error);
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

async function showLinkedRestaurants() {
    const { value: linkCode } = await Swal.fire({
        title: 'Vincular Restaurante',
        html: `
            <p class="text-sm text-gray-600 mb-4">Ingresa el código que te dio el restaurante para conectarte a su sistema.</p>
        `,
        input: 'text',
        inputPlaceholder: 'Ej: 8224-1640',
        icon: 'store',
        showCancelButton: true,
        confirmButtonText: 'Vincular',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#4f46e5'
    });

    if (linkCode) {
        const parts = linkCode.split('-');
        if (parts.length !== 2) {
            return Swal.fire('Error', 'El código debe tener el formato NUMERO-NUMERO (ej: 8224-1640)', 'error');
        }

        const companyId = parts[0].trim();
        const pointId = parts[1].trim();

        const { value: restName } = await Swal.fire({
            title: 'Nombre del Restaurante',
            text: '¿Cómo quieres registrar este lugar en tu app?',
            input: 'text',
            inputPlaceholder: 'Nombre a usar',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Saltar'
        });

        try {
            const linkRes = await fetch('/api/users/link-restaurant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    companyId: companyId, 
                    pointId: pointId, 
                    name: restName || `Restaurante ${pointId}` 
                })
            });

            const linkData = await linkRes.json();
            
            if (linkData.success) {
                Swal.fire('¡Listo!', 'Restaurante vinculado correctamente.', 'success');
            } else {
                Swal.fire('Error', linkData.error, 'error');
            }
        } catch(e) {
            Swal.fire('Error', 'Fallo de conexión', 'error');
        }
    }
}

async function viewDigitalInvoice(idOrder) {
    Swal.fire({
        title: 'Generando ticket...',
        text: 'Consultando datos del restaurante',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch(`https://beta.vinapp.co/api/orders/get-data/${idOrder}`);
        const data = await response.json();

        if (!data || !data.id_order) {
            return Swal.fire('Error', 'No se pudo obtener el detalle de la factura.', 'error');
        }

        const formatMoney = (amount) => new Intl.NumberFormat('es-CO').format(amount);
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };
        const getPaymentMethod = (id) => {
            const methods = { 37: "Efectivo/Datafono", 38: "Transferencia", 39: "Transferencia", 40: "Nequi", 41: "RappiPay" };
            return methods[id] || "Otro";
        };

        const documentNumber = data.document && data.document[0] ? data.document[0].document_number : 'N/A';
        const paymentMethod = getPaymentMethod(data.id_type_forma_pago);
        const shipping = parseFloat(data.shipping || 0);
        const total = parseFloat(data.total || 0);
        const subtotal = total - shipping;
        const valorPagado = parseFloat(data.valor_forma_pago) || total;

        let productsHTML = '';
        if (data.details && data.details.length > 0) {
            data.details.forEach(detail => {
                const quantity = detail.quantity;
                const unitPrice = parseFloat(detail.value);
                const subtotalProduct = unitPrice * quantity;
                
                productsHTML += `
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                        <span style="flex: 2; text-align: left; padding-right: 5px;">${detail.name_product}</span>
                        <span style="width: 25px; text-align: center;">${quantity}</span>
                        <span style="width: 55px; text-align: right;">$${formatMoney(unitPrice)}</span>
                        <span style="width: 60px; text-align: right; font-weight: bold;">$${formatMoney(subtotalProduct)}</span>
                    </div>
                `;
                if (detail.observations) {
                    productsHTML += `
                        <div style="font-size: 10px; color: #666; text-align: left; padding-left: 10px; margin-bottom: 8px;">
                            📝 ${detail.observations}
                        </div>
                    `;
                }
            });
        }

        const ticketHTML = `
            <div id="print-ticket-area" style="font-family: 'Courier New', monospace; color: #000; padding: 10px; max-width: 380px; margin: 0 auto; background: #fff; line-height: 1.2;">
                <div style="text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
                    <h2 style="font-size: 18px; margin: 0 0 5px 0; letter-spacing: 2px;">📋 FACTURA</h2>
                    <div style="font-size: 14px; font-weight: bold;">${data.point ? data.point.name : 'Restaurante'}</div>
                    <div style="font-size: 11px; color: #666;">${data.point ? data.point.direccion : ''}</div>
                    <div style="font-size: 11px; color: #666;">Tel: ${data.point ? data.point.telefono_pedidos : ''}</div>
                </div>

                <div style="font-size: 12px; text-align: left; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Factura:</b> <span>${documentNumber}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Pedido #:</b> <span>${data.id_order}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Fecha:</b> <span>${formatDate(data.created_at)}</span></div>
                    <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Cliente:</b> <span>${data.client ? data.client.name : ''}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Teléfono:</b> <span>${data.client ? data.client.phone : ''}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><b>Dirección:</b> <span style="text-align: right; max-width: 65%;">${data.address}</span></div>
                </div>

                <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>

                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; font-size: 11px;">
                        <span style="flex: 2; text-align: left;">Producto</span>
                        <span style="width: 25px; text-align: center;">Cant</span>
                        <span style="width: 55px; text-align: right;">Precio</span>
                        <span style="width: 60px; text-align: right;">Total</span>
                    </div>
                    ${productsHTML}
                </div>

                <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>

                <div style="font-size: 13px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>SUBTOTAL:</span> <span>$${formatMoney(subtotal)}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>DOMICILIO:</span> <span>$${formatMoney(shipping)}</span></div>
                    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-top: 1px solid #000; margin-top: 6px; padding-top: 6px;">
                        <span>TOTAL:</span> <span>$${formatMoney(total)}</span>
                    </div>
                </div>

                <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>

                <div style="font-size: 12px; text-align: left;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Método pago:</span> <span>${paymentMethod}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Paga con:</span> <span>$${formatMoney(valorPagado)}</span></div>
                    ${valorPagado > total ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Cambio:</span> <span>$${formatMoney(valorPagado - total)}</span></div>` : ''}
                </div>

                <div style="border-top: 1px dashed #ccc; margin: 8px 0;"></div>
                
                <div style="text-align: center; font-size: 10px; color: #666; padding-top: 5px;">
                    <div>✨ ¡Gracias por tu compra! ✨</div>
                    <div style="margin-top: 4px;">App Delivery Tracker</div>
                </div>
            </div>
        `;

        Swal.fire({
            html: ticketHTML,
            showCloseButton: true,
            showCancelButton: true,
            showConfirmButton: true,
            confirmButtonText: '<i class="fas fa-print"></i> Imprimir',
            cancelButtonText: 'Cerrar',
            confirmButtonColor: '#059669',
            cancelButtonColor: '#6b7280',
            background: '#f3f4f6',
            width: 'auto',
            customClass: {
                htmlContainer: 'm-0 p-0',
                popup: 'rounded-2xl p-4',
                confirmButton: 'w-full mb-2',
                cancelButton: 'w-full'
            },
            buttonsStyling: true
        }).then((result) => {
            if (result.isConfirmed) {
                printTicketData(ticketHTML);
            }
        });

    } catch (error) {
        console.error("Error cargando ticket:", error);
        Swal.fire('Error', 'No se pudo cargar la información del ticket. Intenta de nuevo.', 'error');
    }
}

function printTicketData(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
            <head>
                <title>Imprimir Factura</title>
                <style>
                    body { 
                        margin: 0; 
                        padding: 10px; 
                        display: flex; 
                        justify-content: center; 
                    }
                    @media print {
                        body { margin: 0; padding: 0; }
                        /* POS (58mm/80mm) */
                        @page { margin: 0; } 
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}