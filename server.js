require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
require('./config/passport')

const { info, PORT } = require('./config');
const { requireAuth } = require('./middleware/auth'); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SECRET_KEY || 'secreto_super_seguro_dev',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error de conexión:', err));

app.use('/auth', require('./routes/auth'));

app.get('/manifest.json', (req, res) => {
    res.type('application/manifest+json');
    res.sendFile(path.join(__dirname, 'public/manifest.json'));
});
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/sw.js'));
});
app.get('/offline', (req, res) => {
    res.render('offline', {
      info,
      title: `Sin Conexión | ${info.name_page}`,
    });
});
app.get('/ping', (req, res) => {
  res.send('Pong');
});

app.get('/route', requireAuth, (req, res) => {
    res.render('route', {
      info,
      title: `${info.name_page} | Modo Ruta`,
    });
});

app.use('/', require('./routes/deliveries'));

setInterval(() => {
  fetch((info.dominio || `http://localhost:${PORT}`) + '/ping')
    .then(res => { /* console.log('Ping OK'); */ })
    .catch(err => console.error('Ping Error:', err.message));
}, 14 * 60 * 1000);

app.use((req, res, next) => {
    res.status(404).render('404', {
      info,
      title: `${info.name_page} | Error`,
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
});