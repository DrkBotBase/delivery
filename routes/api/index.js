const express = require('express');
const router = express.Router();

const deliveriesApi = require('./deliveries');
const expensesApi = require('./expenses');
const shiftsApi = require('./shifts');
const statsApi = require('./stats');
const transactionsApi = require('./transactions');
const vinappApi = require('./vinapp');
const whatsappApi = require('./whatsapp');
const restaurantApi = require('./restaurant');
const userApi = require('./user');
const notificationsApi = require('./notifications');

router.use('/deliveries', deliveriesApi);
router.use('/expenses', expensesApi);
router.use('/shifts', shiftsApi);
router.use('/stats', statsApi);
router.use('/transactions', transactionsApi);
router.use('/vinapp', vinappApi);
router.use('/whatsapp', whatsappApi);
router.use('/restaurant', restaurantApi);
router.use('/user', userApi);
router.use('/notifications', notificationsApi);

router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = router;