const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delrestaurant', required: true },
    restaurantName: { type: String, required: true },
    pointId: { type: Number, required: true },
    amount: { type: Number, required: true },
    previousScans: { type: Number, required: true },
    newScans: { type: Number, required: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deluser', required: true },
    adminName: { type: String, required: true },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

rechargeSchema.index({ restaurantId: 1, createdAt: -1 });
rechargeSchema.index({ pointId: 1 });
rechargeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Delrecharge', rechargeSchema);