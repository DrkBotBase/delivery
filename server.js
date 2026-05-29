require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const fs = require('fs');

const { info, PORT } = require('./config');
const { requireAuth } = require('./middleware/auth'); 
const app = express();

const sessionMiddleware = session({
  secret: process.env.SECRET_KEY || 'secreto_super_seguro_dev',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 24 * 60 * 60
  }),
  cookie: { 
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set("trust proxy", 1);
app.use(sessionMiddleware);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error de conexión:', err));

app.use('/auth', require('./routes/auth'));

app.use('/', require('./routes/deliveries'));
app.use('/tools', require('./routes/tools'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));
const restaurantRoutes = require('./routes/restaurant');
app.use('/restaurante', restaurantRoutes);

app.use('/api', require('./routes/api/index'));

// servicio externo
//app.use('/nq', require('./routes/nq'));

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
      key: process.env.MAPS_KEY || ''
    });
});

app.use((req, res, next) => {
    res.status(404).render('404', {
      info,
      title: `${info.name_page} | Error`,
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto: ${PORT}`);
});
