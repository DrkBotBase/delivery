const path = require('path');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const fs = require('fs');
const crypto = require('crypto');
const moment = require('moment-timezone');

const Delivery = require('../models/Delivery');
const Shift = require('../models/Shift');
const Expense = require('../models/Expense');
const User = require('../models/User');

const { requireAuth } = require('../middleware/auth');
const { info } = require('../config');

router.get('/report/:token', async (req, res) => {
    try {
        const shift = await Shift.findOne({ shareToken: req.params.token });
        
        if (!shift) {
            return res.status(404).send(`
                <div style="text-align:center; padding:50px; font-family:sans-serif;">
                    <h1>⚠️ Enlace no válido</h1>
                    <p>Este reporte no existe o fue eliminado.</p>
                </div>
            `);
        }

        const [deliveries, expenses] = await Promise.all([
            Delivery.find({ shiftId: shift._id }).sort({ date: -1 }).lean(),
            Expense.find({ shiftId: shift._id }).sort({ date: -1 }).lean()
        ]);

        const totalVentas = deliveries.reduce((sum, d) => sum + d.amount, 0);
        const totalGastos = expenses.reduce((sum, e) => sum + e.amount, 0);
        const dineroEnCaja = (shift.baseMoney || 0) + totalVentas - totalGastos;

        const items = [
            ...deliveries.map(d => ({ ...d, type: 'delivery' })),
            ...expenses.map(e => ({ ...e, type: 'expense', date: e.date }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.render('report', { 
            info,
            title: `${info.name_page} | Reporte Jornada`,
            shift, 
            items,
            stats: {
                base: shift.baseMoney || 0,
                ventas: totalVentas,
                gastos: totalGastos,
                caja: dineroEnCaja,
                count: deliveries.length
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error interno del servidor');
    }
});

router.get('/', (req, res) => {
    res.render('landing', {
      info,
      title: `${info.name_page} | Home`,
    });
});

router.get('/panel', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, shiftId } = req.query;
        const userId = req.session.userId;
        
        let deliveryQuery = { user: userId };
        if (shiftId) deliveryQuery.shiftId = shiftId;
        if (search) {
            deliveryQuery.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }
        
        let expenseQuery = { user: userId };
        if (shiftId) expenseQuery.shiftId = shiftId;
        if (search) {
            expenseQuery.description = { $regex: search, $options: 'i' };
        }

        const [allDeliveries, allExpenses] = await Promise.all([
            Delivery.find(deliveryQuery).sort({ date: -1 }).lean(),
            Expense.find(expenseQuery).sort({ date: -1 }).lean()
        ]);

        const formattedDeliveries = allDeliveries.map(d => ({ 
            ...d, 
            type: 'delivery'
        }));
        
        const formattedExpenses = allExpenses.map(e => ({
            ...e,
            type: 'expense',
            invoiceNumber: 'GASTO',
            customerName: 'Egreso',
            address: e.description,
            date: e.date
        }));

        let combinedData = [...formattedDeliveries, ...formattedExpenses];
        combinedData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const totalDocs = combinedData.length;
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        
        const paginatedItems = combinedData.slice(startIndex, endIndex);

        const totalDeliveriesAmount = allDeliveries.reduce((sum, d) => sum + d.amount, 0);
        const totalExpensesAmount = allExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netTotal = totalDeliveriesAmount - totalExpensesAmount;

        const allUserDeliveries = await Delivery.find({ user: userId });
        res.render('layout', {
            info,
            title: `${info.name_page} | Dashboard`,
            deliveries: paginatedItems,
            total: netTotal,
            todayTotal: calculateTodayTotal(allUserDeliveries),
            pagination: {
                totalDocs: totalDocs,
                totalPages: Math.ceil(totalDocs / limit),
                page: parseInt(page),
                hasNextPage: endIndex < totalDocs,
                hasPrevPage: startIndex > 0
            },
            filters: {
                search,
                shiftId
            }
        });

    } catch (error) {
        console.error("Error en home:", error);
        res.status(500).send("Error en el servidor");
    }
});

router.get('/api/shifts/history', requireAuth, async (req, res) => {
    try {
        const shifts = await Shift.find({ user: req.session.userId })
            .sort({ startTime: -1 })
            .limit(20);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/deliveries', requireAuth, async (req, res) => {
    try {
        const deliveries = await Delivery.find({ user: req.session.userId }).sort({ date: -1 });
        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.session.userId);

    const deliveries = await Delivery.aggregate([
      { $match: { user: userObjectId } },
      {
        $group: {
          _id: {
            $dateToString: { 
              format: "%Y-%m-%d",
              date: "$date",
              timezone: "America/Bogota"
            }
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);
    
    const todayCol = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).split('/').reverse().join('-');

    const todayStats = deliveries.find(d => d._id === todayCol);

    res.json({
      total: deliveries.reduce((sum, d) => sum + d.total, 0),
      today: todayStats || { total: 0, count: 0 },
      history: deliveries
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/deliveries/:id', requireAuth, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ _id: req.params.id, user: req.session.userId });
    
    if (!delivery) {
      return res.status(404).json({ error: 'Factura no encontrada o acceso denegado' });
    }
    
    const imagePath = path.join(
      __dirname,
      '../public',
      delivery.imageUrl
    );
    if (fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch(e){}
    }
    
    await Delivery.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Error borrando factura:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/deliveries/:id', requireAuth, async (req, res) => {
    try {
        const delivery = await Delivery.findOneAndUpdate(
            { _id: req.params.id, user: req.session.userId },
            req.body,
            { new: true }
        );
        if(!delivery) return res.status(404).json({error: 'No encontrado'});
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/deliveries/:id', requireAuth, async (req, res) => {
    try {
        const delivery = await Delivery.findOne({ _id: req.params.id, user: req.session.userId });
        if(!delivery) return res.status(404).json({error: 'No encontrado'});
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/deliveries/pending', requireAuth, async (req, res) => {
    try {
        const deliveries = await Delivery.find({
            user: req.session.userId,
            deliveryStatus: 'pendiente',
            date: {
                $gte: new Date().setHours(0, 0, 0, 0),
                $lt: new Date().setHours(23, 59, 59, 999)
            }
        }).sort({ createdAt: 1 });

        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/delivery/:id/status', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const updateData = { deliveryStatus: status };
        
        if (status === 'entregado') {
            updateData.deliveryTime = new Date();
        }
        
        const delivery = await Delivery.findOneAndUpdate(
            { _id: req.params.id, user: req.session.userId },
            updateData,
            { new: true }
        );
        
        if(!delivery) return res.status(404).json({error: 'No encontrado'});
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/route/start', requireAuth, async (req, res) => {
    try {
        const today = moment.tz("America/Bogota").startOf('day').toDate();
        const tomorrow = moment.tz("America/Bogota").endOf('day').toDate();

        const pendingDeliveries = await Delivery.find({
            user: req.session.userId,
            deliveryStatus: 'pendiente',
            date: {
                $gte: today,
                $lte: tomorrow
            }
        });

        if (!pendingDeliveries || pendingDeliveries.length === 0) {
            return res.json({
                success: true,
                deliveries: [],
                totalEstimatedTime: 0,
                pendingCount: 0
            });
        }

        res.json({
            success: true,
            deliveries: pendingDeliveries,
            totalEstimatedTime: calculateEstimatedTime(pendingDeliveries),
            pendingCount: pendingDeliveries.length,
            optimizeEnabled: false
        });
        
    } catch (error) {
        console.error('❌ Error en /api/route/start:', error);
        res.status(500).json({ 
            success: false,
            error: error.message
        });
    }
});
function calculateEstimatedTime(deliveries) {
    const TIME_PER_DELIVERY = 5;
    return deliveries.length * TIME_PER_DELIVERY;
}

router.post('/api/shift/start', requireAuth, async (req, res) => {
    try {
        const existing = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        if (existing) return res.status(400).json({ error: 'Ya tienes una jornada abierta' });

        const newShift = new Shift({
            user: req.session.userId,
            baseMoney: req.body.base || 0,
            shareToken: crypto.randomBytes(16).toString('hex')
        });
        await newShift.save();
        res.json({ success: true, shift: newShift });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/shift/current', requireAuth, async (req, res) => {
    try {
        const shift = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        if (!shift) return res.json({ active: false });
      
        const deliveries = await Delivery.find({ shiftId: shift._id });
        const expenses = await Expense.find({ shiftId: shift._id });

        const totalDeliveries = deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        
        const grandTotal = (shift.baseMoney || 0) + totalDeliveries - totalExpenses;
        
        res.json({ 
            active: true, 
            shift, 
            stats: {
                count: deliveries.length,
                totalDeliveries: totalDeliveries,
                totalExpenses: totalExpenses,
                grandTotal: grandTotal
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/shift/end', requireAuth, async (req, res) => {
    try {
        const shift = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        if (!shift) return res.status(400).json({ error: 'No hay jornada activa' });

        const deliveries = await Delivery.find({ shiftId: shift._id });
        const totalAmount = deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);

        shift.endTime = new Date();
        shift.status = 'closed';
        shift.totalDeliveryAmount = totalAmount;
        await shift.save();

        res.json({ success: true, total: totalAmount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/expenses', requireAuth, async (req, res) => {
    try {
        const activeShift = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        
        const expense = new Expense({
            user: req.session.userId,
            description: req.body.description,
            amount: parseFloat(req.body.amount),
            shiftId: activeShift ? activeShift._id : null
        });
        
        await expense.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/deliveries/manual', requireAuth, async (req, res) => {
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/transactions', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, shiftId } = req.query;
        const userId = req.session.userId;

        let deliveryQuery = { user: userId };
        if (shiftId) deliveryQuery.shiftId = shiftId;
        if (search) {
            deliveryQuery.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }

        let expenseQuery = { user: userId };
        if (shiftId) expenseQuery.shiftId = shiftId;
        if (search) {
            expenseQuery.description = { $regex: search, $options: 'i' };
        }

        const [allDeliveries, allExpenses] = await Promise.all([
            Delivery.find(deliveryQuery).sort({ date: -1 }).lean(),
            Expense.find(expenseQuery).sort({ date: -1 }).lean()
        ]);

        const formattedDeliveries = allDeliveries.map(d => ({ 
            ...d, 
            type: 'delivery' 
        }));
        
        const formattedExpenses = allExpenses.map(e => ({
            ...e,
            type: 'expense',
            invoiceNumber: 'GASTO',
            address: e.description,
            customerName: 'Egreso',
            date: e.date
        }));

        let combinedData = [...formattedDeliveries, ...formattedExpenses];
        combinedData.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalDocs = combinedData.length;
        const totalPages = Math.ceil(totalDocs / limit);
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        
        const paginatedItems = combinedData.slice(startIndex, endIndex);
        
        res.json({
            items: paginatedItems,
            page: parseInt(page),
            totalPages: totalPages,
            totalDocs: totalDocs,
            hasNextPage: endIndex < totalDocs,
            hasPrevPage: startIndex > 0
        });

    } catch (error) {
        console.error("Error en /api/transactions:", error);
        res.status(500).json({ error: "Error cargando transacciones" });
    }
});

function calculateTodayTotal(deliveries) {
  const todayCol = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).split('/').reverse().join('-');

  return deliveries
    .filter(d => {
      const dCol = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(d.date)).split('/').reverse().join('-');

      return dCol === todayCol;
    })
    .reduce((sum, d) => sum + d.amount, 0);
}

router.post('/api/users/link-restaurant', requireAuth, async (req, res) => {
    try {
        const { companyId, pointId, name } = req.body;
        
        if (!companyId || !pointId) {
            return res.status(400).json({ success: false, error: 'Código de vinculación inválido.' });
        }

        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
        }

        const exists = user.linkedRestaurants.some(r => r.pointId == pointId && r.companyId == companyId);
        
        if (exists) {
            return res.json({ success: true, message: 'Ya estabas vinculado a este restaurante.' });
        }

        user.linkedRestaurants.push({ 
            companyId: Number(companyId), 
            pointId: Number(pointId), 
            name: name || `Restaurante ${pointId}` 
        });
        
        await user.save();

        res.json({ success: true, message: 'Restaurante vinculado correctamente.' });
    } catch (error) {
        console.error('Error al vincular restaurante:', error);
        res.status(500).json({ success: false, error: 'Error al vincular el restaurante.' });
    }
});

const VinAppService = require('../services/vinappService');
router.post('/api/deliveries/import-vinapp', requireAuth, async (req, res) => {
    try {
        const { invoiceNumber } = req.body;
        
        if (!invoiceNumber) {
            return res.status(400).json({ success: false, error: 'Falta el número de factura' });
        }

        const user = await User.findById(req.session.userId);

        if (!user.linkedRestaurants || user.linkedRestaurants.length === 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'NO_RESTAURANTS',
                message: 'No tienes ningún restaurante vinculado. Ingresa tu código de vinculación primero.'
            });
        }

        let deliveryData = null;
        let foundRestaurantName = '';
        let foundPointId = null;

        for (const rest of user.linkedRestaurants) {
            deliveryData = await VinAppService.getOrderByNumber(invoiceNumber, rest.companyId, rest.pointId);
            
            if (deliveryData) {
                foundRestaurantName = rest.name;
                foundPointId = rest.pointId;
                break;
            }
        }

        if (!deliveryData) {
            return res.status(404).json({ 
                success: false, 
                error: 'Factura no encontrada en ninguno de tus restaurantes hoy.' 
            });
        }

        const existing = await Delivery.findOne({ 
            invoiceNumber: deliveryData.invoiceNumber,
            user: req.session.userId 
        });
        
        if (existing) {
            return res.status(409).json({ success: false, error: 'Esta factura ya fue importada' });
        }

        const activeShift = await Shift.findOne({ user: req.session.userId, status: 'active' });
        
        deliveryData.user = req.session.userId;
        deliveryData.shiftId = activeShift ? activeShift._id : null;
        
        deliveryData.pointId = foundPointId;
        deliveryData.restaurantName = foundRestaurantName;
        deliveryData.notes = `${foundRestaurantName} - ${deliveryData.notes || ''}`;

        const newDelivery = new Delivery(deliveryData);
        await newDelivery.save();
        
        res.json({ 
            success: true, 
            delivery: newDelivery,
            message: 'Importado correctamente'
        });
    } catch (error) {
        console.error('Error import-vinapp:', error);
        res.status(500).json({ success: false, error: 'Error al conectar con API' });
    }
});

router.get('/api/deliveries/ticket/:idOrder', requireAuth, async (req, res) => {
    try {
        const { idOrder } = req.params;
        
        if (!idOrder) {
            return res.status(400).json({ success: false, error: 'Falta el ID de la orden' });
        }

        const URL = process.env.VINAPP_URL;
        const response = await fetch(`${URL}/api/orders/get-data/${idOrder}`);
        
        if (!response.ok) {
            throw new Error(`Error en API VinApp: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || !data.id_order) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada.' });
        }

        const getPaymentMethod = (id) => {
            const methods = { 37: "Efectivo", 38: "Transferencia", 39: "Transferencia", 40: "Nequi", 41: "RappiPay" };
            return methods[id] || "Otro";
        };

        const shipping = parseFloat(data.shipping || 0);
        const total = parseFloat(data.total || 0);
        const subtotal = total - shipping;

        let payments = [];
        let totalPaid = 0;

        const method1Amount = parseFloat(data.valor_forma_pago) || total;
        totalPaid += method1Amount;
        payments.push({
            method: getPaymentMethod(data.id_type_forma_pago),
            amount: method1Amount
        });

        if (data.id_type_forma_pago_secundaria && data.valor_forma_pago_secundaria) {
            const method2Amount = parseFloat(data.valor_forma_pago_secundaria);
            totalPaid += method2Amount;
            payments.push({
                method: getPaymentMethod(data.id_type_forma_pago_secundaria),
                amount: method2Amount
            });
        }

        const change = totalPaid > total ? totalPaid - total : 0;

        const products = (data.details || []).map(detail => ({
            name: detail.name_product,
            quantity: detail.quantity,
            unitPrice: parseFloat(detail.value),
            subtotal: parseFloat(detail.value) * detail.quantity,
            observations: detail.observations || ''
        }));

        const cleanTicket = {
            restaurant: {
                name: data.point ? data.point.name : 'Restaurante',
                address: data.point ? data.point.direccion : '',
                phone: data.point ? data.point.telefono_pedidos : ''
            },
            order: {
                invoiceNumber: data.document && data.document[0] ? data.document[0].document_number : 'N/A',
                id: data.id_order,
                date: data.created_at,
            },
            customer: {
                name: data.client ? data.client.name : '',
                phone: data.client ? data.client.phone : '',
                address: data.address || ''
            },
            financials: {
                subtotal,
                shipping,
                total,
                payments,
                totalPaid,
                change
            },
            products
        };

        res.json({ success: true, ticket: cleanTicket });
    } catch (error) {
        console.error('Error obteniendo ticket digital:', error);
        res.status(500).json({ success: false, error: 'No se pudo cargar la información del ticket.' });
    }
});

module.exports = router;