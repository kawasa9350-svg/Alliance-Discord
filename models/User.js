const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    guild: {
        type: String,
        required: true
    },
    ingameName: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 20
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    hasRequiredRole: {
        type: Boolean,
        default: false
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update lastUpdated when document is modified
userSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('User', userSchema);
