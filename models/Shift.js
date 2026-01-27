const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
    startTime: { type: Date, default: Date.now },
    endTime: Date,
    baseMoney: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    shareToken: { type: String, unique: true },
    totalDeliveryAmount: { type: Number, default: 0 },
    note: String
});

module.exports = mongoose.model('Shift', shiftSchema);