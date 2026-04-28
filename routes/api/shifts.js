const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAuth } = require('../../middleware/auth');
const Shift = require('../../models/Shift');
const Delivery = require('../../models/Delivery');
const Expense = require('../../models/Expense');

router.post('/start', requireAuth, async (req, res) => {
    try {
        const existing = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya tienes una jornada abierta' });
        }

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

router.get('/current', requireAuth, async (req, res) => {
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

router.post('/end', requireAuth, async (req, res) => {
    try {
        const shift = await Shift.findOne({ 
            user: req.session.userId,
            status: 'active' 
        });
        if (!shift) {
            return res.status(400).json({ error: 'No hay jornada activa' });
        }

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

router.get('/history', requireAuth, async (req, res) => {
    try {
        const { limit = 50, page = 1 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [shifts, total] = await Promise.all([
            Shift.find({ user: req.session.userId })
                .sort({ startTime: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Shift.countDocuments({ user: req.session.userId })
        ]);
        
        const shiftsWithStats = await Promise.all(shifts.map(async (shift) => {
            const [deliveries, expenses] = await Promise.all([
                Delivery.aggregate([
                    { $match: { shiftId: shift._id } },
                    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
                ]),
                Expense.aggregate([
                    { $match: { shiftId: shift._id } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);
            
            return {
                ...shift,
                stats: {
                    deliveriesTotal: deliveries[0]?.total || 0,
                    deliveriesCount: deliveries[0]?.count || 0,
                    expensesTotal: expenses[0]?.total || 0,
                    netTotal: (deliveries[0]?.total || 0) - (expenses[0]?.total || 0),
                    grandTotal: (shift.baseMoney || 0) + (deliveries[0]?.total || 0) - (expenses[0]?.total || 0)
                }
            };
        }));
        
        res.json({
            success: true,
            shifts: shiftsWithStats,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalShifts: total,
            hasNextPage: skip + parseInt(limit) < total,
            hasPrevPage: page > 1
        });
    } catch (error) {
        console.error("Error en /api/shifts/history:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const shift = await Shift.findOne({ 
            _id: req.params.id, 
            user: req.session.userId 
        });
        
        if (!shift) {
            return res.status(404).json({ success: false, error: 'Jornada no encontrada' });
        }
        
        const [deliveries, expenses] = await Promise.all([
            Delivery.find({ shiftId: shift._id }).sort({ createdAt: -1 }).lean(),
            Expense.find({ shiftId: shift._id }).sort({ createdAt: -1 }).lean()
        ]);
        
        const deliveriesTotal = deliveries.reduce((sum, d) => sum + (d.amount || 0), 0);
        const expensesTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const grandTotal = (shift.baseMoney || 0) + deliveriesTotal - expensesTotal;
        
        res.json({
            success: true,
            shift: {
                _id: shift._id,
                startTime: shift.startTime,
                endTime: shift.endTime,
                baseMoney: shift.baseMoney,
                status: shift.status,
                shareToken: shift.shareToken
            },
            deliveries,
            expenses,
            stats: {
                deliveriesTotal: deliveriesTotal,
                deliveriesCount: deliveries.length,
                expensesTotal: expensesTotal,
                expensesCount: expenses.length,
                grandTotal: grandTotal
            }
        });
    } catch (error) {
        console.error("Error en /api/shifts/:id:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;