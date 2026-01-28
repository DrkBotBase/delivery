require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { info, PORT } = require('./config');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
    res.render('route', {
      dominio: info.dominio || '',
      title: `${info.name_page} | Modo Ruta`,
    });
});
app.get('/offline', (req, res) => {
    res.render('offline', {
      dominio: info.dominio || '',
      title: `Sin Conexión | ${info.name_page}`,
    });
});

app.get('/manifest.json', (req, res) => {
    res.type('application/manifest+json');
    res.sendFile(path.join(__dirname, 'public/manifest.json'));
});
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/js/sw.js'));
});

app.get('/ping', (req, res) => {
  res.send('Pong');
});

setInterval(() => {
  fetch(info.dominio + '/ping')
    .then(res => console.log('Ping interno enviado:', res.status))
    .catch(err => console.error('Error en el ping:', err.message));
}, 14 * 60 * 1000);

app.use((req, res, next) => {
    res.status(404).render('404', {
      dominio: info.dominio || '',
      title: `${info.name_page} | Error`,
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto: ${PORT}`);
});