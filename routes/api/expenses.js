const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const Expense = require('../../models/Expense');
const Shift = require('../../models/Shift');

router.post('/', requireAuth, async (req, res) => {
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
        res.json({ success: true, expense });
    } catch (error) {
        console.error("Error en POST /api/expenses:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/', requireAuth, async (req, res) => {
    try {
        const expenses = await Expense.find({ user: req.session.userId })
            .sort({ date: -1 })
            .lean();
        res.json({ success: true, expenses });
    } catch (error) {
        console.error("Error en GET /api/expenses:", error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findOne({ 
            _id: req.params.id, 
            user: req.session.userId 
        });
        
        if (!expense) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        
        res.json({ success: true, expense });
    } catch (error) {
        console.error("Error en GET /api/expenses/:id:", error);
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({ 
            _id: req.params.id, 
            user: req.session.userId 
        });
        
        if (!expense) {
            return res.status(404).json({ error: 'No encontrado' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("Error en DELETE /api/expenses/:id:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;