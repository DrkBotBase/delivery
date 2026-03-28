let currentRoute = null;
let currentDeliveryIndex = 0;
// variables map
let map = null;
let directionsService = null;
let directionsRenderer = null;
let driverMarker = null;
let watchId = null;

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
        Toast.fire({ icon: 'success', title: 'Ruta actualizada' });

    } catch (error) {
        console.error('Error:', error);
        listContainer.innerHTML = `
            <div class="text-center py-10">
                <div class="text-red-400 text-5xl mb-3"><i class="fas fa-exclamation-circle"></i></div>
                <h3 class="text-gray-800 font-bold">Error de conexión</h3>
                <p class="text-sm text-gray-500 mb-4">${error.message}</p>
                <button onclick="startRoute()" class="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm">Reintentar</button>
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
    document.getElementById('totalEarnings').textContent = `$${totalEarnings.toFixed(2)}`;

    const listContainer = document.getElementById('deliveriesList');
    listContainer.innerHTML = '';

    currentRoute.deliveries.forEach((delivery, index) => {
        const isActive = index === currentDeliveryIndex;
        
        const card = document.createElement('div');
        let cardClasses = 'relative p-4 rounded-2xl border transition-all duration-300 ';
        if (isActive) {
            cardClasses += 'bg-white active-card-glow border-indigo-500 z-10 scale-[1.02]';
        } else {
            cardClasses += 'bg-white border-gray-100 shadow-sm';
        }
        card.className = cardClasses;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <span class="font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'}">
                    #${index + 1} - Factura ${delivery.invoiceNumber}
                </span>
                ${isActive ? '<span class="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full font-bold animate-pulse">EN CURSO</span>' : ''}
            </div>
            
            <div class="space-y-1 text-sm">
                <p class="font-bold text-gray-800 text-base">${delivery.address}</p>
                <p class="text-gray-500"><i class="fas fa-user mr-1"></i> ${delivery.customerName || 'Cliente'}</p>
                <div class="flex items-center gap-3 pt-2">
                     <button onclick="openContactOptions('${delivery.phone}')" class="text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
                        <i class="fab fa-whatsapp"></i> Contactar
                     </button>
                     <span class="font-bold text-gray-700">$${Number(delivery.amount)}</span>
                </div>
            </div>
            
            ${delivery.notes ? `
                <div class="mt-3 bg-yellow-50 text-yellow-700 text-xs p-2 rounded-lg border border-yellow-100">
                    <i class="fas fa-sticky-note mr-1"></i> ${delivery.notes}
                </div>
            ` : ''}
        `;
        listContainer.appendChild(card);
    });
    
    if (currentDeliveryIndex < currentRoute.deliveries.length) {
        const activeCard = listContainer.children[currentDeliveryIndex];
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        const activeDelivery = currentRoute.deliveries[currentDeliveryIndex];
        updateMapRoute(activeDelivery.address); 
    }
}

function updateEmptyState() {
    document.getElementById('deliveriesList').innerHTML = `
        <div class="text-center py-10 text-gray-400">
            <div class="text-6xl mb-4">🏁</div>
            <h3 class="text-gray-800 font-bold text-lg">¡Todo listo!</h3>
            <p>No hay entregas pendientes en la ruta.</p>
            <a href="/panel" class="mt-4 inline-block text-indigo-600 font-bold">Volver al inicio</a>
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

/**
 * Abrir Navegación (Google Maps / Waze)
 */
function startNavigation() {
    if (!currentRoute || currentDeliveryIndex >= currentRoute.deliveries.length) return;
    
    const delivery = currentRoute.deliveries[currentDeliveryIndex];
    const address = encodeURIComponent(delivery.address);
    
    const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
    
    window.open(url, '_blank');
}

async function completeDelivery() {
    if (!currentRoute) return;
    const delivery = currentRoute.deliveries[currentDeliveryIndex];

    const result = await Swal.fire({
        title: '¿Pedido Entregado?',
        text: `Factura #${delivery.invoiceNumber} - $${delivery.amount}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#d1d5db',
        confirmButtonText: 'Sí, confirmar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'rounded-2xl' }
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
                timer: 1000,
                backdrop: false,
                position: 'top'
            });
            
            currentRoute.deliveries.splice(currentDeliveryIndex, 1);
            
            if (currentRoute.deliveries.length === 0) {
                Swal.fire({
                    title: '¡Ruta Completada!',
                    text: 'Has entregado todos los pedidos.',
                    icon: 'success',
                    confirmButtonText: 'Finalizar',
                    confirmButtonColor: '#4f46e5'
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
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }
    
    const result = await Swal.fire({
        title: '¿Saltar entrega?',
        text: "Esta entrega se moverá detrás de la siguiente",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6b7280',
        confirmButtonText: 'Saltar',
        customClass: { popup: 'rounded-2xl' }
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
        title: 'Entrega reordenada',
        text: `Factura #${currentDelivery.invoiceNumber} movida detrás de #${nextDelivery.invoiceNumber}`,
        icon: 'info',
        timer: 2000,
        showConfirmButton: false
    });
}

function openContactOptions(phone) {
    let cleanPhone = phone.replace(/\D/g, ''); 
    if (!cleanPhone.startsWith('57')) cleanPhone = '57' + cleanPhone;

    Swal.fire({
        title: 'Contactar',
        text: `+${cleanPhone}`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: '<i class="fab fa-whatsapp"></i> WhatsApp',
        denyButtonText: '<i class="fas fa-phone"></i> Llamar',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#25D366',
        denyButtonColor: '#4f46e5',
        customClass: {
            popup: 'rounded-2xl',
            actions: 'flex-col gap-3 w-full',
            confirmButton: 'py-3 rounded-xl font-bold',
            denyButton: 'py-3 rounded-xl font-bold order-2',
            cancelButton: 'text-gray-400 order-3'
        }
    }).then((result) => {
        if (result.isConfirmed) window.location.href = `https://wa.me/${cleanPhone}`;
        else if (result.isDenied) window.location.href = `tel:+${cleanPhone}`;
    });
}

function exportRoute() {
    if (!currentRoute) return;
    let exportText = `RUTA - ${new Date().toLocaleDateString()}\n----------------\n`;
    currentRoute.deliveries.forEach((d, i) => {
        exportText += `#${i+1} (${d.invoiceNumber}) - ${d.address} - $${d.amount}\n`;
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
        title: 'Ruta descargada',
        showConfirmButton: false,
        timer: 1500
    });
}

window.initMap = function() {
    const mapElement = document.getElementById("internal-map");
    
    if (!mapElement) {
        console.error("ERROR CRÍTICO: No encontré el div con id='internal-map'. Revisa tu HTML.");
        return;
    }

    try {
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: "#4f46e5",
                strokeWeight: 5,
                opacity: 0.7
            }
        });

        map = new google.maps.Map(mapElement, {
            zoom: 15,
            center: { lat: 11.0258331, lng: -74.8622956 },
            disableDefaultUI: true,
            zoomControl: false,
        });

        directionsRenderer.setMap(map);

        console.log("Mapa creado con éxito. Iniciando GPS...");
        startLiveTracking();

    } catch (error) {
        console.error("Error al crear el mapa de Google:", error);
    }
};

function startLiveTracking() {
    if (!navigator.geolocation) return;

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(
        updateDriverPosition,
        (err) => console.warn("Error GPS:", err.message),
        options
    );
}

function updateDriverPosition(position) {
    if (!map) return;

    const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };

    if (!driverMarker) {
        const pngIcon = {
            url: "/icons/moto.png",
            scaledSize: new google.maps.Size(30, 30), 
            anchor: new google.maps.Point(15, 15) 
        };

        driverMarker = new google.maps.Marker({
            position: newPos,
            map: map,
            icon: pngIcon,
            title: "Repartidor",
        });
        
        map.panTo(newPos);
        
    } else {
        driverMarker.setPosition(newPos);
    }
}

function updateMapRoute(destinationAddress) {
    if (!map || !driverMarker || !destinationAddress) {
        console.log("Esperando mapa o ubicación para trazar ruta...");
        return;
    }

    const myLocation = driverMarker.getPosition();

    const request = {
        origin: myLocation,
        destination: destinationAddress + ", Barranquilla",
        travelMode: google.maps.TravelMode.DRIVING
    };

    directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            directionsRenderer.setDirections(result);
        } else {
            console.warn('No se pudo trazar la ruta:', status);
        }
    });
}