const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const Delivery = require('../../models/Delivery');
const Expense = require('../../models/Expense');
const Shift = require('../../models/Shift');

router.get('/', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, shiftId, allTime = 'false' } = req.query;
        const userId = req.session.userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let deliveryFilters = { user: userId };
        let expenseFilters = { user: userId };
        
        if (shiftId && shiftId !== '') {
            deliveryFilters.shiftId = shiftId;
            expenseFilters.shiftId = shiftId;
        }
        else if (allTime === 'false') {
            const activeShift = await Shift.findOne({ user: userId, status: 'active' });
            if (activeShift) {
                deliveryFilters.shiftId = activeShift._id;
                expenseFilters.shiftId = activeShift._id;
            }
        }
        
        if (search) {
            deliveryFilters.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
            expenseFilters.description = { $regex: search, $options: 'i' };
        }

        const [totalDeliveries, totalExpenses] = await Promise.all([
            Delivery.countDocuments(deliveryFilters),
            Expense.countDocuments(expenseFilters)
        ]);

        const totalDocs = totalDeliveries + totalExpenses;

        const [deliveries, expenses] = await Promise.all([
            Delivery.find(deliveryFilters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Expense.find(expenseFilters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean()
        ]);

        const formattedDeliveries = deliveries.map(d => ({ 
            ...d, 
            type: 'delivery',
            sortDate: d.createdAt || d.date
        }));
        
        const formattedExpenses = expenses.map(e => ({
            ...e,
            type: 'expense',
            invoiceNumber: 'GASTO',
            address: e.description,
            customerName: 'Egreso',
            sortDate: e.createdAt || e.date
        }));

        let combinedData = [...formattedDeliveries, ...formattedExpenses];
        combinedData.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

        res.json({
            success: true,
            items: combinedData,
            page: parseInt(page),
            totalPages: Math.ceil(totalDocs / limit),
            totalDocs: totalDocs,
            totalDeliveries: totalDeliveries,
            totalExpenses: totalExpenses,
            hasNextPage: skip + parseInt(limit) < totalDocs,
            hasPrevPage: page > 1
        });

    } catch (error) {
        console.error("Error en /api/transactions:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;