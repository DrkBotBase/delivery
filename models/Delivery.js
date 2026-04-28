const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deluser',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true
  },
  numberComanda: {
    type: String,
    required: true
  },
  idOrder: {
    type: Number,
    required: true
  },
  pointId: {
    type: Number
  },
  restaurantName: {
    type: String
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

deliverySchema.index({ user: 1, createdAt: -1 });
deliverySchema.index({ shiftId: 1, createdAt: -1 });
deliverySchema.index({ invoiceNumber: 1 });
deliverySchema.index({ phone: 1 });
deliverySchema.index({ user: 1, date: -1 });
deliverySchema.index({ 
  invoiceNumber: 'text', 
  customerName: 'text', 
  address: 'text', 
  notes: 'text' 
});


module.exports = mongoose.model('Delivery', deliverySchema);