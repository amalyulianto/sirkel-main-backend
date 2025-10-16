const Game = require('../models/Game');
const Stats = require('../models/Stats');
const BadmintonGame = require('../models/BadmintonGame');


// --- Badminton Specific Controllers ---
// Submit Badminton Game
exports.submitBadmintonGame = async (req, res) => {
    const { leaderboardId } = req.params;
    const { players, sets, matchType } = req.body; // players can be [playerId...] or [playerName...]
    const gameType = 'badminton';

    if (!leaderboardId || !Array.isArray(players) || !Array.isArray(sets) || players.length === 0 || sets.length === 0) {
        return res.status(400).json({ error: 'Invalid game data provided.' });
    }
    if (matchType === 'singles' && players.length !== 2) {
        return res.status(400).json({ error: 'Singles match requires exactly 2 players.' });
    }
    if (matchType === 'doubles' && players.length !== 4) {
        return res.status(400).json({ error: 'Doubles match requires exactly 4 players.' });
    }

    try {
        const Player = require('../models/Player');
        const isIdLike = v => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);

        let playerDocs;
        if (players.every(isIdLike)) {
            playerDocs = await Promise.all(players.map(id =>
                Player.findOne({ _id: id, leaderboard: leaderboardId })
            ));
        } else {
            const docs = await Player.find({ name: { $in: players }, leaderboard: leaderboardId });
            playerDocs = players.map(name => docs.find(d => d && d.name === name) || null);
        }

        if (playerDocs.some(p => !p)) {
            return res.status(404).json({ error: 'One or more players not found on this leaderboard.' });
        }

        let team1Wins = 0, team2Wins = 0;
        for (const set of sets) {
            if (set.player1 > set.player2) team1Wins++; else team2Wins++;
        }
        const isTeam1Winner = team1Wins > team2Wins;
        const uniqueIds = new Set(playerDocs.map(p => p._id.toString()));
        if (uniqueIds.size !== playerDocs.length) {
            return res.status(400).json({ error: 'Duplicate players are not allowed.' });
        }
        // If your Game schema still has players: [{ userId, name }], this still saves fine,
        // but ideally update Game schema to use players.playerId like football.
        const gamePlayers = playerDocs.map(p => ({ playerId: p._id, name: p.name }));
        const half = gamePlayers.length / 2;
        const winnerIds = (isTeam1Winner ? gamePlayers.slice(0, half) : gamePlayers.slice(half)).map(p => p.playerId);

        const newGame = new (require('../models/Game'))({
            leaderboardId,
            gameType,
            players: gamePlayers,
            sets,
            matchType,
            winnerId: winnerIds[0]
        });
        await newGame.save();
        await new BadmintonGame({ gameId: newGame._id, sets, matchType }).save();

        const Stats = require('../models/Stats');
        await Promise.all(gamePlayers.map(async (p) => {
            const isWinner = winnerIds.some(x => x.toString() === p.playerId.toString());
            const inc = {
                'badminton.overallGamesPlayed': 1,
                'badminton.overallGamesWon': isWinner ? 1 : 0,
                'badminton.overallGamesLost': !isWinner ? 1 : 0,
                ...(matchType === 'singles' ? {
                    'badminton.singlesGamesPlayed': 1,
                    'badminton.singlesGamesWon': isWinner ? 1 : 0,
                    'badminton.singlesGamesLost': !isWinner ? 1 : 0,
                } : {
                    'badminton.doublesGamesPlayed': 1,
                    'badminton.doublesGamesWon': isWinner ? 1 : 0,
                    'badminton.doublesGamesLost': !isWinner ? 1 : 0,
                })
            };

            const updated = await Stats.findOneAndUpdate(
                { playerId: p.playerId, leaderboardId },
                { $inc: inc },
                { new: true, upsert: true }
            );

            const totalPlayed = updated.badminton.overallGamesPlayed || 0;
            const overallWinPercentage = totalPlayed ? (updated.badminton.overallGamesWon / totalPlayed) : 0;

            await Stats.findOneAndUpdate(
                { playerId: p.playerId, leaderboardId },
                { $set: { 'badminton.overallWinPercentage': overallWinPercentage } }
            );
        }));

        return res.status(201).json({ message: 'Badminton game result submitted successfully.', game: newGame });
    } catch (error) {
        console.error('Error submitting badminton game:', error);
        return res.status(500).json({ error: 'Failed to submit game result.' });
    }
};
// Get Badminton Ranking
exports.getBadmintonRanking = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        const ranking = await Stats.find({ leaderboardId: leaderboardId, 'badminton.overallGamesPlayed': { $gt: 0 } })
            .sort({
                'badminton.overallGamesWon': -1, 'badminton.overallWinPercentage': -1,
            })
            .populate('playerId', 'name')
            .select('badminton playerId leaderboardId');

        res.status(200).json(ranking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve badminton ranking.' });
    }
};

// Get badminton game history for a specific leaderboard
exports.getBadmintonGameHistory = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        const games = await Game.find({ leaderboardId: leaderboardId, gameType: 'badminton' })
            .sort({ createdAt: -1 })
            .populate('players.playerId', 'name')
            .lean();

        const gameIds = games.map(g => g._id);
        const details = await BadmintonGame.find({ gameId: { $in: gameIds } }).lean();
        const byId = new Map(details.map(d => [d.gameId.toString(), d]));

        const enhanced = games.map(g => ({
            ...g,
            players: (g.players || []).map(p => ({
                playerId: p.playerId?._id || p.playerId,
                name: p.playerId?.name || p.name
            })),
            sets: byId.get(g._id.toString())?.sets || null,
            matchType: byId.get(g._id.toString())?.matchType || null
        }));

        res.status(200).json(enhanced);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve badminton game history.' });
    }
};

// Get a Player's Badminton stats
exports.getBadmintonPlayerStats = async (req, res) => {
    const { playerId, leaderboardId } = req.params;
    try {
        const stats = await Stats.findOne({ playerId, leaderboardId })
            .select('badminton')
            .populate('playerId', 'name');

        if (!stats) {
            return res.status(404).json({ error: 'Stats not found for this player.' });
        }

        // Fetch game history and include scores (sets)
        const games = await Game.find({
            leaderboardId,
            gameType: 'badminton',
            'players.playerId': playerId
        })
            .sort({ createdAt: -1 })
            .populate('players.playerId', 'name')
            .lean();

        const gameIds = games.map(g => g._id);
        const details = await BadmintonGame.find({ gameId: { $in: gameIds } }).lean();
        const byId = new Map(details.map(d => [d.gameId.toString(), d]));

        const history = games.map(g => ({
            _id: g._id,
            leaderboardId: g.leaderboardId,
            createdAt: g.createdAt,
            players: (g.players || []).map(p => ({
                playerId: p.playerId?._id || p.playerId,
                name: p.playerId?.name || p.name
            })),
            sets: byId.get(g._id.toString())?.sets || null,
            matchType: byId.get(g._id.toString())?.matchType || null
        }));

        return res.status(200).json({
            name: stats.playerId.name,
            stats: stats.badminton,
            history
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve badminton stats.' });
    }
};