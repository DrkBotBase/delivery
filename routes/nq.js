const express = require('express');
const router = express.Router();
const { getNequiStatus, clearCache } = require('../services/statsNq');
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
    //clearCache();
    res.json({ success: true, message: 'Caché limpiado correctamente' });
});

module.exports = router;