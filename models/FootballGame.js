const mongoose = require('mongoose');
const Game = require('./Game');

const FootballGameSchema = new mongoose.Schema({
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    score: {
        player1: Number,
        player2: Number,
    },
    penalties: {
        player1: Number,
        player2: Number,
    },
});

module.exports = mongoose.model('FootballGame', FootballGameSchema);