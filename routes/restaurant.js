const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const Delivery = require('../models/Delivery');
const Recharge = require('../models/Recharge');
const User = require('../models/User');
const Shift = require('../models/Shift');
const bcrypt = require('bcryptjs');
const { info } = require('../config');

const requireRestaurantAuth = async (req, res, next) => {
    if (!req.session.restaurantId) {
        return res.redirect('/restaurante/login');
    }
    
    const restaurant = await Restaurant.findById(req.session.restaurantId);
    if (!restaurant) {
        req.session.destroy();
        return res.redirect('/restaurante/login');
    }
    
    req.restaurant = restaurant;
    next();
};

router.get('/login', (req, res) => {
    res.render('restaurante/login', {
        title: `${info.name_page} | Panel Restaurante`
    });
});

router.post('/login', async (req, res) => {
    try {
        const { pointId, password } = req.body;
        if (!pointId || !password) {
            return res.status(400).json({ error: 'Faltan datos' });
        }
        
        const restaurant = await Restaurant.findOne({ pointId: pointId.split('-')[1], password: password });
        
        if (!restaurant) {
            return res.status(400).json({ success: false, error: 'Restaurante no encontrado' });
        }
        
        let isValid = false;
        if (restaurant.password.startsWith('$2a$')) {
            isValid = await bcrypt.compare(password, restaurant.password);
        } else {
            isValid = (password === restaurant.password);
        }
        
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
        }
        
        if (restaurant.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Restaurante suspendido' });
        }
        
        req.session.restaurantId = restaurant._id;
        req.session.restaurantPointId = restaurant.pointId;
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error de conexión' });
    }
});

router.get('/dashboard', requireRestaurantAuth, async (req, res) => {
    try {
        const restaurant = req.restaurant;
        
        const deliveryUsers = await User.find({
            'linkedRestaurants.pointId': restaurant.pointId
        }).select('username fullName email avatar createdAt');
        
        const usersWithStats = await Promise.all(deliveryUsers.map(async (user) => {
            const shifts = await Shift.aggregate([
                { 
                    $match: { 
                        user: user._id, 
                        status: 'closed' 
                    }
                },
                {
                    $lookup: {
                        from: "deliveries",
                        localField: "_id",
                        foreignField: "shiftId",
                        as: "deliveries"
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDeliveries: { $sum: { $size: "$deliveries" } },
                        totalEarned: { $sum: "$totalDeliveryAmount" },
                        totalShifts: { $sum: 1 }
                    }
                }
            ]);
            
            const stats = shifts[0] || { totalDeliveries: 0, totalEarned: 0, totalShifts: 0 };
            
            return {
                id: user._id.toString(),
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar,
                createdAt: user.createdAt,
                stats: {
                    totalDeliveries: stats.totalDeliveries,
                    totalEarned: stats.totalEarned,
                    totalShifts: stats.totalShifts
                }
            };
        }));
        
        usersWithStats.sort((a, b) => b.stats.totalDeliveries - a.stats.totalDeliveries);
        
        const recharges = await Recharge.find({ 
            restaurantId: restaurant._id 
        }).sort({ createdAt: -1 }).limit(10);
        
        const rechargeStats = {
            totalRecharges: await Recharge.countDocuments({ restaurantId: restaurant._id }),
            totalScansRecharged: await Recharge.aggregate([
                { $match: { restaurantId: restaurant._id } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            lastRecharge: recharges[0] || null
        };
        
        const stats = {
            totalDeliveries: deliveryUsers.length,
            activeThisMonth: deliveryUsers.filter(u => {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return u.createdAt > monthAgo;
            }).length
        };
        
        res.render('restaurante/dashboard', {
            title: `${info.name_page} | ${restaurant.name}`,
            restaurant,
            deliveryUsers: usersWithStats,
            stats,
            recharges,
            rechargeStats: {
                totalRecharges: rechargeStats.totalRecharges,
                totalScansRecharged: rechargeStats.totalScansRecharged[0]?.total || 0,
                lastRecharge: rechargeStats.lastRecharge
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el panel');
    }
});

router.post('/change-password', requireRestaurantAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const restaurant = req.restaurant;
        
        let isValid = false;
        if (restaurant.password.startsWith('$2a$')) {
            isValid = await bcrypt.compare(currentPassword, restaurant.password);
        } else {
            isValid = (currentPassword === restaurant.password);
        }
        
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Contraseña actual incorrecta' });
        }
        
        if (newPassword.length < 4) {
            return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await Restaurant.findByIdAndUpdate(restaurant._id, {
            password: hashedPassword
        });
        
        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al cambiar contraseña' });
    }
});

router.get('/delivery-stats/:userId', requireRestaurantAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { period = 'week' } = req.query;
        const restaurant = req.restaurant;
        
        const user = await User.findOne({
            _id: userId,
            'linkedRestaurants.pointId': restaurant.pointId
        });
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'Domiciliario no encontrado' });
        }
        
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        let dateFilter = {};
        if (period === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = { $gte: weekAgo };
        }
        
        const closedShiftsMatch = { user: userObjectId, status: 'closed' };
        
        const allShifts = await Shift.aggregate([
            { $match: closedShiftsMatch },
            {
                $group: {
                    _id: null,
                    totalEarned: { $sum: "$totalDeliveryAmount" },
                    totalShifts: { $sum: 1 },
                    totalBaseMoney: { $sum: "$baseMoney" }
                }
            }
        ]);
        
        const bestShift = await Shift.aggregate([
            { $match: closedShiftsMatch },
            { $sort: { totalDeliveryAmount: -1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "deliveries",
                    localField: "_id",
                    foreignField: "shiftId",
                    as: "deliveries"
                }
            },
            {
                $project: {
                    date: "$startTime",
                    amount: "$totalDeliveryAmount",
                    baseMoney: "$baseMoney",
                    deliveriesCount: { $size: "$deliveries" }
                }
            }
        ]);
        
        const worstShift = await Shift.aggregate([
            { $match: closedShiftsMatch },
            { $sort: { totalDeliveryAmount: 1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "deliveries",
                    localField: "_id",
                    foreignField: "shiftId",
                    as: "deliveries"
                }
            },
            {
                $project: {
                    date: "$startTime",
                    amount: "$totalDeliveryAmount",
                    baseMoney: "$baseMoney",
                    deliveriesCount: { $size: "$deliveries" }
                }
            }
        ]);
        
        const shiftsHistory = await Shift.aggregate([
            { 
                $match: { 
                    ...closedShiftsMatch,
                    startTime: dateFilter
                } 
            },
            {
                $lookup: {
                    from: "deliveries",
                    localField: "_id",
                    foreignField: "shiftId",
                    as: "deliveries"
                }
            },
            {
                $project: {
                    dayKey: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$startTime"
                        }
                    },
                    totalDeliveryAmount: 1,
                    baseMoney: 1,
                    startTime: 1,
                    deliveriesCount: { $size: "$deliveries" }
                }
            },
            {
                $group: {
                    _id: "$dayKey",
                    dailyTotal: { $sum: "$totalDeliveryAmount" },
                    dailyBase: { $sum: "$baseMoney" },
                    dailyCount: { $sum: 1 },
                    dailyDeliveries: { $sum: "$deliveriesCount" }
                }
            },
            { $sort: { _id: -1 } }
        ]);
        
        let monthlySummary = [];
        if (period === 'all') {
            monthlySummary = await Shift.aggregate([
                { $match: closedShiftsMatch },
                {
                    $lookup: {
                        from: "deliveries",
                        localField: "_id",
                        foreignField: "shiftId",
                        as: "deliveries"
                    }
                },
                {
                    $project: {
                        year: { $year: "$startTime" },
                        month: { $month: "$startTime" },
                        totalDeliveryAmount: 1,
                        baseMoney: 1,
                        deliveriesCount: { $size: "$deliveries" }
                    }
                },
                {
                    $group: {
                        _id: { year: "$year", month: "$month" },
                        monthTotal: { $sum: "$totalDeliveryAmount" },
                        monthBase: { $sum: "$baseMoney" },
                        monthShifts: { $sum: 1 },
                        monthDeliveries: { $sum: "$deliveriesCount" }
                    }
                },
                { $sort: { "_id.year": -1, "_id.month": -1 } }
            ]);
        }
        
        const stats = allShifts[0] || { 
            totalEarned: 0, 
            totalShifts: 0,
            totalBaseMoney: 0
        };
        
        res.json({
            success: true,
            period: period,
            stats: {
                totalEarned: stats.totalEarned || 0,
                totalShifts: stats.totalShifts || 0,
                totalBaseMoney: stats.totalBaseMoney || 0
            },
            history: shiftsHistory || [],
            monthlySummary: monthlySummary || [],
            bestShift: bestShift[0] || null,
            worstShift: worstShift[0] || null,
            user: {
                username: user.username,
                fullName: user.fullName,
                joinedAt: user.createdAt
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
});

router.get('/recharges', requireRestaurantAuth, async (req, res) => {
    try {
        const restaurant = req.restaurant;
        
        const recharges = await Recharge.find({ 
            restaurantId: restaurant._id 
        }).sort({ createdAt: -1 });
        
        res.json({
            success: true,
            recharges: recharges
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al obtener recargas' });
    }
});

router.get('/logout', (req, res) => {
    req.session.restaurantId = null;
    res.redirect('/restaurante/login');
});

module.exports = router;