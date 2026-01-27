const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Expense', expenseSchema);