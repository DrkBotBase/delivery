const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');

router.get('/t/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const delivery = await Delivery.findOne({ shareToken: token });

        if (!delivery) {
            return res.status(404).send(renderErrorPage('Ticket no encontrado'));
        }

        if (delivery.shareExpiresAt && delivery.shareExpiresAt < new Date()) {
            return res.status(410).send(renderErrorPage(
                'Este ticket ha caducado',
                'Pide a tu domiciliario que genere uno nuevo.'
            ));
        }
        
        res.set('Cache-Control', 'private, max-age=1800'); // 30 min de cache
        res.send(renderTicketPage(delivery.ticketSnapshot, delivery.shareExpiresAt));
    } catch (error) {
        console.error('Error sirviendo ticket público:', error);
        res.status(500).send(renderErrorPage('Error al cargar el ticket'));
    }
});

function formatMoney(n) {
    return new Intl.NumberFormat('es-CO').format(n || 0);
}

function formatDate(d) {
    const date = new Date(d);
    return date.toLocaleString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default:  return c;
        }
    });
}

function renderTicketPage(t, expiresAt) {
    if (!t) return renderErrorPage('Ticket vacío');

    const productsHTML = (t.products || []).map(p => `
      <div class="product-row">
          <span class="product-name">
              ${escapeHtml(p.name)}
              ${(p.adicionales && p.adicionales.length > 0) ? 
                  `<div style="font-size: 10px; color: #555;">${p.adicionales.map(a => escapeHtml(a.name)).join(', ')}</div>` : 
                  ''}
          </span>
          <span class="product-qty">${p.quantity}</span>
          <span class="product-price">$${formatMoney(p.unitPrice)}</span>
          <span class="product-total">$${formatMoney(p.subtotal)}</span>
      </div>
      ${p.observations ? `<div class="obs">📝 ${escapeHtml(p.observations)}</div>` : ''}
    `).join('');

    const days = expiresAt
        ? Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(t.restaurant.name)}</title>

<meta property="og:title" content="${escapeHtml(t.restaurant.name)}">
<meta property="og:description" content="Consulta los detalles de tu pedido.">

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #eef2f5; margin: 0; padding: 20px;
        display: flex; flex-direction: column; align-items: center;
        min-height: 100vh;
    }

    /* === MÁSCARA Y CONTENEDOR DE LA IMPRESORA === */
    .printer-wrapper {
        position: relative;
        max-width: 420px;
        width: 100%;
        margin-top: 20px;
        /* Máscara: todo lo que sobresalga por arriba queda oculto */
        overflow: hidden; 
        padding-top: 30px; /* Espacio para que la impresora quepa arriba */
    }

    /* La impresora física */
    .printer-head {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        height: 34px;
        background: linear-gradient(180deg, #2c3036 0%, #17191c 100%);
        border-radius: 12px;
        box-shadow: 0 8px 18px rgba(0,0,0,0.25);
        z-index: 10; /* Siempre sobre el ticket */
        display: flex;
        justify-content: center;
        align-items: flex-end;
        padding-bottom: 4px;
    }

    /* Ranura por donde sale el ticket */
    .printer-slot {
        width: 90%;
        height: 4px;
        background: #000;
        border-radius: 2px;
        box-shadow: inset 0 1px 2px rgba(255,255,255,0.2);
    }

    /* Luces LED indicadoras en la impresora */
    .printer-head::before {
        content: '';
        position: absolute;
        top: 8px;
        right: 18px;
        width: 6px;
        height: 6px;
        background: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 6px #10b981;
    }

    /* === ANIMACIÓN DEL TICKET === */
    #ticket {
        font-family: 'Courier New', monospace; color: #000;
        background: #fff; padding: 22px 20px 30px 20px; 
        width: 100%;
        box-shadow: 0 10px 25px rgba(0,0,0,0.08);
        line-height: 1.35;
        
        /* Estado inicial: Escondido arriba dentro de la impresora */
        transform: translateY(-100%);
        opacity: 0;

        /* Animación fluida de salida */
        animation: printReceipt 1.4s cubic-bezier(0.15, 0.85, 0.35, 1.2) forwards;
        animation-delay: 0.3s;

        /* Borde recortado inferior estilo ticket */
        mask-image: radial-gradient(circle 5px at 10px 100%, transparent 100%, #000 100%);
        mask-size: 20px 100%;
        -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 8px), transparent 100%),
                            repeating-linear-gradient(-45deg, black, black 5px, transparent 5px, transparent 10px);
    }

    @keyframes printReceipt {
        0% {
            transform: translateY(-100%);
            opacity: 0;
        }
        15% {
            opacity: 1;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }

    .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
    .header h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: 2px; }
    .header .rest-name { font-size: 15px; font-weight: bold; }
    .header .rest-info { font-size: 11px; color: #666; }

    .section { font-size: 12px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .divider { border-top: 1px dashed #ccc; margin: 10px 0; }

    .products { width: 100%; font-size: 12px; }
    .products-header {
        display: grid;
        grid-template-columns: 1fr 30px 70px 70px;
        gap: 6px;
        font-weight: bold;
        font-size: 11px;
        border-bottom: 1px solid #ccc;
        padding-bottom: 6px;
        margin-bottom: 8px;
    }
    .product-row {
        display: grid;
        grid-template-columns: 1fr 30px 70px 70px;
        gap: 6px;
        align-items: start;
        padding: 4px 0;
        border-bottom: 1px dashed #eee;
    }
    .product-row:last-child { border-bottom: none; }
    .product-name { word-break: break-word; line-height: 1.3; }
    .product-qty  { text-align: center; }
    .product-price,
    .product-total { text-align: right; white-space: nowrap; }
    .product-total { font-weight: bold; }
    .obs {
        font-size: 10px;
        color: #666;
        padding-left: 6px;
        margin: 2px 0 6px;
        line-height: 1.3;
    }
    .totals { font-size: 13px; margin-bottom: 6px; }
    .totals .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .totals .total-row {
        font-size: 16px; font-weight: bold;
        border-top: 1px solid #000;
        margin-top: 8px;
        padding-top: 8px;
    }
    .footer { text-align: center; font-size: 10px; color: #666; padding-top: 8px; }

    .legal {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 9px;
        color: #9ca3af;
        text-align: center;
        line-height: 1.45;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #f3f4f6;
    }
    .legal b { color: #6b7280; font-weight: 600; }

    .actions {
        max-width: 420px; width: 100%; margin-top: 16px;
        display: flex; flex-direction: column; gap: 10px;
    }
    .btn {
        padding: 14px; border-radius: 12px; border: none;
        font-size: 15px; font-weight: bold; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: transform 0.1s, background 0.2s;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: #25D366; color: #fff; box-shadow: 0 4px 10px rgba(37,211,102,0.3); }
    .notice {
        max-width: 420px; width: 100%; margin-top: 12px;
        text-align: center; font-size: 12px; color: #6b7280;
    }
</style>
</head>
<body>

    <!-- Envoltorio de la impresora con la animación -->
    <div class="printer-wrapper">
        <div class="printer-head">
            <div class="printer-slot"></div>
        </div>

        <div id="ticket">
            <div class="header">
                <h1>📋 RESUMEN DE PEDIDO</h1>
                <div class="rest-name">${escapeHtml(t.restaurant.name)}</div>
                <div class="rest-info">${escapeHtml(t.restaurant.address || '')}</div>
                <div class="rest-info">${t.restaurant.phone ? 'Tel: ' + escapeHtml(t.restaurant.phone) : ''}</div>
            </div>

            <div class="section">
                <div class="row"><b>Factura:</b> <span>${escapeHtml(t.order.invoiceNumber)}</span></div>
                <div class="row"><b>Pedido #:</b> <span>${escapeHtml(t.order.id)}</span></div>
                <div class="row"><b>Fecha:</b> <span>${formatDate(t.order.date)}</span></div>
            </div>

            <div class="divider"></div>

            <div class="section">
                <div class="row"><b>Cliente:</b> <span>${escapeHtml(t.customer.name)}</span></div>
                <div class="row"><b>Teléfono:</b> <span>${escapeHtml(t.customer.phone)}</span></div>
                <div class="row"><b>Dirección:</b> <span style="text-align:right;max-width:65%;">${escapeHtml(t.customer.address)}</span></div>
            </div>

            <div class="divider"></div>

            <div class="products">
                <div class="products-header">
                    <span>Producto</span>
                    <span style="text-align:center;">Cant</span>
                    <span style="text-align:right;">Precio</span>
                    <span style="text-align:right;">Total</span>
                </div>
                ${productsHTML}
            </div>

            <div class="divider"></div>

            <div class="totals">
                <div class="row"><span>SUBTOTAL:</span> <span>$${formatMoney(t.financials.subtotal)}</span></div>
                <div class="row"><span>DOMICILIO:</span> <span>$${formatMoney(t.financials.shipping)}</span></div>
                ${(t.financials.payments || []).map(p => `
                    <div class="row"><span>${escapeHtml(p.method)}:</span> <span>$${formatMoney(p.amount)}</span></div>
                `).join('')}
                <div class="row total-row"><span>TOTAL:</span> <span>$${formatMoney(t.financials.total)}</span></div>
                ${(t.financials.change && t.financials.change > 0) ? `
                    <div class="row"><span>Cambio:</span> <span>$${formatMoney(t.financials.change)}</span></div>
                ` : ''}
            </div>

            <div class="divider"></div>

            <div class="footer">
                <div>✨ ¡Gracias por tu compra! ✨</div>
            </div>

            <div class="legal">
                <b>Aviso legal:</b> Este documento es un resumen generado automáticamente
                con fines informativos y de consulta para el cliente. <b>No constituye
                una factura electrónica, comprobante fiscal, ni documento equivalente</b>
                según la normativa tributaria vigente (DIAN u otra autoridad competente).
                Los valores aquí presentados provienen del sistema del comercio y pueden
                variar respecto al comprobante oficial emitido por el establecimiento.
                Para efectos fiscales, garantías o reclamaciones, solicite la factura
                oficial directamente al restaurante.
            </div>
        </div>
    </div>

    <div class="actions">
        <button class="btn btn-primary" onclick="downloadPdf(event)">
            📄 Descargar resumen en PDF
        </button>
    </div>

    <div class="notice">
        ${days > 0
            ? `Este enlace estará disponible por <b>${days} día${days === 1 ? '' : 's'}</b>. Descarga el PDF para conservarlo.`
            : 'Este enlace está por caducar. Descarga el PDF para conservarlo.'}
    </div>

<script>
    async function downloadPdf(e) {
        const el = document.getElementById('ticket');
        const invoice = ${JSON.stringify(t.order.invoiceNumber)};

        const btn = e ? e.target.closest('button') : document.querySelector('.btn-primary');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Generando PDF...';
        btn.disabled = true;

        try {
            await html2pdf().set({
                margin: 5,
                filename: 'resumen-' + invoice + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' }
            }).from(el).save();
            btn.innerHTML = '✅ ¡Descargado!';
            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
        } catch (err) {
            console.error(err);
            btn.innerHTML = '❌ Error';
            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
        }
    }
</script>
</body>
</html>`;
}

function renderErrorPage(title, subtitle = '') {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
    * { box-sizing: border-box; }
    body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        background: #eef2f5; 
        margin: 0;
        display: flex; 
        align-items: center; 
        justify-content: center; 
        min-height: 100vh; 
        padding: 20px; 
    }
    .card { 
        background: #ffffff; 
        padding: 40px 32px; 
        border-radius: 20px; 
        text-align: center;
        max-width: 400px; 
        width: 100%;
        box-shadow: 0 10px 25px rgba(0,0,0,0.06); 
        animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .icon-wrapper {
        width: 64px;
        height: 64px;
        background: #fef2f2;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        color: #ef4444;
    }
    .icon-wrapper svg {
        width: 32px;
        height: 32px;
    }
    h1 { 
        font-size: 20px; 
        font-weight: 700;
        margin: 0 0 8px; 
        color: #1f2937; 
    }
    p { 
        color: #6b7280; 
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 24px; 
    }
    .btn-retry {
        display: inline-block;
        width: 100%;
        padding: 12px 20px;
        background: #1f2937;
        color: #ffffff;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
    }
    .btn-retry:hover {
        background: #111827;
    }
    .btn-retry:active {
        transform: scale(0.98);
    }
</style>
</head>
<body>
    <div class="card">
        <div class="icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : '<p>No pudimos cargar la información del documento en este momento o el ticket caducó.</p>'}
        <button class="btn-retry" onclick="window.location.reload()">Reintentar</button>
    </div>
</body>
</html>`;
}


module.exports = router;
