// ========== SISTEMA DE NOTIFICACIONES ==========

let notificationsData = [];
let unreadCount = 0;
let isNotificationsOpen = false;

// =============================
// LOAD NOTIFICATIONS
// =============================
async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();

        if (data.success) {
            notificationsData = data.notifications || [];
            unreadCount = data.unreadCount || 0;

            updateNotificationBadge();
            renderNotifications();
        }
    } catch (error) {
        console.error('❌ Error cargando notificaciones:', error);
    }
}

// =============================
// BADGE
// =============================
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// =============================
// RENDER
// =============================
function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (!notificationsData.length) {
        container.innerHTML = `
            <div class="text-center py-10 text-gray-400">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i class="fas fa-bell-slash text-2xl"></i>
                </div>
                <p class="text-sm font-medium">No hay notificaciones nuevas</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    notificationsData.forEach(notif => {
        const isRead = notif.isRead;
        const bgClass = isRead ? 'bg-white' : 'bg-indigo-50/50';
        const typeIcon = notif.customIcon || getNotificationIcon(notif.type);
        const bgColor = getNotificationBgColor(notif.type);

        const notifDiv = document.createElement('div');

        notifDiv.className = `
            ${bgClass} 
            border-b border-gray-100 
            hover:bg-gray-50 
            transition-all duration-200 cursor-pointer 
            ${!isRead ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}
        `;

        // Destacar updates con un brillo sutil
        if (notif.type === 'update' && !isRead) {
            notifDiv.classList.add('shadow-[inset_0_0_15px_rgba(167,139,250,0.15)]');
        }

        notifDiv.onclick = () => {
            markNotificationAsRead(notif._id);
            if (notif.link) {
                if (notif.link.startsWith('http')) {
                    window.open(notif.link, '_blank');
                } else {
                    window.location.href = notif.link;
                }
            }
        };

        // Generar banner de imagen si existe
        const imageHtml = (notif.imageUrl && notif.imageUrl.trim()) 
            ? `<img src="${escapeHtml(notif.imageUrl)}" alt="Imagen notificación" class="w-full h-32 object-cover" />` 
            : '';

        // =============================
        // CONTENIDO BASE
        // =============================
        notifDiv.innerHTML = `
            ${imageHtml}
            <div class="p-4">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shadow-sm">
                            <i class="${typeIcon} text-lg"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-2 flex-wrap">
                            <h4 class="font-bold text-gray-800 text-sm break-words leading-tight">
                                ${escapeHtml(notif.title)}
                            </h4>
                            <span class="text-[10px] font-medium text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full">
                                ${formatDate(notif.createdAt)}
                            </span>
                        </div>
                        <p class="text-xs text-gray-600 mt-1.5 break-words line-clamp-2">
                            ${escapeHtml(notif.message)}
                        </p>
                    </div>
                </div>
            </div>
        `;

        // =============================
        // CONTENIDO HTML (QUILL)
        // =============================
        if (notif.content && notif.content.trim()) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'px-4 pb-4 pt-0 text-sm text-gray-700 prose prose-sm max-w-none';

            let safeContent = notif.content;
            if (typeof DOMPurify !== 'undefined') {
                safeContent = DOMPurify.sanitize(notif.content, {
                    ALLOWED_TAGS: [
                        'div','p','span','strong','b','em','i','u',
                        'ul','ol','li','a','img','br','hr',
                        'h1','h2','h3','h4','blockquote','code','pre'
                    ],
                    ALLOWED_ATTR: ['href','src','alt','title','style','target']
                });
            } else {
                safeContent = notif.content.replace(/<script.*?>.*?<\/script>/gi, '').replace(/on\w+=".*?"/g, '');
            }

            contentDiv.innerHTML = safeContent;
            notifDiv.appendChild(contentDiv);
        }

        container.appendChild(notifDiv);
    });
}

// =============================
// ICONOS
// =============================
function getNotificationIcon(type) {
    return {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        promotion: 'fas fa-gift',
        update: 'fas fa-rocket'
    }[type] || 'fas fa-bell';
}
function getNotificationBgColor(type) {
    return {
        info: 'bg-blue-100 text-blue-600',
        success: 'bg-green-100 text-green-600',
        warning: 'bg-yellow-100 text-yellow-600',
        promotion: 'bg-pink-100 text-pink-600',
        update: 'bg-purple-100 text-purple-600'
    }[type] || 'bg-gray-100 text-gray-600';
}
function getNotificationImage(type) {
    return {
        update: 'https://cdn-icons-png.flaticon.com/512/1828/1828919.png',
        success: 'https://cdn-icons-png.flaticon.com/512/845/845646.png',
        warning: 'https://cdn-icons-png.flaticon.com/512/595/595067.png',
        promotion: 'https://cdn-icons-png.flaticon.com/512/929/929426.png'
    }[type] || null;
}

// =============================
// MARK AS READ
// =============================
async function markNotificationAsRead(id) {
    try {
        const response = await fetch(`/api/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const notif = notificationsData.find(n => n._id === id);

            if (notif && !notif.isRead) {
                notif.isRead = true;
                unreadCount = Math.max(0, unreadCount - 1);
                updateNotificationBadge();
                renderNotifications();
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// =============================
// MARK ALL
// =============================
async function markAllNotificationsAsRead() {
    try {
        const response = await fetch('/api/notifications/mark-all-read', {
            method: 'POST'
        });

        if (response.ok) {
            notificationsData.forEach(n => n.isRead = true);
            unreadCount = 0;

            updateNotificationBadge();
            renderNotifications();

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: 'Todas leídas',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        }
    } catch (error) {
        console.error(error);
    }
}

// =============================
// TOGGLE DROPDOWN
// =============================
function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;

    isNotificationsOpen = !isNotificationsOpen;

    if (isNotificationsOpen) {
        dropdown.classList.remove('hidden');

        // 🔥 evita recarga innecesaria
        if (!notificationsData.length) {
            loadNotifications();
        }

        setTimeout(() => {
            document.addEventListener('click', closeNotificationsOnClickOutside);
        }, 100);

    } else {
        dropdown.classList.add('hidden');
        document.removeEventListener('click', closeNotificationsOnClickOutside);
    }
}

// =============================
// CLOSE OUTSIDE
// =============================
function closeNotificationsOnClickOutside(e) {
    const dropdown = document.getElementById('notificationsDropdown');

    if (!dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
        isNotificationsOpen = false;
        document.removeEventListener('click', closeNotificationsOnClickOutside);
    }
}

// =============================
// FORMAT DATE
// =============================
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();

    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours} h`;
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;

    return date.toLocaleDateString();
}

// =============================
// ESCAPE HTML
// =============================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =============================
// INIT
// =============================
document.addEventListener('DOMContentLoaded', () => {
    loadNotifications();
});