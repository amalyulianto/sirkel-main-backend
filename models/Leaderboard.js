const mongoose = require('mongoose');

const LeaderboardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    gameType: { type: String, required: true },
    leaderboardFormat: { type: String, required: true },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    players: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
    }],
    editors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);
