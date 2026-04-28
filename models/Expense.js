const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Deluser', required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    date: { type: Date, default: Date.now }
});

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ shiftId: 1, date: -1 });
expenseSchema.index({ description: 'text' });

module.exports = mongoose.model('Delexpense', expenseSchema);