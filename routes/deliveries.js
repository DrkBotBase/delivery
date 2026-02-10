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

const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const OCRService = require('../services/ocrService');
const SimpleRouteService = require('../services/routeService');
const AIParserService = require('../services/AIParserService');

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
        /* if (!req.session.userId) {
          return res.render('landing', {
            info,
            title: `${info.name_page} | Home`
          });
        } */
        
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
            total: netTotal,//.toFixed(2),
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

router.post('/upload', requireAuth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }

    const imagePath = path.join(__dirname, '../public/uploads/', req.file.filename);
    const ocrText = await OCRService.extractTextFromImage(imagePath);
    const parsed = await parseWithIAFallback(ocrText)

    if (!parsed.delivery || parsed.delivery === 0) {
      return res.status(400).json({
        error: 'No se pudo detectar el valor del domicilio',
        ocrText
      });
    }

    const fullAddress = normalizeAddress(parsed.address);
    const dateCol = OCRService.getColombiaDate();
    const phoneFinal = parsed.phone || "0000";
    if (parsed.phoneStatus && parsed.phoneStatus !== "ok") {
      phoneFinal = `${phoneFinal} (${parsed.phoneStatus})`;
    }

    const delivery = new Delivery({
      user: req.session.userId,
      invoiceNumber: parsed.invoiceNumber || `FAC-${Date.now()}`,
      date: dateCol,
      phone: phoneFinal,
      address: fullAddress,
      amount: parsed.delivery,
      customerName: parsed.customerName || "cliente",
      subtotal: parsed.subtotal || 0,
      total: parsed.total || 0,
      imageUrl: `/uploads/${req.file.filename}`,
      ocrText,
      notes: req.body.notes,
      deliveryStatus: 'pendiente'
    });
    
    try {
        const activeShift = await Shift.findOne({ 
          user: req.session.userId,
          status: 'active'
        });
        if (activeShift) {
            delivery.shiftId = activeShift._id;
        }
    } catch (err) {
        console.error("No se pudo vincular a jornada:", err);
    }

    await delivery.save();

    res.json({
      success: true,
      delivery,
      parsed,
      message: 'Factura procesada correctamente'
    });

  } catch (error) {
    console.error("Error OCR/IA:", error);
    res.status(500).json({ error: 'Error procesando factura' });
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
        let restaurant = await Restaurant.findOne(); 
        
        if (!restaurant) {
            restaurant = {
                name: 'Mi Restaurante',
                address: 'Eduardo Santos, Barranquilla, Atlántico'
            };
        }
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

        const route = await SimpleRouteService.createRoute(
            restaurant.address,
            pendingDeliveries
        );

        res.json({
            success: true,
            ...route,
            pendingCount: pendingDeliveries.length
        });
        
    } catch (error) {
        console.error('❌ Error en /api/route/start:', error);
        res.status(500).json({ 
            success: false,
            error: error.message
        });
    }
});

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

const USE_IA_OCR = process.env.IA_OCR === "true";
async function parseWithIAFallback(ocrTxt) {
  if (!USE_IA_OCR) {
    return OCRService.extractDeliveryData(ocrTxt);
  }
  
  try {
    return await AIParserService.parseInvoice(ocrTxt);
  } catch (error) {
    console.warn('IA parsing failed, using OCR fallback:', error.message);
    return OCRService.extractDeliveryData(ocrTxt);
  }
}

function normalizeAddress(address) {
  let fullAddress = OCRService.fixAddress(address || "NO DETECTADA");
  
  if (!fullAddress.toLowerCase().includes('barranquilla')) {
    fullAddress = `${fullAddress}, Riomar, Barranquilla, Atlántico`;
  }
  
  return fullAddress;
}

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
    .reduce((sum, d) => sum + d.amount, 0)
    //.toFixed(2);
}

const VinAppService = require('../services/vinappService');
router.post('/api/deliveries/import-vinapp', requireAuth, async (req, res) => {
    try {
        const { invoiceNumber } = req.body;
        console.log(invoiceNumber)
        if (!invoiceNumber) {
            return res.status(400).json({ success: false, error: 'Falta el número de factura' });
        }
        const deliveryData = await VinAppService.getOrderByNumber(invoiceNumber);
        if (!deliveryData) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
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
        const newDelivery = new Delivery(deliveryData);
        await newDelivery.save();
        res.json({ 
            success: true, 
            delivery: newDelivery,
            message: 'Importado correctamente'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al conectar con API' });
    }
});

module.exports = router;