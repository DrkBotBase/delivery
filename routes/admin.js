// routes/admin.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const Restaurant = require('../models/Restaurant');
const Recharge = require('../models/Recharge');
const User = require('../models/User');
const { info } = require('../config');

// Panel de notificaciones (solo admin)
router.get('/notifications', requireAuth, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render('admin/notifications', {
            info,
            title: `${info.name_page} | Admin Notificaciones`,
            currentUser: user
        });
    } catch (error) {
        console.error('Error en admin/notifications:', error);
        res.status(500).send('Error al cargar el panel');
    }
});

// Panel principal
router.get('/', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        // Estadísticas generales
        const totalRestaurants = await Restaurant.countDocuments();
        const activeRestaurants = await Restaurant.countDocuments({ status: 'active' });
        const suspendedRestaurants = await Restaurant.countDocuments({ status: 'suspended' });
        
        // Total de escaneos disponibles
        const totalScans = await Restaurant.aggregate([
            { $group: { _id: null, total: { $sum: '$availableScans' } } }
        ]);
        
        // Últimas recargas
        const recentRecharges = await Recharge.find()
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Top restaurantes por uso
        const topRestaurants = await Restaurant.find()
            .sort({ totalScans: -1 })
            .limit(5)
            .select('name pointId totalScans availableScans');
            
        res.render('admin/dashboard', {
            title: `${info.name_page} | Panel Admin`,
            admin: user,
            stats: {
                totalRestaurants,
                activeRestaurants,
                suspendedRestaurants,
                totalAvailableScans: totalScans[0]?.total || 0
            },
            recentRecharges,
            topRestaurants
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el panel');
    }
});

// Lista de restaurantes
router.get('/restaurants', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { search, status, page = 1 } = req.query;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        let filter = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { pointId: parseInt(search) || 0 }
            ];
        }
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        const restaurants = await Restaurant.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const total = await Restaurant.countDocuments(filter);
        
        // Obtener últimos recharges para cada restaurante
        const restaurantsWithRecharges = await Promise.all(restaurants.map(async (rest) => {
            const lastRecharge = await Recharge.findOne({ restaurantId: rest._id })
                .sort({ createdAt: -1 });
            const totalRecharges = await Recharge.countDocuments({ restaurantId: rest._id });
            
            return {
                ...rest.toObject(),
                lastRecharge: lastRecharge,
                totalRecharges: totalRecharges
            };
        }));
        
        res.render('admin/restaurants', {
            title: `${info.name_page} | Restaurantes`,
            admin: user,
            restaurants: restaurantsWithRecharges,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            },
            filters: { search, status }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar restaurantes');
    }
});

// Ver restaurante específico
router.get('/restaurants/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).send('Restaurante no encontrado');
        }
        
        // Obtener historial de recargas
        const recharges = await Recharge.find({ restaurantId: restaurant._id })
            .sort({ createdAt: -1 });
        
        // Obtener domiciliarios vinculados
        const deliveryUsers = await User.find({
            'linkedRestaurants.pointId': restaurant.pointId
        }).select('username fullName email createdAt');
        
        // Estadísticas adicionales
        const stats = {
            totalRecharges: recharges.length,
            totalScansRecharged: recharges.reduce((sum, r) => sum + r.amount, 0),
            lastRecharge: recharges[0] || null,
            monthlyRecharges: await Recharge.aggregate([
                { $match: { restaurantId: restaurant._id } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" }
                        },
                        total: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1 } }
            ])
        };
        
        res.render('admin/restaurant-detail', {
            title: `${info.name_page} | ${restaurant.name}`,
            admin: user,
            restaurant,
            recharges,
            deliveryUsers,
            stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el restaurante');
    }
});

// Recargar escaneos
router.post('/restaurants/:id/recharge', requireAdmin, async (req, res) => {
    try {
        const { amount, notes } = req.body;
        const restaurantId = req.params.id;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Cantidad inválida' });
        }
        
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        }
        
        const previousScans = restaurant.availableScans;
        const newScans = previousScans + parseInt(amount);
        
        // Actualizar restaurante
        restaurant.availableScans = newScans;
        await restaurant.save();
        
        // Registrar recarga
        const recharge = new Recharge({
            restaurantId: restaurant._id,
            restaurantName: restaurant.name,
            pointId: restaurant.pointId,
            amount: parseInt(amount),
            previousScans: previousScans,
            newScans: newScans,
            adminId: req.session.userId,
            adminName: req.session.fullName || req.session.username,
            notes: notes || ''
        });
        await recharge.save();
        
        res.json({ 
            success: true, 
            message: `Se recargaron ${amount} escaneos a ${restaurant.name}`,
            newScans: newScans
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al recargar' });
    }
});

// Cambiar estado del restaurante
router.put('/restaurants/:id/status', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Estado inválido' });
        }
        
        const restaurant = await Restaurant.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true }
        );
        
        res.json({ success: true, status: restaurant.status });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al cambiar estado' });
    }
});

// Historial de recargas
router.get('/recharges', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;
        
        const recharges = await Recharge.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Recharge.countDocuments();
        
        res.render('admin/recharges', {
            title: `${info.name_page} | Historial de Recargas`,
            admin: user,
            recharges,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar historial');
    }
});

module.exports = router;

module.exports = router;