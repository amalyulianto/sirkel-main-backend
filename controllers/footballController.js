const Game = require('../models/Game');
const Stats = require('../models/Stats');
const FootballGame = require('../models/FootballGame');
const Player = require('../models/Player');
const User = require('../models/User');

// --- Football Specific Controllers ---
// Submit Football Game
exports.submitFootballGame = async (req, res) => {
    const { leaderboardId } = req.params;
    const { players, score, penalties } = req.body;
    const gameType = 'football';

    if (!leaderboardId || !players || players.length !== 2 || !score) {
        return res.status(400).json({ error: 'Invalid game data provided.' });
    }

    try {
        await connectToDatabase();
        // Support players as array of ids or array of names
        const normalizePlayers = async () => {
            const isIdLike = (v) => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);
            if (players.every(isIdLike)) {
                const [p1, p2] = await Promise.all([
                    Player.findOne({ _id: players[0], leaderboard: leaderboardId }),
                    Player.findOne({ _id: players[1], leaderboard: leaderboardId })
                ]);
                return [p1, p2];
            } else {
                const playerDocs = await Player.find({
                    name: { $in: players },
                    leaderboard: leaderboardId,
                });
                const p1 = playerDocs.find(doc => doc.name === players[0]);
                const p2 = playerDocs.find(doc => doc.name === players[1]);
                return [p1, p2];
            }
        };

        const [player1Doc, player2Doc] = await normalizePlayers();

        if (!player1Doc || !player2Doc) {
            return res.status(404).json({ error: 'One or more players not found on this leaderboard.' });
        }

        if (player1Doc._id.toString() === player2Doc._id.toString()) {
            return res.status(400).json({ error: 'Duplicate players are not allowed.' });
        }

        const { player1: score1, player2: score2 } = score;

        let winnerPlayerId = null;
        let player1Points = 0;
        let player2Points = 0;
        let player1Won = false;
        let player2Won = false;
        let isPenaltyWin = false;

        if (score1 > score2) {
            winnerPlayerId = player1Doc._id;
            player1Points = 3;
            player1Won = true;
        } else if (score2 > score1) {
            winnerPlayerId = player2Doc._id;
            player2Points = 3;
            player2Won = true;
        } else {
            if (!penalties) {
                return res.status(400).json({ error: 'Penalties score is required for a tie.' });
            }
            isPenaltyWin = true;
            const { player1: penaltyScore1, player2: penaltyScore2 } = penalties;
            if (penaltyScore1 > penaltyScore2) {
                winnerPlayerId = player1Doc._id;
                player1Points = 2;
                player2Points = 1;
                player1Won = true;
            } else {
                winnerPlayerId = player2Doc._id;
                player2Points = 2;
                player1Points = 1;
                player2Won = true;
            }
        }

        const gamePlayers = [
            { playerId: player1Doc._id, name: player1Doc.name },
            { playerId: player2Doc._id, name: player2Doc.name },
        ];

        const newGame = new Game({
            leaderboardId,
            gameType,
            players: gamePlayers,
            winnerId: winnerPlayerId
        });
        await newGame.save();

        const newFootballGame = new FootballGame({ gameId: newGame._id, score, penalties: penalties || null });
        await newFootballGame.save();

        const updatePlayerStats = async (playerId, points, won, lost, isPenalty) => {
            const existingStats = await Stats.findOne({ playerId, leaderboardId });

            let gamesPlayed = (existingStats?.football?.gamesPlayed || 0) + 1;
            let gamesWon = (existingStats?.football?.gamesWon || 0) + (won ? 1 : 0);
            let gamesLost = (existingStats?.football?.gamesLost || 0) + (lost ? 1 : 0);
            let totalPoints = (existingStats?.football?.totalPoints || 0) + points;
            let gamesWonByPenalty = (existingStats?.football?.gamesWonByPenalty || 0) + (won && isPenalty ? 1 : 0);
            let gamesLostByPenalty = (existingStats?.football?.gamesLostByPenalty || 0) + (lost && isPenalty ? 1 : 0);
            let goalsScored = (existingStats?.football?.goalsScored || 0) + (playerId.toString() === player1Doc._id.toString() ? score1 : score2);
            let goalsAllowed = (existingStats?.football?.goalsAllowed || 0) + (playerId.toString() === player1Doc._id.toString() ? score2 : score1);

            const winPercentage = gamesPlayed > 0 ? gamesWon / gamesPlayed : 0;
            const goalDifference = goalsScored - goalsAllowed;

            await Stats.findOneAndUpdate(
                { playerId, leaderboardId },
                {
                    $set: {
                        'football.gamesPlayed': gamesPlayed,
                        'football.gamesWon': gamesWon,
                        'football.gamesLost': gamesLost,
                        'football.gamesWonByPenalty': gamesWonByPenalty,
                        'football.gamesLostByPenalty': gamesLostByPenalty,
                        'football.goalsScored': goalsScored,
                        'football.goalsAllowed': goalsAllowed,
                        'football.winPercentage': winPercentage,
                        'football.totalPoints': totalPoints,
                        'football.goalDifference': goalDifference,
                    },
                },
                { new: true, upsert: true }
            );
        };

        await Promise.all([
            updatePlayerStats(player1Doc._id, player1Points, player1Won, player2Won, isPenaltyWin),
            updatePlayerStats(player2Doc._id, player2Points, player2Won, player1Won, isPenaltyWin),
        ]);

        const savedGame = await Game.findById(newGame._id)
            .populate('winnerId', 'name')
            .populate('players.playerId', 'name')
            .lean();

        const responseGame = {
            ...savedGame,
            score,
            penalties: penalties || null,
            winnerName: savedGame.winnerId ? savedGame.winnerId.name : null,
        };

        res.status(201).json({ message: 'Football game result submitted successfully.', game: responseGame });
    } catch (error) {
        console.error('Error submitting football game:', error);
        res.status(500).json({ error: 'Failed to submit game result.' });
    }
};

// Get Football Ranking
exports.getFootballRanking = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const ranking = await Stats.find({
            leaderboardId: leaderboardId,
        })
            .sort({
                'football.totalPoints': -1,
                'football.winPercentage': -1,
                'football.goalDifference': -1,
            })
            .populate('playerId', 'name')
            .select('football playerId leaderboardId');

        res.status(200).json(ranking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve ranking.' });
    }
};

// Get football game history for a specific leaderboard
exports.getFootballGameHistory = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const games = await Game.find({ leaderboardId: leaderboardId, gameType: 'football' })
            .sort({ createdAt: -1 })
            .populate({ path: 'winnerId', select: 'name' })
            .populate({ path: 'players.playerId', select: 'name' })
            .lean();

        const gameIds = games.map(game => game._id);

        const footballDetails = await FootballGame.find({ gameId: { $in: gameIds } }).lean();

        const detailsMap = new Map();
        footballDetails.forEach(details => {
            detailsMap.set(details.gameId.toString(), details);
        });

        const enhancedGames = games.map(game => {
            const details = detailsMap.get(game._id.toString());
            const players = (game.players || []).map(p => ({
                playerId: p.playerId?._id || p.playerId,
                name: p.playerId?.name || p.name
            }));
            return {
                ...game,
                players,
                winnerName: game.winnerId ? game.winnerId.name : null,
                score: details ? details.score : null,
                penalties: details ? details.penalties : null
            };
        });

        res.status(200).json(enhancedGames);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve game history.' });
    }
};

// Get a Player's Football stats
exports.getFootballPlayerStats = async (req, res) => {
    const { playerId, leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const player = await Player.findOne({ _id: playerId, leaderboard: leaderboardId });
        if (!player) {
            return res.status(404).json({ error: 'Player not found on this leaderboard.' });
        }

        const stats = await Stats.findOne({ playerId: player._id, leaderboardId })
            .select('football')
            .populate('playerId', 'name');

        if (!stats) {
            return res.status(404).json({ error: 'Stats not found for this player.' });
        }

        // Fetch game history
        const games = await Game.find({
            leaderboardId,
            gameType: 'football',
            'players.playerId': player._id
        })
            .sort({ createdAt: -1 })
            .populate('winnerId', 'name')
            .populate('players.playerId', 'name')
            .lean();

        const gameIds = games.map(g => g._id);
        const details = await FootballGame.find({ gameId: { $in: gameIds } }).lean();
        const byId = new Map(details.map(d => [d.gameId.toString(), d]));

        const history = games.map(g => {
            const d = byId.get(g._id.toString());
            return {
                ...g,
                winnerName: g.winnerId ? g.winnerId.name : null,
                score: d?.score ?? null,
                penalties: d?.penalties ?? null
            };
        });

        return res.status(200).json({
            name: stats.playerId.name,
            stats: stats.football,
            history
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve football stats.' });
    }
};