let notificationsData = [];
let unreadCount = 0;
let isNotificationsOpen = false;

async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications');
        const data = await response.json();

        if (data.success) {
            notificationsData = data.notifications || [];
            unreadCount = data.unreadCount || 0;

            updateNotificationBadge();
            renderNotifications();
            
            console.log(`📢 ${notificationsData.length} notificaciones, ${unreadCount} no leídas`);
        }
    } catch (error) {
        console.error('❌ Error cargando notificaciones:', error);
        showErrorState();
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const countSpan = document.getElementById('notificationCount');
    
    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    if (countSpan) {
        if (unreadCount > 0) {
            countSpan.textContent = unreadCount;
            countSpan.classList.remove('hidden');
        } else {
            countSpan.classList.add('hidden');
        }
    }
}

function showErrorState() {
    const container = document.getElementById('notificationsList');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center py-10 text-gray-400">
            <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <i class="fas fa-exclamation-triangle text-2xl text-red-400"></i>
            </div>
            <p class="text-sm font-medium text-gray-500">Error al cargar notificaciones</p>
            <button onclick="loadNotifications()" class="mt-3 text-xs text-indigo-500 hover:underline">
                Reintentar
            </button>
        </div>
    `;
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    if (!notificationsData.length) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-bell-slash text-3xl text-gray-400"></i>
                </div>
                <p class="text-sm font-medium text-gray-500">No hay notificaciones</p>
                <p class="text-xs text-gray-400 mt-1">Las nuevas notificaciones aparecerán aquí</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';

    notificationsData.forEach(notif => {
        const isRead = notif.isRead;
        const bgClass = isRead ? 'bg-white' : 'bg-gradient-to-r from-indigo-50/50 to-white';
        const typeIcon = getNotificationIcon(notif.type);
        const bgColor = getNotificationBgColor(notif.type);

        const notifDiv = document.createElement('div');
        notifDiv.className = `
            ${bgClass} 
            border-b border-gray-100 
            hover:bg-gray-50 
            transition-all duration-200 cursor-pointer 
            ${!isRead ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}
        `;
        
        if (notif.type === 'update' && !isRead) {
            notifDiv.classList.add('shadow-[inset_0_0_15px_rgba(79,70,229,0.08)]');
        }

        notifDiv.onclick = () => {
            markNotificationAsRead(notif._id);
            if (notif.link && notif.link.trim()) {
                if (notif.link.startsWith('http')) {
                    window.open(notif.link, '_blank');
                } else {
                    window.location.href = notif.link;
                }
            }
        };
        
        const bannerHtml = (notif.imageUrl && notif.imageUrl.trim()) 
            ? `<div class="relative">
                  <img src="${escapeHtml(notif.imageUrl)}" 
                       alt="Banner" 
                       class="w-full h-32 object-cover"
                       onerror="this.src='/images/default-banner.png'">
                  ${!isRead ? `
                  <div class="absolute top-2 right-2">
                      <span class="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">Nuevo</span>
                  </div>
                  ` : ''}
               </div>`
            : (!isRead ? `
               <div class="bg-gradient-to-r from-indigo-500 to-purple-600 h-1.5"></div>
               ` : '');
            
        notifDiv.innerHTML = `
            ${bannerHtml}
            <div class="p-4">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        <div class="w-10 h-10 rounded-full ${bgColor} flex items-center justify-center shadow-sm transition-transform hover:scale-105">
                            <i class="${typeIcon} text-lg"></i>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-2 flex-wrap">
                            <h4 class="font-bold text-gray-800 text-sm break-words leading-tight">
                                ${escapeHtml(notif.title)}
                            </h4>
                            <span class="text-[10px] font-medium text-gray-400 flex-shrink-0 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                ${formatDate(notif.createdAt)}
                            </span>
                        </div>
                        <p class="text-xs text-gray-600 mt-1.5 break-words leading-relaxed">
                            ${escapeHtml(notif.message)}
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        if (notif.content && notif.content.trim()) {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'px-4 pb-4 pt-0 text-sm text-gray-700';
            
            let safeContent = notif.content;
            if (typeof DOMPurify !== 'undefined') {
                safeContent = DOMPurify.sanitize(notif.content, {
                    ALLOWED_TAGS: [
                        'div', 'p', 'span', 'strong', 'b', 'em', 'i', 'u',
                        'ul', 'ol', 'li', 'a', 'img', 'br', 'hr',
                        'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre'
                    ],
                    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style', 'target', 'class']
                });
            } else {
                safeContent = notif.content
                    .replace(/<script.*?>.*?<\/script>/gi, '')
                    .replace(/on\w+=".*?"/g, '');
            }
            
            contentDiv.innerHTML = `
                <div class="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 notification-content">
                    ${safeContent}
                </div>
            `;
            notifDiv.appendChild(contentDiv);
        }

        container.appendChild(notifDiv);
    });
}

function getNotificationIcon(type) {
    const icons = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        promotion: 'fas fa-gift',
        update: 'fas fa-rocket'
    };
    return icons[type] || 'fas fa-bell';
}

function getNotificationBgColor(type) {
    const colors = {
        info: 'bg-blue-100 text-blue-600',
        success: 'bg-green-100 text-green-600',
        warning: 'bg-yellow-100 text-yellow-600',
        promotion: 'bg-pink-100 text-pink-600',
        update: 'bg-purple-100 text-purple-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
}

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
        console.error('Error al marcar como leída:', error);
    }
}

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
                    title: 'Todas las notificaciones marcadas como leídas',
                    timer: 1500,
                    showConfirmButton: false,
                    position: 'top-end',
                    toast: true
                });
            }
        }
    } catch (error) {
        console.error('Error al marcar todas como leídas:', error);
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;

    isNotificationsOpen = !isNotificationsOpen;

    if (isNotificationsOpen) {
        dropdown.classList.remove('hidden');
        dropdown.classList.add('animate-in', 'fade-in', 'zoom-in-95', 'duration-200');
        
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

function closeNotificationsOnClickOutside(e) {
    const dropdown = document.getElementById('notificationsDropdown');
    const button = e.target.closest('[onclick="toggleNotifications()"]');
    
    if (dropdown && !dropdown.contains(e.target) && !button) {
        dropdown.classList.add('hidden');
        isNotificationsOpen = false;
        document.removeEventListener('click', closeNotificationsOnClickOutside);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    
    return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short',
        year: diffDays > 365 ? 'numeric' : undefined
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const notificationStyles = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-in {
        animation: fadeIn 0.2s ease-out;
    }
    .notification-content ul, .notification-content ol {
        padding-left: 1.25rem;
        margin: 0.5rem 0;
    }
    .notification-content li {
        margin: 0.25rem 0;
    }
    .notification-content p {
        margin: 0.5rem 0;
    }
    .notification-content a {
        color: #4f46e5;
        text-decoration: none;
    }
    .notification-content a:hover {
        text-decoration: underline;
    }
`;

if (!document.getElementById('notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        loadNotifications();
    }, 100);
});