let isUpdating = false;

async function loadPage(page) {
    if (isUpdating) return;
    
    isUpdating = true;
    const container = document.getElementById('deliveriesContainer');
    if (container) container.style.opacity = '0.5';
    
    const urlParams = new URLSearchParams(window.location.search);
    const search = urlParams.get('search') || '';

    try {
      const res = await fetch(`/api/transactions?page=${page}&limit=10&search=${encodeURIComponent(search)}`);
        
        if (!checkSession(res)) return;

        const data = await res.json();
        
        if (typeof renderTransactions === 'function') {
            renderTransactions(data.items || []);
        } else {
            console.error('❌ renderTransactions no está definida');
        }
        
        if (typeof updatePaginationControls === 'function') {
            updatePaginationControls(data.page, data.totalPages);
        }
        
        const todayTotalElement = document.getElementById('todayTotalDisplay');
        if (todayTotalElement && data.todayTotal !== undefined) {
            todayTotalElement.textContent = `$${data.todayTotal.toLocaleString('es-CO')}`;
        }
        
        await checkShiftStatus();
        
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('page', page);
        window.history.pushState({}, '', newUrl);
    } catch (error) {
        console.error('❌ Error cargando página:', error);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-10 bg-red-50 rounded-2xl border border-red-200">
                    <i class="fas fa-exclamation-triangle text-3xl text-red-400 mb-3"></i>
                    <p class="text-red-600">Error al cargar los datos</p>
                    <p class="text-xs text-gray-500 mt-2">${error.message}</p>
                    <button onclick="loadPage(1)" class="mt-3 text-indigo-500 text-sm underline">Reintentar</button>
                </div>`;
        }
    } finally {
        if (container) container.style.opacity = '1';
        isUpdating = false;
    }
}

function renderTransactions(items) {
    const container = document.getElementById('deliveriesContainer');
    
    if (!container) return;
    
    if (!window.activeShift) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                <i class="fas fa-lock text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500 font-medium">No hay una jornada activa</p>
                <p class="text-xs text-gray-400 mt-2">Inicia una jornada para comenzar a registrar entregas</p>
                <button onclick="startShift()" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
                    <i class="fas fa-power-off mr-1"></i> Iniciar Jornada
                </button>
            </div>`;
        return;
    }
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-300">
                <i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                <p class="text-gray-500">No hay entregas en la jornada actual</p>
                <p class="text-xs text-gray-400 mt-2">Las entregas que importes aparecerán aquí</p>
            </div>`;
        return;
    }

    window.deliveriesData = items;

    let html = '';
    
    for (const item of items) {
        const isExpense = item.type === 'expense';
        const itemDate = new Date(item.sortDate || item.createdAt || item.date);
        const timeStr = itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = itemDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        
        const borderColor = isExpense ? 'border-red-100' : 'border-gray-100';
        const indicatorColor = isExpense ? 'bg-red-500' : 'bg-indigo-500';
        const amountSign = isExpense ? '-' : '';
        const bgHover = isExpense ? 'hover:bg-red-50' : 'hover:bg-gray-50';
        
        const safeAmount = item.amount || 0;
        
        let clickAction;
        let displayText;
        let addressText;
        let icon;
        
        if (isExpense) {
            const safeDescription = (item.description || '').replace(/'/g, "\\'");
            clickAction = `Swal.fire('Gasto', '${safeDescription}: $${safeAmount.toLocaleString('es-CO')}', 'info')`;
            displayText = `💰 Gasto: ${item.description || 'Sin descripción'}`;
            addressText = (item.description || '').substring(0, 50);
            icon = 'fa-receipt';
        } else {
            clickAction = `openDeliveryModal('${item._id}')`;
            displayText = `📦 #${item.invoiceNumber || 'N/A'}`;
            addressText = item.address ? (item.address.length > 50 ? item.address.substring(0, 50) + '...' : item.address) : (item.notes || 'Sin dirección');
            icon = 'fa-location-dot';
        }
        
        html += `
            <div onclick="${clickAction}" 
                 class="bg-white p-3 rounded-xl shadow-sm border ${borderColor} ${bgHover} flex justify-between items-center transition cursor-pointer relative overflow-hidden hover:shadow-md">
                <div class="absolute left-0 top-0 bottom-0 w-1 ${indicatorColor}"></div>
                <div class="pl-2 flex-1">
                    <div class="flex items-center justify-between flex-wrap gap-1">
                        <h3 class="font-bold text-gray-800 text-sm">
                            <span class="${isExpense ? 'text-red-600' : 'text-indigo-600'}">${displayText}</span>
                        </h3>
                        <div class="flex items-center gap-1">
                            <span class="text-[9px] text-gray-400">${dateStr}</span>
                            <span class="text-[10px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded-full">${timeStr}</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <i class="fas ${icon} text-[10px] text-gray-400"></i>
                        ${addressText}
                    </p>
                </div>
                <div class="text-right ml-2">
                    <span class="block font-bold text-base ${isExpense ? 'text-red-500' : 'text-gray-800'}">
                        ${amountSign}$${safeAmount.toLocaleString('es-CO')}
                    </span>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updatePaginationControls(page, totalPages) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageLabel = document.getElementById('pageLabel');

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
        prevBtn.onclick = () => loadPage(page - 1);
    }
    if (nextBtn) {
        nextBtn.disabled = page >= totalPages;
        nextBtn.onclick = () => loadPage(page + 1);
    }
    if (pageLabel) {
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

document.addEventListener('DOMContentLoaded', function() {
    checkShiftStatus();
    loadPage(1);
});