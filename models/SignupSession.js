const mongoose = require('mongoose');

const signupSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    compId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Composition',
        required: true
    },
    compName: {
        type: String,
        required: true
    },
    roles: [{
        roleName: {
            type: String,
            required: true
        },
        signups: [{
            userId: {
                type: String,
                required: true
            },
            username: {
                type: String,
                required: true
            },
            ingameName: {
                type: String,
                required: true
            },
            guild: {
                type: String,
                required: true
            },
            signedUpAt: {
                type: Date,
                default: Date.now
            }
        }]
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
signupSessionSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('SignupSession', signupSessionSchema);
