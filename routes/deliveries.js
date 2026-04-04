const path = require('path');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const fs = require('fs');
const crypto = require('crypto');
const moment = require('moment-timezone');

const Restaurant = require('../models/Restaurant');
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
                { phone: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } },
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
                message: 'No tienes ningún restaurante vinculado. Ingresa el código de vinculación primero.'
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

        const restaurantAccount = await Restaurant.findOne({ pointId: foundPointId });

        if (!restaurantAccount) {
            return res.status(403).json({
                success: false,
                error: 'RESTAURANT_NOT_FOUND',
                message: `No se encontró una cuenta activa para el restaurante "${foundRestaurantName}".`
            });
        }

        if (restaurantAccount.availableScans <= 0 || restaurantAccount.status === 'suspended') {
            
            if (restaurantAccount.status !== 'suspended') {
                restaurantAccount.status = 'suspended';
                await restaurantAccount.save();
            }

            return res.status(403).json({
                success: false,
                error: 'NO_BALANCE',
                message: `El restaurante "${foundRestaurantName}" se ha quedado sin saldo de escaneos. Dile a la administración que recargue su cuenta.`
            });
        }

        restaurantAccount.availableScans -= 1;
        restaurantAccount.totalScans += 1;
        await restaurantAccount.save();

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

        let rawPayWith = parseFloat(data.pay_with) || 0;
        
        if (rawPayWith > 0 && rawPayWith <= 500) {
            rawPayWith = rawPayWith * 1000;
        }

        let payments = [];
        const method1Amount = parseFloat(data.valor_forma_pago) || total;
        payments.push({
            method: getPaymentMethod(data.id_type_forma_pago),
            amount: method1Amount
        });

        let sumOfMethods = method1Amount;

        if (data.id_type_forma_pago_secundaria && data.valor_forma_pago_secundaria) {
            const method2Amount = parseFloat(data.valor_forma_pago_secundaria);
            sumOfMethods += method2Amount;
            payments.push({
                method: getPaymentMethod(data.id_type_forma_pago_secundaria),
                amount: method2Amount
            });
        }

        let customerGivenAmount = rawPayWith > sumOfMethods ? rawPayWith : sumOfMethods;
        
        const change = customerGivenAmount > total ? customerGivenAmount - total : 0;

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
                totalPaid: sumOfMethods, 
                customerGivenAmount,
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

// restaurant panel
router.get('/restaurante/login', (req, res) => {
    res.render('restaurante-login');
});

router.post('/api/restaurante/login', async (req, res) => {
    try {
        const { linkCode, password } = req.body;
        if (!linkCode || !password) {
            return res.status(400).json({ error: 'Faltan datos' });
        }

        const pointId = linkCode.split('-')[1];
        const restaurant = await Restaurant.findOne({ pointId: pointId, password: password });
        
        if (!restaurant) {
            return res.status(401).json({ error: 'Código o contraseña incorrectos' });
        }

        req.session.restaurantId = restaurant._id;
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.get('/restaurante/panel', async (req, res) => {
    if (!req.session.restaurantId) {
        return res.redirect('/restaurante/login');
    }

    const restaurant = await Restaurant.findById(req.session.restaurantId);
    res.render('restaurante-dashboard', { restaurant });
});

// send-pdf + whatsappService
const PDFDocument = require('pdfkit');
const waService = require('../services/whatsapp');

router.post('/api/deliveries/send-ticket/:idOrder', requireAuth, async (req, res) => {
    try {
        if (!waService.getStatus()) {
            return res.status(503).json({ success: false, error: 'Función no disponible. WhatsApp no está conectado al sistema.' });
        }
        
        const { idOrder } = req.params;
        const { ticket } = req.body;
        
        if (!ticket || !ticket.customer.phone) {
            return res.status(400).json({ success: false, error: 'Datos de la factura o teléfono del cliente inválidos.' });
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
        
        const logoPath = path.join(__dirname, '../public/icons/192.png');
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
           .text('Delivery by: MJFOOD', { align: 'center' })
           .moveDown(0.3)
           /*.fontSize(6)
           .font('Helvetica-Oblique')
           .text('Comprobante sin valor fiscal', { align: 'center' });*/
        
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
            return res.status(503).json({ success: false, error: 'Función no disponible. WhatsApp desconectado.' });
        }
        res.status(500).json({ success: false, error: 'Error al enviar la factura.' });
    }
});

router.post('/api/whatsapp/pair', requireAuth, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Ingresa un número de teléfono.' });

        const code = await waService.requestPairingCode(phone);
        res.json({ success: true, code: code });
    } catch (error) {
        res.status(500).json({ error: 'Error al solicitar código.' });
    }
});

module.exports = router;