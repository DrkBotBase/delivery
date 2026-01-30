const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('login');
});

router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/');
    res.render('register');
});

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Faltan datos' });
        }

        const existingUser = await User.findOne({ 
            username: { $regex: new RegExp(`^${username}$`, 'i') } 
        });
        
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'El usuario ya existe' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username: username.trim(),
            password: hashedPassword
        });
        await newUser.save();

        res.json({ success: true });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        
        req.session.save((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Error de sesión' });
            }
            res.json({ success: true });
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ success: false, message: 'Error interno' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Error cerrando sesión:', err);
        res.redirect('/auth/login');
    });
});

module.exports = router;