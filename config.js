require("dotenv")
module.exports = {
  info: {
    author: 'ianvanh',
    name_page: 'Delivery Tracker',
    desc: 'App Repartidor de MJFOOD, aplicación para repartidores de MJFOOD Menus Digitales.',
    dominio: process.env.DOMINIO || '',
    keywords: 'Repartidores, comida, pedidos online, código QR, carta digital, MJ Food, Restaurantes Colombia, Tecnología Delivery'
  },
  PORT: process.env.PORT || 3000
};