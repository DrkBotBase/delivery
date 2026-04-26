const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment-timezone');

const Delivery = require('../models/Delivery');
const Shift = require('../models/Shift');
const Expense = require('../models/Expense');
const User = require('../models/User');

const { requireAuth } = require('../middleware/auth');
//const checkFullName = require('../middleware/checkFullName');
const { info } = require('../config');

// Reporte público de jornada (compartido)
router.get('/report/:token', async (req, res) => {
    try {
        const shift = await Shift.findOne({ shareToken: req.params.token });
        
        if (!shift) {
            return res.status(404).send(`
                <div style="text-align:center; padding:50px; font-family:sans-serif;">
                    <h1>⚠️ Enlace no válido</h1>
                    <p>Este reporte no existe o fue eliminado.</p>
                </div>
            `);
        }

        const [deliveries, expenses] = await Promise.all([
            Delivery.find({ shiftId: shift._id }).sort({ date: -1 }).lean(),
            Expense.find({ shiftId: shift._id }).sort({ date: -1 }).lean()
        ]);

        const totalVentas = deliveries.reduce((sum, d) => sum + d.amount, 0);
        const totalGastos = expenses.reduce((sum, e) => sum + e.amount, 0);
        const dineroEnCaja = (shift.baseMoney || 0) + totalVentas - totalGastos;

        const items = [
            ...deliveries.map(d => ({ ...d, type: 'delivery' })),
            ...expenses.map(e => ({ ...e, type: 'expense', date: e.date }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.render('report', { 
            info,
            title: `${info.name_page} | Reporte Jornada`,
            shift, 
            items,
            stats: {
                base: shift.baseMoney || 0,
                ventas: totalVentas,
                gastos: totalGastos,
                caja: dineroEnCaja,
                count: deliveries.length
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error interno del servidor');
    }
});

// Landing page
router.get('/', (req, res) => {
    res.render('landing', {
      info,
      title: `${info.name_page} | Home`,
    });
});

// Dashboard principal (solo jornada activa)
router.get('/panel', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, shiftId } = req.query;
        const userId = req.session.userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obtener jornada activa
        let activeShiftId = shiftId;
        
        if (!shiftId) {
            const activeShift = await Shift.findOne({ 
                user: userId, 
                status: 'active' 
            }).sort({ startTime: -1 });
            
            if (activeShift) {
                activeShiftId = activeShift._id.toString();
            }
        }
        
        // Filtros para la jornada activa
        const deliveryFilters = { user: userId };
        if (activeShiftId) deliveryFilters.shiftId = activeShiftId;
        
        const expenseFilters = { user: userId };
        if (activeShiftId) expenseFilters.shiftId = activeShiftId;
        
        if (search) {
            deliveryFilters.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
            expenseFilters.description = { $regex: search, $options: 'i' };
        }

        const [totalDeliveries, totalExpenses] = await Promise.all([
            Delivery.countDocuments(deliveryFilters),
            Expense.countDocuments(expenseFilters)
        ]);

        const totalDocs = totalDeliveries + totalExpenses;

        const [deliveriesPage, expensesPage] = await Promise.all([
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

        const formattedDeliveries = deliveriesPage.map(d => ({ 
            ...d, 
            type: 'delivery',
            displayDate: d.createdAt || d.date
        }));
        
        const formattedExpenses = expensesPage.map(e => ({
            ...e,
            type: 'expense',
            invoiceNumber: 'GASTO',
            customerName: 'Egreso',
            address: e.description,
            displayDate: e.createdAt || e.date
        }));

        let combinedData = [...formattedDeliveries, ...formattedExpenses];
        combinedData.sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate));

        const [totalDeliveriesAmount, totalExpensesAmount, todayTotal] = await Promise.all([
            Delivery.aggregate([
                { $match: { user: userId, shiftId: activeShiftId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Expense.aggregate([
                { $match: { user: userId, shiftId: activeShiftId } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            calculateTodayTotalOptimized(userId)
        ]);

        const netTotal = (totalDeliveriesAmount[0]?.total || 0) - (totalExpensesAmount[0]?.total || 0);

        const currentUser = await User.findById(userId).select('-password');
        
        // ✅ Crear objeto sanitizado para la vista
        const userForView = {
            _id: currentUser._id,
            username: currentUser.username,
            fullName: currentUser.fullName,
            avatar: currentUser.avatar,
            role: currentUser.role,
            isGoogleUser: !!currentUser.googleId  // ← Agregar esta línea
        };

        res.render('layout', {
            info,
            title: `${info.name_page} | Dashboard`,
            deliveries: combinedData,
            total: netTotal,
            todayTotal: todayTotal,
            currentUser: userForView,  // ← Usar el objeto sanitizado
            pagination: {
                totalDocs: totalDocs,
                totalPages: Math.ceil(totalDocs / limit),
                page: parseInt(page),
                hasNextPage: skip + parseInt(limit) < totalDocs,
                hasPrevPage: page > 1
            },
            filters: {
                search: search || '',
                shiftId: activeShiftId || ''
            }
        });

    } catch (error) {
        console.error("Error en panel:", error);
        res.status(500).send("Error en el servidor");
    }
});

async function calculateTodayTotalOptimized(userId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const result = await Delivery.aggregate([
        {
            $match: {
                user: userId,
                date: { $gte: startOfDay, $lte: endOfDay }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' }
            }
        }
    ]);
    
    return result[0]?.total || 0;
}

module.exports = router;