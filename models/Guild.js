const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    roleId: {
        type: String,
        required: true
    },
    tag: {
        type: String,
        default: ''
    },
    color: {
        type: String,
        default: '#0099ff'
    },
    createdBy: {
        discordId: String,
        username: String
    },
    updatedBy: {
        discordId: String,
        username: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

guildSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

guildSchema.statics.findByNameCaseInsensitive = function (name) {
    return this.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
};

module.exports = mongoose.model('Guild', guildSchema);

