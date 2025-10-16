const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema({
    leaderboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leaderboard', required: true },
    gameType: { type: String, required: true },
    players: [{
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
        name: String,
    }],
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    createdAt: { type: Date, default: Date.now },
});

// Add virtual fields for each game type
GameSchema.virtual('footballDetails', {
    ref: 'FootballGame',
    localField: '_id',
    foreignField: 'gameId',
    justOne: true,
});

GameSchema.virtual('badmintonDetails', {
    ref: 'BadmintonGame',
    localField: '_id',
    foreignField: 'gameId',
    justOne: true,
});

module.exports = mongoose.model('Game', GameSchema);