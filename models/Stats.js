const mongoose = require('mongoose');

const StatsSchema = new mongoose.Schema({
    playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        required: true
    },
    leaderboardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Leaderboard', required: true },
    // Football Stats
    football: {
        gamesPlayed: { type: Number, default: 0 },
        gamesWon: { type: Number, default: 0 },
        gamesLost: { type: Number, default: 0 },
        gamesWonByPenalty: { type: Number, default: 0 },
        gamesLostByPenalty: { type: Number, default: 0 },
        goalsScored: { type: Number, default: 0 },
        goalsAllowed: { type: Number, default: 0 },
        winPercentage: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 },
        goalDifference: { type: Number, default: 0 },
    },
    // Badminton Stats
    badminton: {
        overallGamesPlayed: { type: Number, default: 0 },
        overallGamesWon: { type: Number, default: 0 },
        overallGamesLost: { type: Number, default: 0 },
        overallWinPercentage: { type: Number, default: 0 },
        singlesGamesPlayed: { type: Number, default: 0 },
        singlesGamesWon: { type: Number, default: 0 },
        singlesGamesLost: { type: Number, default: 0 },
        singlesWinPercentage: { type: Number, default: 0 },
        doublesGamesPlayed: { type: Number, default: 0 },
        doublesGamesWon: { type: Number, default: 0 },
        doublesGamesLost: { type: Number, default: 0 },
        doublesWinPercentage: { type: Number, default: 0 },
    },
    // Card Game Stats
    cardGames: {
        gamesPlayed: { type: Number, default: 0 },
        wins1st: { type: Number, default: 0 },
        wins2nd: { type: Number, default: 0 },
        wins3rd: { type: Number, default: 0 },
        winPercentage: { type: Number, default: 0 },
        totalPoints: { type: Number, default: 0 },
    },
});

module.exports = mongoose.model('Stats', StatsSchema);