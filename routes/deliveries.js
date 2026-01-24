const path = require('path');
const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Restaurant = require('../models/Restaurant');
const upload = require('../middleware/upload');
const OCRService = require('../services/ocrService');
const SimpleRouteService = require('../services/routeService');
const AIParserService = require('../services/AIParserService');
const moment = require('moment-timezone');
const fs = require('fs');

router.get('/', async (req, res) => {
    try {
        const deliveries = await Delivery.find().sort({ date: -1 });
        const total = deliveries.reduce((sum, delivery) => sum + delivery.amount, 0);
        
        res.render('layout', {
            deliveries,
            total: total.toFixed(2),
            todayTotal: calculateTodayTotal(deliveries)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/upload', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ninguna imagen' });
    }

    const imagePath = path.join(__dirname, '../public/uploads/', req.file.filename);

    const ocrText = await OCRService.extractTextFromImage(imagePath);

    let parsed;
    try {
      parsed = await AIParserService.parseInvoice(ocrText);
    } catch {
      parsed = OCRService.extractDeliveryData(ocrText);
    }

    if (!parsed.delivery || parsed.delivery === 0) {
      return res.status(400).json({
        error: 'No se pudo detectar el valor del domicilio',
        ocrText
      });
    }

    let fullAddress = OCRService.fixAddress(parsed.address || "NO DETECTADA");
    if (!fullAddress.toLowerCase().includes('barranquilla')) {
      fullAddress = `${fullAddress}, Riomar, Barranquilla, Atlántico`;
    }

    const dateCol = OCRService.getColombiaDate();

    let phoneFinal = parsed.phone || "NO DETECTADO";
    if (parsed.phoneStatus && parsed.phoneStatus !== "ok") {
      phoneFinal = `${phoneFinal} (${parsed.phoneStatus})`;
    }

    const delivery = new Delivery({
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

router.get('/api/deliveries', async (req, res) => {
    try {
        const deliveries = await Delivery.find().sort({ date: -1 });
        res.json(deliveries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/stats', async (req, res) => {
  try {
    const deliveries = await Delivery.aggregate([
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

router.delete('/api/deliveries/:id', async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    const imagePath = path.join(
      __dirname,
      '../public',
      delivery.imageUrl
    );
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error borrando factura:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/deliveries/:id', async (req, res) => {
    try {
        const delivery = await Delivery.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/deliveries/:id', async (req, res) => {
    try {
        const delivery = await Delivery.findById(req.params.id);
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/deliveries/pending', async (req, res) => {
    try {
        const deliveries = await Delivery.find({
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

router.post('/api/delivery/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updateData = { deliveryStatus: status };
        
        if (status === 'entregado') {
            updateData.deliveryTime = new Date();
        }
        
        const delivery = await Delivery.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        res.json(delivery);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/route/start', async (req, res) => {
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
    .toFixed(2);
}

module.exports = router;