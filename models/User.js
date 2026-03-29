const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    companyId: { type: Number, required: true },
    pointId: { type: Number, required: true },
    name: { type: String, default: 'Restaurante Vinculado' }
}, { _id: false });

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
    },
    email: {
        type: String,
        unique: true, 
        sparse: true
    },
    password: { 
        type: String, 
        required: false
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    linkedRestaurants: {
        type: [restaurantSchema],
        default: []
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deluser', userSchema);