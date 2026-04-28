const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { requireAuth } = require('../../middleware/auth');
const waService = require('../../services/whatsapp');

router.post('/pair', requireAuth, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Ingresa un número de teléfono.' });
        }

        const code = await waService.requestPairingCode(phone);
        res.json({ success: true, code: code });
    } catch (error) {
        console.error('Error en pairing:', error);
        res.status(500).json({ error: 'Error al solicitar código.' });
    }
});

router.post('/send-ticket/:idOrder', requireAuth, async (req, res) => {
    try {
        if (!waService.getStatus()) {
            return res.status(503).json({ 
                success: false, 
                error: 'Función no disponible. WhatsApp no está conectado al sistema.' 
            });
        }
        
        const { idOrder } = req.params;
        const { ticket } = req.body;
        
        if (!ticket || !ticket.customer.phone) {
            return res.status(400).json({ 
                success: false, 
                error: 'Datos de la factura o teléfono del cliente inválidos.' 
            });
        }
        
        const formatMoney = (amount) => {
            return new Intl.NumberFormat('es-CO').format(amount || 0);
        };
        
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString('es-CO', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        };
        
        const doc = new PDFDocument({ 
            margin: 15, 
            size: [280, 800],
            info: {
                Title: `Factura ${ticket.order.invoiceNumber}`,
                Author: ticket.restaurant.name,
                Subject: 'Factura de pedido'
            }
        });
        
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        
        const pdfPromise = new Promise((resolve) => {
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
        });
        
        const logoPath = path.join(__dirname, '../../public/icons/192.png');
        try {
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 110, 15, { width: 60 });
                doc.moveDown(5.5);
            } else {
                doc.moveDown(1);
            }
        } catch (error) {
            doc.moveDown(1);
        }
        
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .text('FACTURA', { align: 'center' });
        
        doc.moveDown(0.3);
        doc.fontSize(9)
           .font('Helvetica')
           .text('Generada por', { align: 'center' });
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('MJFOOD', { align: 'center' });
        
        doc.moveDown(0.3);
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(ticket.restaurant.name, { align: 'center' });
        
        doc.fontSize(8)
           .font('Helvetica')
           .text(ticket.restaurant.address || '', { align: 'center' })
           .text(`Tel: ${ticket.restaurant.phone || ''}`, { align: 'center' });
        
        doc.moveDown(0.5);
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(15, doc.y)
           .lineTo(265, doc.y)
           .stroke();
        doc.moveDown(0.5);
        
        doc.fontSize(8)
           .font('Helvetica');
        
        doc.text(`Factura: ${ticket.order.invoiceNumber.split('-')[1]}`, 15, doc.y, { continued: true })
           .text(`   Pedido #: ${ticket.order.id}`, { align: 'right' });
        
        doc.text(`Fecha: ${formatDate(ticket.order.date)}`);
        
        doc.moveDown(0.3);
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(15, doc.y)
           .lineTo(265, doc.y)
           .stroke();
        doc.moveDown(0.5);
        
        doc.font('Helvetica-Bold')
           .fontSize(9)
           .text('CLIENTE', { underline: true });
        
        doc.fontSize(8)
           .font('Helvetica')
           .text(`Nombre: ${ticket.customer.name}`)
           .text(`Teléfono: ${ticket.customer.phone}`)
           .text(`Dirección: ${ticket.customer.address}`);
        
        doc.moveDown(0.3);
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(15, doc.y)
           .lineTo(265, doc.y)
           .stroke();
        doc.moveDown(0.5);
        
        doc.font('Helvetica-Bold')
           .fontSize(8);
        
        let startX = 15;
        let currentY = doc.y;
        
        doc.text('Producto', startX, currentY, { width: 120 });
        doc.text('Cant', startX + 125, currentY, { width: 25, align: 'center' });
        doc.text('Precio', startX + 155, currentY, { width: 40, align: 'right' });
        doc.text('Total', startX + 200, currentY, { width: 50, align: 'right' });
        
        currentY += 15;
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(startX, currentY)
           .lineTo(265, currentY)
           .stroke();
        
        currentY += 6;
        doc.fontSize(8)
           .font('Helvetica');
        
        ticket.products.forEach((p) => {
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
                doc.font('Helvetica-Bold').fontSize(8);
                doc.text('Producto', startX, currentY, { width: 120 });
                doc.text('Cant', startX + 125, currentY, { width: 25, align: 'center' });
                doc.text('Precio', startX + 155, currentY, { width: 40, align: 'right' });
                doc.text('Total', startX + 190, currentY, { width: 50, align: 'right' });
                currentY += 15;
                doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(startX, currentY).lineTo(265, currentY).stroke();
                currentY += 6;
                doc.font('Helvetica').fontSize(8);
            }
            
            const productName = p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name;
            doc.text(productName, startX, currentY, { width: 120 });
            doc.text(p.quantity.toString(), startX + 125, currentY, { width: 25, align: 'center' });
            doc.text(`$${formatMoney(p.unitPrice)}`, startX + 155, currentY, { width: 40, align: 'right' });
            doc.text(`$${formatMoney(p.subtotal)}`, startX + 200, currentY, { width: 50, align: 'right' });
            
            currentY += 14;
        });
        
        currentY += 2;
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(startX, currentY)
           .lineTo(265, currentY)
           .stroke();
        
        currentY += 10;
        
        doc.fontSize(9)
           .font('Helvetica');
        
        doc.text(`SUBTOTAL:`, startX, currentY);
        doc.text(`$${formatMoney(ticket.financials.subtotal)}`, startX + 190, currentY, { align: 'right' });
        currentY += 14;
        
        doc.text(`DOMICILIO:`, startX, currentY);
        doc.text(`$${formatMoney(ticket.financials.shipping)}`, startX + 190, currentY, { align: 'right' });
        currentY += 16;
        
        doc.font('Helvetica-Bold')
           .fontSize(11);
        doc.text(`TOTAL:`, startX, currentY);
        doc.text(`$${formatMoney(ticket.financials.total)}`, startX + 190, currentY, { align: 'right' });
        
        currentY += 20;
        doc.strokeColor('#000000')
           .lineWidth(1)
           .moveTo(startX, currentY)
           .lineTo(265, currentY)
           .stroke();
        currentY += 12;
        
        doc.fontSize(8)
           .font('Helvetica');
        
        if (ticket.financials.payments.length === 1) {
            doc.text(`Método de pago: ${ticket.financials.payments[0].method}`, startX, currentY);
            currentY += 12;
            doc.text(`Paga con: $${formatMoney(ticket.financials.customerGivenAmount)}`, startX, currentY);
            currentY += 12;
        } else {
            ticket.financials.payments.forEach((pay, index) => {
                doc.text(`Pago ${index + 1} (${pay.method}): $${formatMoney(pay.amount)}`, startX, currentY);
                currentY += 12;
            });
            if (ticket.financials.customerGivenAmount > ticket.financials.totalPaid) {
                doc.text(`Efectivo recibido: $${formatMoney(ticket.financials.customerGivenAmount)}`, startX, currentY);
                currentY += 12;
            }
        }
        
        if (ticket.financials.change > 0) {
            doc.font('Helvetica-Bold')
               .text(`Cambio a devolver: $${formatMoney(ticket.financials.change)}`, startX, currentY);
            currentY += 15;
        }
        
        currentY += 5;
        doc.strokeColor('#cccccc')
           .lineWidth(0.5)
           .moveTo(startX, currentY)
           .lineTo(265, currentY)
           .stroke();
        currentY += 10;
        
        doc.fontSize(8)
           .font('Helvetica')
           .text('¡Gracias por tu compra!', { align: 'center' })
           .moveDown(0.3)
           .fontSize(7)
           .font('Helvetica-Bold')
           .text('Delivery by: MJFOOD', { align: 'center' });
        
        doc.end();
        
        const pdfBuffer = await pdfPromise;
        
        await waService.sendInvoicePDF(
            ticket.customer.phone, 
            pdfBuffer, 
            ticket.order.invoiceNumber
        );
        
        res.json({ success: true, message: 'Factura enviada al cliente.' });
        
    } catch (error) {
        console.error('Error enviando PDF:', error);
        if (error.message === 'NOT_CONNECTED') {
            return res.status(503).json({ 
                success: false, 
                error: 'Función no disponible. WhatsApp desconectado.' 
            });
        }
        res.status(500).json({ success: false, error: 'Error al enviar la factura.' });
    }
});

router.get('/status', requireAuth, async (req, res) => {
    try {
        const status = waService.getStatus();
        res.json({ success: true, connected: status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;