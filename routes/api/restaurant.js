const express = require('express');
const router = express.Router();
const Restaurant = require('../../models/Restaurant');

router.post('/login', async (req, res) => {
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
        console.error("Error en login restaurante:", error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

router.get('/current', async (req, res) => {
    try {
        if (!req.session.restaurantId) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        const restaurant = await Restaurant.findById(req.session.restaurantId);
        res.json({ success: true, restaurant });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', async (req, res) => {
    req.session.restaurantId = null;
    res.json({ success: true });
});

module.exports = router;