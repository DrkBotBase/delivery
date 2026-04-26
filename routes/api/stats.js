const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAuth } = require('../../middleware/auth');
const Delivery = require('../../models/Delivery');
const Expense = require('../../models/Expense');
const Shift = require('../../models/Shift');

// GET /api/stats - Estadísticas generales
router.get('/', requireAuth, async (req, res) => {
    try {
        const userObjectId = new mongoose.Types.ObjectId(req.session.userId);

        const [deliveries, expenses] = await Promise.all([
            Delivery.aggregate([
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
                        totalDeliveries: { $sum: "$amount" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: -1 } }
            ]),
            Expense.aggregate([
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
                        totalExpenses: { $sum: "$amount" }
                    }
                }
            ])
        ]);
        
        const statsMap = new Map();
        
        deliveries.forEach(d => {
            statsMap.set(d._id, {
                deliveriesTotal: d.totalDeliveries,
                deliveriesCount: d.count,
                expensesTotal: 0,
                netTotal: d.totalDeliveries
            });
        });
        
        expenses.forEach(e => {
            const existing = statsMap.get(e._id) || { deliveriesTotal: 0, deliveriesCount: 0, expensesTotal: 0, netTotal: 0 };
            existing.expensesTotal = e.totalExpenses;
            existing.netTotal = existing.deliveriesTotal - e.totalExpenses;
            statsMap.set(e._id, existing);
        });
        
        const history = Array.from(statsMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => b.date.localeCompare(a.date));
        
        const totalDeliveries = deliveries.reduce((sum, d) => sum + d.totalDeliveries, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.totalExpenses, 0);
        const netTotal = totalDeliveries - totalExpenses;
        
        const todayCol = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date()).split('/').reverse().join('-');
        
        const todayStats = statsMap.get(todayCol) || { 
            deliveriesTotal: 0, 
            deliveriesCount: 0, 
            expensesTotal: 0, 
            netTotal: 0 
        };

        // Obtener estadísticas de jornadas
        const shifts = await Shift.aggregate([
            { $match: { user: userObjectId } },
            { $sort: { startTime: -1 } },
            {
                $group: {
                    _id: null,
                    totalShifts: { $sum: 1 },
                    totalBaseMoney: { $sum: '$baseMoney' },
                    totalDeliveryAmount: { $sum: '$totalDeliveryAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            total: netTotal,
            today: {
                total: todayStats.netTotal,
                deliveriesTotal: todayStats.deliveriesTotal,
                deliveriesCount: todayStats.deliveriesCount,
                expensesTotal: todayStats.expensesTotal
            },
            history: history,
            shifts: {
                total: shifts[0]?.totalShifts || 0,
                totalBaseMoney: shifts[0]?.totalBaseMoney || 0,
                totalDeliveryAmount: shifts[0]?.totalDeliveryAmount || 0
            },
            raw: {
                totalDeliveries,
                totalExpenses,
                netTotal
            }
        });

    } catch (error) {
        console.error("Error en /api/stats:", error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/stats/active-shift - Totales de la jornada activa
router.get('/active-shift', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const activeShift = await Shift.findOne({ user: userId, status: 'active' });
        
        if (!activeShift) {
            return res.json({ success: true, hasActiveShift: false });
        }
        
        const [deliveriesTotal, expensesTotal] = await Promise.all([
            Delivery.aggregate([
                { $match: { shiftId: activeShift._id } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            Expense.aggregate([
                { $match: { shiftId: activeShift._id } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);
        
        const totalDeliveries = deliveriesTotal[0]?.total || 0;
        const totalExpenses = expensesTotal[0]?.total || 0;
        const grandTotal = (activeShift.baseMoney || 0) + totalDeliveries - totalExpenses;
        
        res.json({
            success: true,
            hasActiveShift: true,
            shift: {
                id: activeShift._id,
                startTime: activeShift.startTime,
                baseMoney: activeShift.baseMoney,
                totalDeliveries,
                totalExpenses,
                grandTotal,
                deliveryCount: deliveriesTotal[0]?.count || 0
            }
        });
        
    } catch (error) {
        console.error("Error en /api/stats/active-shift:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;