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
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    fullName: {
        type: String,
        default: null
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
    avatar: {
        type: String,
        default: 'default.svg'
    },
    linkedRestaurants: {
        type: [restaurantSchema],
        default: []
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deluser', userSchema);