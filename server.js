const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB'))
.catch(err => console.error('Error de conexión:', err));

app.use('/', require('./routes/deliveries'));

app.get('/route', (req, res) => {
    res.render('route');
});

app.get('/service-worker.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/pwa.js'));
});

app.get('/ping', (req, res) => {
  res.send('Pong');
});

setInterval(() => {
  fetch('https://delivery-cgam.onrender.com/ping')
    .then(res => console.log('Ping interno enviado:', res.status))
    .catch(err => console.error('Error en el ping:', err.message));
}, 14 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});