const mongoose = require('mongoose');

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
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Deluser', userSchema);