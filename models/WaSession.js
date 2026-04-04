const mongoose = require('mongoose');

const waSessionSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    data: { type: String, required: true }
});

module.exports = mongoose.model('WaSession', waSessionSchema);