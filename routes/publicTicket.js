const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');

// GET /t/:token  → página pública del ticket
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

// ─────────────────────────────────────────────
// Helpers de render
// ─────────────────────────────────────────────
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
          <span class="product-name">${escapeHtml(p.name)}</span>
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

<meta property="og:title" content="Resumen de pedido ${escapeHtml(t.restaurant.name)}">
<meta property="og:description" content="Consulta los detalles de tu pedido.">

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
    * { box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f3f4f6; margin: 0; padding: 20px;
        display: flex; flex-direction: column; align-items: center;
        min-height: 100vh;
    }
    #ticket {
        font-family: 'Courier New', monospace; color: #000;
        background: #fff; padding: 22px 20px; max-width: 420px; width: 100%;
        border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        line-height: 1.35;
    }
    .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 12px; }
    .header h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: 2px; }
    .header .rest-name { font-size: 15px; font-weight: bold; }
    .header .rest-info { font-size: 11px; color: #666; }

    /* Banner de aviso */
    .disclaimer-banner {
        background: #fff7ed;
        border: 1px solid #fed7aa;
        color: #9a3412;
        font-size: 11px;
        padding: 8px 10px;
        border-radius: 8px;
        text-align: center;
        margin-bottom: 12px;
        line-height: 1.4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .disclaimer-banner b { font-weight: 700; }

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

    /* Descargo legal */
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
        transition: transform 0.1s;
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
    <div id="ticket">
        <div class="header">
            <h1>📋 RESUMEN DE PEDIDO</h1>
            <div class="rest-name">${escapeHtml(t.restaurant.name)}</div>
            <div class="rest-info">${escapeHtml(t.restaurant.address || '')}</div>
            <div class="rest-info">${t.restaurant.phone ? 'Tel: ' + escapeHtml(t.restaurant.phone) : ''}</div>
        </div>

        <!-- <div class="disclaimer-banner">
            ⚠️ <b>Este documento no es una factura digital.</b><br>
            Es únicamente un resumen informativo de tu pedido.
        </div> -->

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

    <div class="actions">
        <button class="btn btn-primary" onclick="downloadPdf()">
            📄 Descargar resumen en PDF
        </button>
    </div>

    <div class="notice">
        ${days > 0
            ? `Este enlace estará disponible por <b>${days} día${days === 1 ? '' : 's'}</b>. Descarga el PDF para conservarlo.`
            : 'Este enlace está por caducar. Descarga el PDF para conservarlo.'}
    </div>

<script>
    async function downloadPdf() {
        const el = document.getElementById('ticket');
        const invoice = ${JSON.stringify(t.order.invoiceNumber)};

        const btn = event.target.closest('button');
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
<html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
    body { font-family: -apple-system, sans-serif; background: #f3f4f6; margin: 0;
        display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #fff; padding: 32px; border-radius: 16px; text-align: center;
        max-width: 380px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { font-size: 20px; margin: 0 0 12px; color: #111; }
    p { color: #6b7280; margin: 0; }
</style></head>
<body>
    <div class="card">
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
    </div>
</body></html>`;
}

module.exports = router;