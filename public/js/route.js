// route.js
let currentRoute = null;
let currentDeliveryIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    startRoute();
});

async function startRoute() {
    const listContainer = document.getElementById('deliveriesList');
    try {
        const response = await fetch('/api/route/start');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Error al cargar');
        }
        
        if (!data.deliveries || data.deliveries.length === 0) {
            updateEmptyState();
            return;
        }
        
        currentRoute = data;
        currentDeliveryIndex = 0;
        
        renderRouteUI();
        enableControls(true);
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
        Toast.fire({ icon: 'success', title: 'Ruta cargada' });

    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <div class="text-red-400 text-5xl mb-3"><i class="fas fa-exclamation-circle"></i></div>
                <h3 class="text-gray-800 font-bold">Error de conexión</h3>
                <p class="text-sm text-gray-500 mb-4">${error.message}</p>
                <button onclick="startRoute()" class="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-bold">Reintentar</button>
            </div>
        `;
    }
}

function renderRouteUI() {
    if (!currentRoute) return;
    
    document.getElementById('routeStats').textContent = 
        `${currentRoute.deliveries.length} Paradas | ~${currentRoute.totalEstimatedTime || 0} min`;
    
    document.getElementById('totalTime').textContent = `${currentRoute.totalEstimatedTime || 0} min`;
    
    const totalEarnings = currentRoute.deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
    document.getElementById('totalEarnings').textContent = `$${totalEarnings.toLocaleString('es-CO')}`;

    const listContainer = document.getElementById('deliveriesList');
    listContainer.innerHTML = '';

    currentRoute.deliveries.forEach((delivery, index) => {
        const isActive = index === currentDeliveryIndex;
        
        const card = document.createElement('div');
        let cardClasses = 'relative p-4 rounded-2xl border transition-all duration-300 ';
        if (isActive) {
            cardClasses += 'bg-indigo-50 border-indigo-400 z-10 scale-[1.02] shadow-md';
        } else {
            cardClasses += 'bg-white border-gray-100 shadow-sm opacity-70';
        }
        card.className = cardClasses;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="font-bold ${isActive ? 'text-indigo-700' : 'text-gray-500'}">
                    #${index + 1} - Factura ${delivery.invoiceNumber || delivery.notes || ''}
                </span>
                ${isActive ? '<span class="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-full font-bold animate-pulse uppercase tracking-wider shadow-sm">En Curso</span>' : ''}
            </div>
            
            <div class="space-y-1 text-sm">
                <p class="font-bold text-gray-800 text-lg leading-tight">${delivery.address}</p>
                <p class="text-gray-600 text-xs"><i class="fas fa-user mr-1 text-gray-400"></i> ${delivery.customerName || 'Cliente'}</p>
                <div class="flex items-center gap-3 pt-3">
                     <button onclick="openContactOptions('${delivery.phone}', '${delivery.customerName || 'Cliente'}')" class="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 active:scale-95 transition">
                        <i class="fab fa-whatsapp text-emerald-500"></i> Contactar
                     </button>
                     <span class="font-black text-gray-800 ml-auto bg-gray-100 px-2 py-1 rounded text-base">
                        $${Number(delivery.amount).toLocaleString('es-CO')}
                     </span>
                </div>
            </div>
            
            ${delivery.notes ? `
                <div class="mt-3 bg-yellow-50 text-yellow-800 text-xs p-2.5 rounded-lg border border-yellow-200 font-medium">
                    <i class="fas fa-sticky-note mr-1 text-yellow-500"></i> ${delivery.notes}
                </div>
            ` : ''}
        `;
        listContainer.appendChild(card);
    });
    
    // Auto-scroll a la tarjeta activa
    if (currentDeliveryIndex < currentRoute.deliveries.length) {
        const activeCard = listContainer.children[currentDeliveryIndex];
        if (activeCard) {
            setTimeout(() => {
                activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        }
    }
}

function updateEmptyState() {
    document.getElementById('deliveriesList').innerHTML = `
        <div class="text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
            <div class="text-6xl mb-4">🏁</div>
            <h3 class="text-gray-800 font-bold text-xl mb-1">¡Todo listo!</h3>
            <p class="text-sm">No hay entregas pendientes en tu ruta.</p>
            <a href="/panel" class="mt-6 inline-block bg-gray-100 text-gray-700 font-bold px-6 py-2 rounded-xl hover:bg-gray-200 transition">
                <i class="fas fa-home mr-1"></i> Volver al inicio
            </a>
        </div>
    `;
    enableControls(false);
}

function enableControls(enable) {
    const navBtn = document.getElementById('navBtn');
    const completeBtn = document.getElementById('completeBtn');
    const skipBtn = document.getElementById('skipBtn');
    
    if (navBtn) navBtn.disabled = !enable;
    if (completeBtn) completeBtn.disabled = !enable;
    if (skipBtn) skipBtn.disabled = !enable;
}

// NUEVA FUNCIÓN DE NAVEGACIÓN (Diseño Mobile-First)
function startNavigation() {
    if (!currentRoute || currentDeliveryIndex >= currentRoute.deliveries.length) return;
    
    const delivery = currentRoute.deliveries[currentDeliveryIndex];
    const addressQuery = encodeURIComponent(delivery.address + ", Barranquilla"); 
    
    Swal.fire({
        html: `
            <div class="text-center mb-6 mt-2">
                <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                    <i class="fas fa-directions"></i>
                </div>
                <h2 class="text-2xl font-black text-gray-800">Navegación</h2>
                <p class="text-sm text-gray-500 mt-1">Elige tu app favorita para iniciar la ruta</p>
            </div>

            <div class="space-y-3">
                <button onclick="window.open('https://waze.com/ul?q=${addressQuery}&navigate=yes', '_blank'); Swal.close();"
                    class="w-full bg-[#e8f4f9] hover:bg-[#d4eaf5] border border-[#bce0f0] text-[#058db9] p-4 rounded-2xl flex items-center gap-4 transition active:scale-95 shadow-sm">
                    <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-3xl shadow-sm text-[#33ccff]">
                        <i class="fab fa-waze"></i>
                    </div>
                    <div class="text-left flex-1">
                        <h3 class="font-bold text-lg leading-tight">Waze</h3>
                        <p class="text-xs opacity-80 mt-0.5">Tráfico en tiempo real</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                        <i class="fas fa-chevron-right opacity-60"></i>
                    </div>
                </button>

                <button onclick="window.open('https://maps.google.com/?q=${addressQuery}', '_blank'); Swal.close();"
                    class="w-full bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-4 transition active:scale-95 shadow-sm">
                    <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm text-red-500">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="text-left flex-1">
                        <h3 class="font-bold text-lg leading-tight">Google Maps</h3>
                        <p class="text-xs opacity-80 mt-0.5">Rutas alternativas y vista 3D</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                        <i class="fas fa-chevron-right opacity-60"></i>
                    </div>
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'rounded-[2.5rem] p-6 pb-8',
            htmlContainer: 'm-0',
            closeButton: 'focus:outline-none text-gray-400 hover:text-gray-600 mt-2 mr-2'
        }
    });
}

async function completeDelivery() {
    if (!currentRoute) return;
    const delivery = currentRoute.deliveries[currentDeliveryIndex];

    const result = await Swal.fire({
        title: '¿Pedido Entregado?',
        html: `Factura <b>#${delivery.invoiceNumber || 'Manual'}</b><br>Cobrar: <b>$${Number(delivery.amount).toLocaleString('es-CO')}</b>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#e5e7eb',
        confirmButtonText: 'Sí, confirmar',
        cancelButtonText: '<span class="text-gray-600">Cancelar</span>',
        customClass: { popup: 'rounded-3xl' }
    });

    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/api/delivery/${delivery._id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'entregado' })
        });

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Entregado!',
                showConfirmButton: false,
                timer: 1200,
                backdrop: false,
                position: 'top',
                customClass: { popup: 'rounded-2xl shadow-lg border border-gray-100' }
            });
            
            currentRoute.deliveries.splice(currentDeliveryIndex, 1);
            
            if (currentRoute.deliveries.length === 0) {
                Swal.fire({
                    title: '¡Ruta Completada!',
                    text: 'Has entregado todos los pedidos con éxito.',
                    icon: 'success',
                    confirmButtonText: 'Finalizar',
                    confirmButtonColor: '#4f46e5',
                    customClass: { popup: 'rounded-3xl' }
                }).then(() => {
                    window.location.href = '/panel';
                });
                updateEmptyState();
            } else {
                if (currentDeliveryIndex >= currentRoute.deliveries.length) {
                    currentDeliveryIndex = currentRoute.deliveries.length - 1;
                }
                renderRouteUI();
            }
        } else {
            throw new Error('Error en la respuesta del servidor');
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
    }
}

async function skipDelivery() {
    if (!currentRoute || currentDeliveryIndex >= currentRoute.deliveries.length - 1) {
        Swal.fire({
            title: 'No se puede saltar',
            text: 'Esta es la última entrega de la ruta',
            icon: 'info',
            timer: 2000,
            showConfirmButton: false,
            customClass: { popup: 'rounded-2xl' }
        });
        return;
    }
    
    const result = await Swal.fire({
        title: '¿Saltar entrega?',
        text: "Este pedido se moverá al final de la fila actual",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6b7280',
        confirmButtonText: 'Saltar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'rounded-3xl' }
    });

    if (result.isConfirmed) {
        moveCurrentDeliveryBehindNext();
    }
}

function moveCurrentDeliveryBehindNext() {
    if (!currentRoute || currentDeliveryIndex >= currentRoute.deliveries.length - 1) {
        return;
    }
    
    const currentDelivery = currentRoute.deliveries[currentDeliveryIndex];
    const nextDelivery = currentRoute.deliveries[currentDeliveryIndex + 1];
    
    currentRoute.deliveries[currentDeliveryIndex] = nextDelivery;
    currentRoute.deliveries[currentDeliveryIndex + 1] = currentDelivery;
    
    renderRouteUI();
    
    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'info',
        title: 'Pedido reordenado',
        showConfirmButton: false,
        timer: 1500
    });
}

// NUEVA FUNCIÓN DE CONTACTO (Diseño Mobile-First)
function openContactOptions(phone, name) {
    let cleanPhone = phone.replace(/\D/g, ''); 
    if (!cleanPhone.startsWith('57')) cleanPhone = '57' + cleanPhone;

    const displayPhone = `+${cleanPhone.substring(0,2)} ${cleanPhone.substring(2,5)} ${cleanPhone.substring(5,8)} ${cleanPhone.substring(8)}`;

    Swal.fire({
        html: `
            <div class="text-center mb-6 mt-2">
                <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
                    <i class="fas fa-user-circle"></i>
                </div>
                <h2 class="text-2xl font-black text-gray-800">${name}</h2>
                <p class="text-lg font-bold text-gray-500 mt-1 tracking-wider">${displayPhone}</p>
            </div>

            <div class="space-y-3">
                <button onclick="window.open('https://wa.me/${cleanPhone}', '_blank'); Swal.close();"
                    class="w-full bg-[#e8fbf0] hover:bg-[#d1f7e1] border border-[#bcefd1] text-[#0d9446] p-4 rounded-2xl flex items-center gap-4 transition active:scale-95 shadow-sm">
                    <div class="w-12 h-12 bg-[#25D366] text-white rounded-full flex items-center justify-center text-3xl shadow-md">
                        <i class="fab fa-whatsapp"></i>
                    </div>
                    <div class="text-left flex-1">
                        <h3 class="font-bold text-lg leading-tight">WhatsApp</h3>
                        <p class="text-xs opacity-80 mt-0.5">Enviar mensaje directo</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                        <i class="fas fa-chevron-right opacity-60"></i>
                    </div>
                </button>

                <button onclick="window.location.href='tel:+${cleanPhone}'; Swal.close();"
                    class="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 p-4 rounded-2xl flex items-center gap-4 transition active:scale-95 shadow-sm">
                    <div class="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl shadow-md transform -rotate-12">
                        <i class="fas fa-phone"></i>
                    </div>
                    <div class="text-left flex-1">
                        <h3 class="font-bold text-lg leading-tight">Llamada</h3>
                        <p class="text-xs opacity-80 mt-0.5">Llamada de voz tradicional</p>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                        <i class="fas fa-chevron-right opacity-60"></i>
                    </div>
                </button>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
            popup: 'rounded-[2.5rem] p-6 pb-8',
            htmlContainer: 'm-0',
            closeButton: 'focus:outline-none text-gray-400 hover:text-gray-600 mt-2 mr-2'
        }
    });
}

function exportRoute() {
    if (!currentRoute) return;
    let exportText = `RUTA - ${new Date().toLocaleDateString()}\n----------------\n`;
    currentRoute.deliveries.forEach((d, i) => {
        exportText += `#${i+1} (${d.invoiceNumber || 'N/A'}) - ${d.address} - $${Number(d.amount).toLocaleString('es-CO')}\n`;
    });
    
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ruta_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: 'Ruta exportada',
        showConfirmButton: false,
        timer: 1500
    });
}