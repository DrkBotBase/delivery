const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
    companyId: { type: Number, required: true },
    pointId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, default: '123456' }, 
    availableScans: { type: Number, default: 100 },
    totalScans: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

restaurantSchema.index({ status: 1, availableScans: 1 });
restaurantSchema.index({ companyId: 1 });

module.exports = mongoose.model('Delrestaurant', restaurantSchema);