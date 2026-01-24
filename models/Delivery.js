const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true
  },
  shiftId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shift' 
  },
  date: {
    type: Date,
    required: true
  },
  phone: {
    type: String,
    default: "No detectado"
  },
  phoneStatus: {
    type: String,
    default: "no detectado",
    enum: ["ok", "numero incompleto", "numero de mas", "no detectado"]
  },
  address: {
    type: String,
    required: true
  },
  amount: { 
    type: Number,
    required: true
  },
  customerName: {
    type: String,
    default: "cliente"
  },
  subtotal: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  },
  imageUrl: {
    type: String,
    required: true
  },
  ocrText: {
    type: String
  },
  notes: {
    type: String
  },
  deliveryStatus: {
    type: String,
    enum: ['pendiente', 'entregado'],
    default: 'pendiente'
  },
  deliveryTime: { 
    type: Date 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);