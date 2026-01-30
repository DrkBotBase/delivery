const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deluser',
      required: true
    },
    name: {
        type: String,
        required: true,
        default: 'Restaurante Principal'
    },
    address: {
        type: String,
        required: true
    },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    phone: {
        type: String
    },
    openingHours: {
        type: String,
        default: '08:00 - 22:00'
    },
    defaultRadius: {
        type: Number,
        default: 5 // km
    },
    optimizeRoutes: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Restaurant', restaurantSchema);