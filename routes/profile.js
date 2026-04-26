const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const { info } = require('../config');

// Vista de perfil del usuario
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select('-password');
        
        const userForView = {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar,
            role: user.role,
            isGoogleUser: !!user.googleId,
            linkedRestaurants: user.linkedRestaurants
        };
        
        res.render('profile', {
            info,
            title: `${info.name_page} | Mi Perfil`,
            user: userForView
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el perfil');
    }
});

module.exports = router;