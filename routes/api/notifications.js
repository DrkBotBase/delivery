const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const Notification = require('../../models/Notification');
const User = require('../../models/User');

router.post('/mark-all-read', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        await Notification.updateMany(
            {
                isActive: true,
                'readBy.user': { $ne: userId }
            },
            {
                $push: { readBy: { user: userId, readAt: new Date() } }
            }
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const [notifications, total] = await Promise.all([
            Notification.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'username fullName'),
            Notification.countDocuments()
        ]);
        
        res.json({
            success: true,
            notifications,
            pagination: {
                page: parseInt(page),
                totalPages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, message, content, type, imageUrl, link, expiresAt } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ error: 'Título y mensaje son requeridos' });
        }
        
        const notification = new Notification({
            title: title.trim(),
            message: message.trim(),
            content: content || '',
            type: type || 'info',
            imageUrl: imageUrl || '',
            link: link || '',
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.session.userId
        });
        
        await notification.save();
        
        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error creando notificación:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id)
            .populate('createdBy', 'username fullName');
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error obteniendo notificación:', error);
        res.status(500).json({ error: error.message });
    }
});
router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, message, content, type, imageUrl, link, isActive, expiresAt } = req.body;
        
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            {
                title: title?.trim(),
                message: message?.trim(),
                content: content || '',
                type: type || 'info',
                imageUrl: imageUrl || '',
                link: link || '',
                isActive: isActive !== undefined ? isActive : true,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const notification = await Notification.findByIdAndDelete(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/read', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const notification = await Notification.findById(req.params.id);
        
        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }
        
        const alreadyRead = notification.readBy.some(r => r.user.toString() === userId);
        
        if (!alreadyRead) {
            notification.readBy.push({ user: userId, readAt: new Date() });
            await notification.save();
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const notifications = await Notification.find({
            isActive: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        }).sort({ createdAt: -1 }).limit(50);
        
        const notificationsWithReadStatus = notifications.map(notif => {
            const isRead = notif.readBy.some(r => r.user.toString() === userId);
            return {
                ...notif.toObject(),
                isRead,
                content: notif.content || ''
            };
        });
        
        const unreadCount = notificationsWithReadStatus.filter(n => !n.isRead).length;
        
        res.json({
            success: true,
            notifications: notificationsWithReadStatus,
            unreadCount
        });
    } catch (error) {
        console.error('Error obteniendo notificaciones:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;