const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    content: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'promotion', 'update'],
        default: 'info'
    },
    imageUrl: {
        type: String,
        default: ''
    },
    link: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deluser',
        required: true
    },
    expiresAt: {
        type: Date,
        default: null
    },
    readBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'Deluser' },
        readAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isActive: 1 });
notificationSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Delnotification', notificationSchema);