const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { info } = require('../config');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google/verify', async (req, res) => {
    try {
        const { credential } = req.body;

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        let user = await User.findOne({ googleId: payload.sub });

        if (!user) {
            user = await User.findOne({ email: payload.email });
            if (user) {
                user.googleId = payload.sub;
                await user.save();
            } else {
                user = new User({
                    username: payload.name,
                    email: payload.email,
                    googleId: payload.sub
                });
                await user.save();
            }
        }

        req.session.userId = user._id;
        req.session.username = user.username;

        res.json({ success: true });

    } catch (error) {
        console.error('Error Google Verify:', error);
        res.status(400).json({ success: false, error: 'Token inválido' });
    }
});

router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/panel');
    res.render('login', {
      info,
      key: process.env.GOOGLE_CLIENT_ID || ''
    });
});

router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/panel');
    res.render('register', { 
      info,
      key: process.env.GOOGLE_CLIENT_ID || ''
    });
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
            // email:
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

        if (!user.password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este usuario usa inicio de sesión con Google. Por favor usa el botón de Google.' 
            });
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
        res.redirect('/panel');
    });
});

module.exports = router;