const mongoose = require('mongoose');
const Game = require('./Game');

const CardGameSchema = new mongoose.Schema({
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    ranking: [{
        place: Number,
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        name: String,
    }],
});

module.exports = mongoose.model('CardGame', CardGameSchema);