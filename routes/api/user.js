const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../../middleware/auth');
const User = require('../../models/User');

// GET /api/user/profile - Incluir avatar en la respuesta
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                avatar: user.avatar || 'default.svg',
                createdAt: user.createdAt,
                linkedRestaurants: user.linkedRestaurants
            }
        });
    } catch (error) {
        console.error("Error en api del perfil: ", error);
        res.status(500).json({ error: error.message });
    }
});

// routes/api/user.js - Asegurar que update-name no elimine el avatar
router.put('/update-name', requireAuth, async (req, res) => {
    try {
        const { fullName } = req.body;
        
        if (!fullName || fullName.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'El nombre es requerido' 
            });
        }
        
        const user = await User.findByIdAndUpdate(
            req.session.userId,
            { fullName: fullName.trim() },
            { returnDocument: 'after' }
        ).select('-password');
        
        res.json({ 
            success: true, 
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatar || 'default.svg'
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al actualizar el nombre' 
        });
    }
});

router.put('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan datos' });
        }
        
        const user = await User.findById(req.session.userId);
        
        if (!user.password) {
            return res.status(400).json({ error: 'No tienes contraseña configurada (usas Google?)' });
        }
        
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        
        res.json({ success: true, message: 'Contraseña actualizada' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/user/restaurants - Obtener restaurantes vinculados
router.get('/restaurants', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select('linkedRestaurants');
        
        res.json({
            success: true,
            restaurants: user.linkedRestaurants || []
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// routes/api/user.js - Actualizar el endpoint de avatar
router.put('/update-avatar', requireAuth, async (req, res) => {
    try {
        const { avatar } = req.body;
        
        if (!avatar) {
            return res.status(400).json({ success: false, error: 'Avatar no especificado' });
        }
        
        // Verificar si es usuario de Google
        const currentUser = await User.findById(req.session.userId).select('googleId');
        
        if (currentUser.googleId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Los usuarios de Google usan su avatar de Google. No se puede modificar.',
                isGoogleUser: true
            });
        }
        
        const user = await User.findByIdAndUpdate(
            req.session.userId,
            { avatar: avatar },
            { returnDocument: 'after' }
        ).select('-password');
        
        res.json({ 
            success: true, 
            avatar: user.avatar,
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                avatar: user.avatar,
                isGoogleUser: false
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/remove-restaurant', requireAuth, async (req, res) => {
    try {
        const { companyId, pointId } = req.body;
        
        if (!companyId || !pointId) {
            return res.status(400).json({ 
                success: false, 
                error: 'CompanyId y PointId son requeridos' 
            });
        }
        
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        
        const companyIdNumber = Number(companyId);
        const pointIdNumber = Number(pointId);
        
        const originalLength = user.linkedRestaurants.length;
        
        // Filtrar por ambos IDs para mayor precisión
        user.linkedRestaurants = user.linkedRestaurants.filter(r => 
            !(r.companyId === companyIdNumber && r.pointId === pointIdNumber)
        );
        
        if (user.linkedRestaurants.length === originalLength) {
            return res.status(404).json({ success: false, error: 'Restaurante no encontrado' });
        }
        
        await user.save();
        
        res.json({ 
            success: true, 
            message: 'Restaurante desvinculado correctamente'
        });
        
    } catch (error) {
        console.error('Error al desvincular restaurante:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;