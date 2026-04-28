const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const moment = require('moment-timezone');
const { info } = require('../config');

router.get('/restaurant', (req, res) => {
    res.render('tools', {
        title: `${info.name_page || 'App'} | Código de Restaurante`
    });
});

router.post('/generate-link-code', async (req, res) => {
    try {
        const { globalId } = req.body;
        
        if (!globalId) return res.status(400).json({ success: false, error: 'Por favor ingresa un ID.' });

        const URL = process.env.VINAPP_URL;
        const response = await fetch(`${URL}/api/orders/get-data/${globalId}`);
        const vinData = await response.json();

        if (!vinData || !vinData.point || !vinData.id_companie) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada.' });
        }

        const linkCode = `${vinData.id_companie}-${vinData.point.id_point}`;
        const restName = vinData.point.name;

        let restaurant = await Restaurant.findOne({ pointId: vinData.point.id_point });

        if (!restaurant) {
            restaurant = new Restaurant({
                companyId: vinData.id_companie,
                pointId: vinData.point.id_point,
                name: restName,
                availableScans: 100,
                totalScans: 0,
                status: 'active'
            });
            await restaurant.save();
            
            return res.json({ 
                success: true, 
                linkCode, 
                restName,
                isNew: true
            });
        } else {
            return res.status(409).json({ 
                success: false, 
                error: 'Restaurante ya registrado en el sistema.'
            });
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error de conexión.' });
    }
});

module.exports = router;