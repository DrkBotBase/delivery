const express = require('express');
const router = express.Router();
const { info } = require('../config');

router.get('/restaurant', (req, res) => {
    res.render('tools', {
        title: `${info.name_page || 'App'} | Código de Restaurante`
    });
});

router.post('/generate-link-code', async (req, res) => {
    try {
        const { globalId } = req.body;
        
        if (!globalId) {
            return res.status(400).json({ success: false, error: 'Por favor ingresa un ID.' });
        }
        const URL = process.env.VINAPP_URL;
        const response = await fetch(`${URL}/api/orders/get-data/${globalId}`);
        const vinData = await response.json();
        
        if (!vinData || !vinData.point) {
            return res.status(404).json({ 
                success: false, 
                error: 'Factura no encontrada. Verifica que el ID sea correcto.' 
            });
        }

        const linkCode = `${vinData.point.id_companie}-${vinData.point.id_point}`;
        const restName = vinData.point.name;

        res.json({ 
            success: true, 
            linkCode, 
            restName 
        });

    } catch (error) {
        console.error('Error generando código de restaurante:', error);
        res.status(500).json({ success: false, error: 'Error de conexión con el servidor.' });
    }
});

module.exports = router;