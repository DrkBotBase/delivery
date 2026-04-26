// routes/api/deliveries.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const moment = require('moment-timezone');
const { requireAuth } = require('../../middleware/auth');
const Delivery = require('../../models/Delivery');
const Shift = require('../../models/Shift');

// ========== PRIMERO: Rutas específicas (antes que /:id) ==========

// GET /api/deliveries/pending - Entregas pendientes del día
router.get('/pending', requireAuth, async (req, res) => {
    try {
        const deliveries = await Delivery.find({
            user: req.session.userId,
            deliveryStatus: 'pendiente'
        }).sort({ createdAt: -1 }).lean();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const deliveriesWithInfo = deliveries.map(delivery => {
            const deliveryDate = new Date(delivery.createdAt || delivery.date);
            deliveryDate.setHours(0, 0, 0, 0);
            const daysPending = Math.floor((today - deliveryDate) / (1000 * 60 * 60 * 24));
            
            return {
                ...delivery,
                daysPending: daysPending,
                isLate: daysPending > 0
            };
        });

        res.json({ success: true, deliveries: deliveriesWithInfo });
    } catch (error) {
        console.error("Error en GET /api/deliveries/pending:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/deliveries/total-count - Conteo total de entregas
router.get('/total-count', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const totalCount = await Delivery.countDocuments({ user: userId });
        
        res.json({
            success: true,
            totalDeliveries: totalCount
        });
    } catch (error) {
        console.error("Error en GET /api/deliveries/total-count:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/deliveries - Obtener todas las entregas (sin paginación)
router.get('/', requireAuth, async (req, res) => {
    try {
        const deliveries = await Delivery.find({ user: req.session.userId })
            .sort({ date: -1 })
            .lean();
        res.json({ success: true, deliveries });
    } catch (error) {
        console.error("Error en GET /api/deliveries:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========== DESPUÉS: Rutas con parámetros (/:id) ==========

// GET /api/deliveries/:id - Obtener una entrega específica
router.get('/:id', requireAuth, async (req, res) => {
    try {
        // Verificar que el ID sea válido antes de buscarlo
        const { id } = req.params;
        if (!id || id.length !== 24) {
            return res.status(400).json({ success: false, error: 'ID inválido' });
        }
        
        const delivery = await Delivery.findOne({ 
            _id: id, 
            user: req.session.userId 
        });
        
        if (!delivery) {
            return res.status(404).json({ success: false, error: 'No encontrado' });
        }
        
        res.json({ success: true, delivery });
    } catch (error) {
        console.error("Error en GET /api/deliveries/:id:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/deliveries/manual - Crear entrega manual
router.post('/manual', requireAuth, async (req, res) => {
    try {
        const activeShift = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        
        const delivery = new Delivery({
            user: req.session.userId,
            invoiceNumber: 'MANUAL-' + Date.now().toString().slice(-4),
            idOrder: 0,
            numberComanda: Date.now().toString().slice(-4),
            date: moment.tz("America/Bogota").toDate(),
            amount: parseFloat(req.body.amount),
            address: req.body.address || "Dirección no agregada",
            customerName: "Pedido Manual",
            notes: req.body.notes || "Nota no agregada",
            deliveryStatus: 'pendiente',
            imageUrl: '/manual.png',
            phone: req.body.phone || '0000',
            shiftId: activeShift ? activeShift._id : null
        });

        await delivery.save();
        
        if (activeShift) {
            activeShift.totalDeliveryAmount += delivery.amount;
            await activeShift.save();
        }
        
        res.json({ success: true, delivery });
    } catch (error) {
        console.error("Error en POST /api/deliveries/manual:", error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/deliveries/:id - Actualizar entrega
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id.length !== 24) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const delivery = await Delivery.findOneAndUpdate(
            { _id: id, user: req.session.userId },
            req.body,
            { returnDocument: 'after' }
        );
        
        if (!delivery) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        
        res.json({ success: true, delivery });
    } catch (error) {
        console.error("Error en PUT /api/deliveries/:id:", error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/deliveries/:id/status - Actualizar estado de entrega
router.put('/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id.length !== 24) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const { status } = req.body;
        const updateData = { deliveryStatus: status };
        
        if (status === 'entregado') {
            updateData.deliveryTime = new Date();
        }
        
        const delivery = await Delivery.findOneAndUpdate(
            { _id: id, user: req.session.userId },
            updateData,
            { returnDocument: 'after' }
        );
        
        if (!delivery) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        
        res.json({ success: true, delivery });
    } catch (error) {
        console.error("Error en PUT /api/deliveries/:id/status:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/deliveries/:id - Eliminar entrega
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id.length !== 24) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const delivery = await Delivery.findOne({ 
            _id: id, 
            user: req.session.userId 
        });
        
        if (!delivery) {
            return res.status(404).json({ error: 'Factura no encontrada o acceso denegado' });
        }
        
        const imagePath = path.join(__dirname, '../../public', delivery.imageUrl);
        if (fs.existsSync(imagePath)) {
            try { fs.unlinkSync(imagePath); } catch(e) {}
        }
        
        await Delivery.deleteOne({ _id: id });
        
        if (delivery.shiftId) {
            const activeShift = await Shift.findOne({ 
                _id: delivery.shiftId, 
                status: 'active' 
            });
            if (activeShift) {
                activeShift.totalDeliveryAmount -= delivery.amount;
                await activeShift.save();
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("Error en DELETE /api/deliveries/:id:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;