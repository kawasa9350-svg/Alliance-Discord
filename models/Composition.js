const mongoose = require('mongoose');

const compositionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    roles: [{
        type: String,
        required: true
    }],
    createdBy: {
        discordId: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update lastUpdated when document is modified
compositionSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('Composition', compositionSchema);
