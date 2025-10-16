const mongoose = require('mongoose');
const Game = require('./Game');

const BadmintonGameSchema = new mongoose.Schema({
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    sets: [{
        player1: Number,
        player2: Number,
    }],
    matchType: String, // 'singles' atau 'doubles'
});

module.exports = mongoose.model('BadmintonGame', BadmintonGameSchema);