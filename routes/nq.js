const express = require('express');
const router = express.Router();
const { getNequiStatus, clearCache } = require('../services/statsNq');

const allowedOrigins = [
    'https://status-nequi.mjfood.top',
    'https://status-nequi.mjfood.top',
    'null'
];
router.use((req, res, next) => {
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin) || (origin && origin.endsWith('.github.io'))) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
    } else if (!origin || origin === 'null') {
        res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400'); // 24 horas cache de preflight
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
/*
router.get('/status', async (req, res) => {
    const statusData = await getNequiStatus();
    res.render('stats_nq', statusData);
});
*/
router.get('/api/status', async (req, res) => {
    const forceRefresh = req.query.refresh === 'true';
    const statusData = await getNequiStatus(forceRefresh);
    res.json(statusData);
});

router.post('/api/status/clear-cache', async (req, res) => {
    res.json({ success: true, message: 'Caché limpiado correctamente' });
});

module.exports = router;