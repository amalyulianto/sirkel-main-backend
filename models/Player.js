const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    stats: {
        type: Schema.Types.ObjectId,
        ref: 'Stats'
    },
    leaderboard: { // Add this field
        type: Schema.Types.ObjectId,
        ref: 'Leaderboard',
        required: true
    }
});

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;