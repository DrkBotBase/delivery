class PWAHandler {
    constructor() {
        this.deferredPrompt = null;
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isAndroid = /Android/.test(navigator.userAgent);
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        this.init();
    }

    init() {
        if (!this.isIOS && !this.isStandalone) {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                //console.log('✅ beforeinstallprompt disponible');
                
                setTimeout(() => {
                    if (!this.isStandalone && this.deferredPrompt) {
                        this.showInstallPromotion();
                    }
                }, 5000);
            });
        }

        window.addEventListener('appinstalled', () => {
            //console.log('🎉 App instalada exitosamente');
            this.hideInstallPromotion();
            this.deferredPrompt = null;
            this.isStandalone = true;
            document.documentElement.setAttribute('data-pwa-installed', 'true');
            
            if (typeof gtag !== 'undefined') {
                gtag('event', 'install', {
                    'event_category': 'PWA',
                    'event_label': 'App installed'
                });
            }
        });

        this.handleNetworkStatus();
        this.initNotifications();
        
        if (this.isStandalone) {
            document.documentElement.setAttribute('data-pwa-installed', 'true');
        }
    }

    showInstallPromotion() {
        if (this.isStandalone || 
            document.getElementById('pwa-install-banner') || 
            document.getElementById('pwa-update-banner') ||
            document.getElementById('pwa-manual-install') ||
            !this.deferredPrompt) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.className = 'pwa-banner';
        
        banner.innerHTML = `
            <div class="pwa-content">
                <div class="pwa-icon">📱</div>
                <div class="pwa-info">
                    <h3>Instalar Delivery App</h3>
                    <p>Instálala para acceso rápido, notificaciones y trabajar sin conexión.</p>
                </div>
            </div>
            <div class="pwa-actions">
                <button id="pwa-close-btn" class="btn-text">Ahora no</button>
                <button id="pwa-accept-btn" class="btn-primary">Instalar</button>
            </div>
        `;

        document.body.appendChild(banner);

        const installBtn = banner.querySelector('#pwa-accept-btn');
        installBtn.addEventListener('click', () => {
            this.installApp();
        });

        const closeBtn = banner.querySelector('#pwa-close-btn');
        closeBtn.addEventListener('click', () => {
            banner.style.opacity = '0';
            banner.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => banner.remove(), 300);
            
            localStorage.setItem('pwa-banner-hidden', Date.now());
        });

        this.styleInstallBanner();
        setTimeout(() => {
            if (banner.parentNode) {
                banner.style.opacity = '0';
                banner.style.transform = 'translate(-50%, 20px)';
                setTimeout(() => banner.remove(), 300);
            }
        }, 30000);
    }

    styleInstallBanner() {
        if (document.querySelector('#pwa-banner-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pwa-banner-styles';
        style.textContent = `
            :root {
                --pwa-primary: #2563EB;
                --pwa-primary-hover: #1d4ed8;
                --pwa-text: #111827;
                --pwa-text-light: #6B7280;
                --pwa-bg: #ffffff;
                --pwa-shadow: 0 10px 25px rgba(0,0,0,0.15);
                --pwa-radius: 16px;
            }
            
            [data-pwa-installed="true"] .pwa-banner {
                display: none !important;
            }
            
            .pwa-banner {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: min(90%, 400px);
                background: var(--pwa-bg);
                padding: 20px;
                border-radius: var(--pwa-radius);
                box-shadow: var(--pwa-shadow);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                animation: pwaSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                border: 1px solid rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            
            @keyframes pwaSlideUp {
                from {
                    opacity: 0;
                    transform: translate(-50%, 20px);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
            }
            
            .pwa-content {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .pwa-icon {
                font-size: 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                width: 50px;
                height: 50px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 12px;
                color: white;
                flex-shrink: 0;
            }
            
            .pwa-info h3 {
                margin: 0 0 6px 0;
                font-size: 16px;
                color: var(--pwa-text);
                font-weight: 700;
            }
            
            .pwa-info p {
                margin: 0;
                font-size: 13px;
                color: var(--pwa-text-light);
                line-height: 1.5;
            }
            
            .pwa-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .pwa-actions button {
                cursor: pointer;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.2s ease;
                font-family: inherit;
            }
            
            .btn-text {
                background: transparent;
                color: var(--pwa-text-light);
            }
            
            .btn-text:hover {
                background: #f3f4f6;
                color: #374151;
            }
            
            .btn-primary {
                background: var(--pwa-primary);
                color: white;
            }
            
            .btn-primary:hover {
                background: var(--pwa-primary-hover);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
            
            @media (max-width: 480px) {
                .pwa-banner {
                    width: 95%;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-radius: var(--pwa-radius);
                    animation: pwaSlideUpMobile 0.4s ease-out;
                }
                
                @keyframes pwaSlideUpMobile {
                    from { 
                        opacity: 0;
                        transform: translate(-50%, 100%); 
                    }
                    to { 
                        opacity: 1;
                        transform: translate(-50%, 0); 
                    }
                }
                
                .pwa-actions {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .pwa-actions button {
                    width: 100%;
                    padding: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    hideInstallPromotion() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.style.opacity = '0';
            banner.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => banner.remove(), 300);
        }
    }

    async installApp() {
        if (!this.deferredPrompt) {
            this.showManualInstallInstructions();
            return;
        }
        
        try {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            //console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
            
            if (typeof gtag !== 'undefined') {
                gtag('event', outcome === 'accepted' ? 'install_accepted' : 'install_rejected', {
                    'event_category': 'PWA',
                    'event_label': outcome
                });
            }
            
        } catch (error) {
            console.error('Error durante la instalación:', error);
            this.showManualInstallInstructions();
        } finally {
            this.deferredPrompt = null;
            this.hideInstallPromotion();
        }
    }

    showManualInstallInstructions() {
        if (document.getElementById('pwa-manual-install')) return;
        
        const instructions = document.createElement('div');
        instructions.id = 'pwa-manual-install';
        instructions.innerHTML = `
            <div class="pwa-modal-overlay">
                <div class="pwa-modal">
                    <div class="pwa-modal-header">
                        <h3>📲 Instalar Delivery App</h3>
                        <button class="pwa-modal-close">&times;</button>
                    </div>
                    <div class="pwa-modal-content">
                        ${this.isIOS ? `
                            <div class="install-step">
                                <span class="step-number">1</span>
                                <p>Toca el botón <strong>Compartir</strong> (📤) en Safari</p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">2</span>
                                <p>Desplázate hacia abajo y selecciona <strong>Añadir a Inicio</strong></p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">3</span>
                                <p>Toca <strong>Añadir</strong> en la esquina superior derecha</p>
                            </div>
                        ` : this.isAndroid ? `
                            <div class="install-step">
                                <span class="step-number">1</span>
                                <p>Toca el menú (⋮) en la esquina superior derecha de Chrome</p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">2</span>
                                <p>Selecciona <strong>Añadir a la pantalla de inicio</strong></p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">3</span>
                                <p>Confirma tocando <strong>Añadir</strong></p>
                            </div>
                        ` : `
                            <div class="install-step">
                                <span class="step-number">1</span>
                                <p><strong>Chrome/Edge:</strong> Menú ⋮ → "Instalar Delivery App"</p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">2</span>
                                <p><strong>Firefox:</strong> Menú ☰ → "Instalar"</p>
                            </div>
                            <div class="install-step">
                                <span class="step-number">3</span>
                                <p><strong>Safari:</strong> Archivo → "Añadir a pantalla de inicio"</p>
                            </div>
                        `}
                    </div>
                    <div class="pwa-modal-footer">
                        <button class="pwa-modal-button" id="pwa-modal-understood">Entendido</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(instructions);
        
        this.styleManualInstallModal();
        
        document.querySelector('.pwa-modal-close').addEventListener('click', () => {
            instructions.remove();
        });
        
        document.getElementById('pwa-modal-understood').addEventListener('click', () => {
            instructions.remove();
        });
        
        document.querySelector('.pwa-modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('pwa-modal-overlay')) {
                instructions.remove();
            }
        });
    }

    styleManualInstallModal() {
        if (document.querySelector('#pwa-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pwa-modal-styles';
        style.textContent = `
            .pwa-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            .pwa-modal {
                background: white;
                border-radius: 16px;
                max-width: 450px;
                width: 100%;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                animation: slideUp 0.4s ease;
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .pwa-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .pwa-modal-header h3 {
                margin: 0;
                font-size: 18px;
                color: #111827;
            }
            
            .pwa-modal-close {
                background: transparent;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                line-height: 1;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            
            .pwa-modal-close:hover {
                background: #f3f4f6;
                color: #111827;
            }
            
            .pwa-modal-content {
                padding: 24px;
            }
            
            .install-step {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .install-step:last-child {
                margin-bottom: 0;
            }
            
            .step-number {
                background: #2563EB;
                color: white;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                flex-shrink: 0;
            }
            
            .install-step p {
                margin: 0;
                color: #4b5563;
                line-height: 1.5;
                font-size: 15px;
            }
            
            .install-step strong {
                color: #111827;
            }
            
            .pwa-modal-footer {
                padding: 20px 24px;
                border-top: 1px solid #e5e7eb;
                text-align: right;
            }
            
            .pwa-modal-button {
                background: #2563EB;
                color: white;
                border: none;
                padding: 12px 28px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .pwa-modal-button:hover {
                background: #1d4ed8;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
            
            @media (max-width: 480px) {
                .pwa-modal {
                    max-width: 100%;
                }
                
                .pwa-modal-header,
                .pwa-modal-content,
                .pwa-modal-footer {
                    padding: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    handleNetworkStatus() {
        const updateOnlineStatus = () => {
            if (!navigator.onLine) {
                this.showOfflineMessage();
            } else {
                this.hideOfflineMessage();
            }
        };
        
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
    }

    showOfflineMessage() {
        if (document.getElementById('offline-message')) return;
        
        const offlineMessage = document.createElement('div');
        offlineMessage.id = 'offline-message';
        offlineMessage.innerHTML = `
            <div class="offline-content">
                <span>⚠️ Estás trabajando sin conexión</span>
                <small>Tus cambios se sincronizarán cuando recuperes conexión</small>
            </div>
        `;
        document.body.appendChild(offlineMessage);
        
        this.styleOfflineMessage();
    }

    styleOfflineMessage() {
        if (document.querySelector('#offline-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'offline-styles';
        style.textContent = `
            #offline-message {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #f93f3f 0%, #dc2626 100%);
                color: white;
                z-index: 1000;
                animation: slideDown 0.3s ease;
                box-shadow: 0 2px 10px rgba(220, 38, 38, 0.3);
            }
            
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                }
                to {
                    transform: translateY(0);
                }
            }
            
            .offline-content {
                max-width: 1200px;
                margin: 0 auto;
                padding: 12px 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
            }
            
            .offline-content span {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 2px;
            }
            
            .offline-content small {
                font-size: 12px;
                opacity: 0.9;
            }
            
            @media (max-width: 768px) {
                .offline-content {
                    padding: 10px 16px;
                }
                
                .offline-content span {
                    font-size: 13px;
                }
                
                .offline-content small {
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    hideOfflineMessage() {
        const offlineMessage = document.getElementById('offline-message');
        if (offlineMessage) {
            offlineMessage.style.transform = 'translateY(-100%)';
            setTimeout(() => offlineMessage.remove(), 300);
        }
    }

    async initNotifications() {
        if (!('Notification' in window) || Notification.permission === 'granted') {
            return;
        }
        //console.log('Notificaciones disponibles');
    }

    async shareApp() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Delivery App',
                    text: 'Instala la app de seguimiento de entregas para una mejor experiencia',
                    url: window.location.href
                });
                
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'share', {
                        'event_category': 'PWA',
                        'event_label': 'App shared'
                    });
                }
                
            } catch (error) {
                //console.log('Error al compartir:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                this.showToast('✅ URL copiada al portapapeles');
            } catch (err) {
                console.error('Error al copiar URL: ', err);
                this.showToast('❌ No se pudo copiar la URL');
            }
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            animation: toastIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
        
        if (!document.querySelector('#toast-animation')) {
            const style = document.createElement('style');
            style.id = 'toast-animation';
            style.textContent = `
                @keyframes toastIn {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    addShareButton() {
        if (this.isStandalone) return;
        
        if (navigator.share || navigator.clipboard) {
            const shareButton = document.createElement('button');
            shareButton.id = 'pwa-share-button';
            shareButton.className = 'pwa-share-btn';
            shareButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
            `;
            
            shareButton.addEventListener('click', () => this.shareApp());
            
            const installButton = document.getElementById('pwa-install-banner');
            if (installButton) {
                installButton.insertAdjacentElement('afterend', shareButton);
            } else {
                document.body.appendChild(shareButton);
            }
            
            this.styleShareButton();
        }
    }

    styleShareButton() {
        if (document.querySelector('#share-button-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'share-button-styles';
        style.textContent = `
            #pwa-share-button {
                position: fixed;
                bottom: 25px;
                right: 25px;
                width: 56px;
                height: 56px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 50%;
                font-weight: bold;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
                cursor: pointer;
                z-index: 999;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                animation: fadeInBottom 0.5s ease-out forwards;
            }
            
            @keyframes fadeInBottom {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #pwa-share-button:hover {
                transform: scale(1.1) translateY(-2px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                filter: brightness(1.1);
            }
            
            #pwa-share-button:active {
                transform: scale(0.98);
            }
            
            #pwa-share-button svg {
                width: 22px;
                height: 22px;
            }
            
            @media (max-width: 768px) {
                #pwa-share-button {
                    width: 52px;
                    height: 52px;
                    bottom: 20px;
                    right: 20px;
                }
                
                #pwa-share-button svg {
                    width: 20px;
                    height: 20px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pwaHandler = new PWAHandler();
    
    setTimeout(() => {
        window.pwaHandler.addShareButton();
    }, 2000);
});

function checkPWAInstallation() {
    if (window.pwaHandler) {
        window.pwaHandler.showInstallPromotion();
    }
}

function triggerShare() {
    if (window.pwaHandler) {
        window.pwaHandler.shareApp();
    }
}