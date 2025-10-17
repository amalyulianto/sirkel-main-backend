const Game = require('../models/Game');
const Stats = require('../models/Stats');
const CardGame = require('../models/CardGame');

// --- Card Game Specific Controllers ---
// Submit Card Game Results
// Submit Card Game Results (accept names or ids)
exports.submitCardGame = async (req, res) => {
    const { leaderboardId } = req.params;
    const { ranking } = req.body; // ranking: array of names or ids IN FINISH ORDER (1st..last)
    const gameType = 'card-games';

    if (!leaderboardId || !Array.isArray(ranking) || ranking.length < 2) {
        return res.status(400).json({ error: 'Provide an ordered array of at least 2 players.' });
    }

    try {
        await connectToDatabase();
        const Player = require('../models/Player');
        const isIdLike = v => typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v);

        // Resolve ordered players by id or name within leaderboard
        let docs = [];
        if (ranking.every(isIdLike)) {
            docs = await Player.find({ _id: { $in: ranking }, leaderboard: leaderboardId }).lean();
            // map back to original order
            const mapById = new Map(docs.map(d => [d._id.toString(), d]));
            docs = ranking.map(id => mapById.get(id.toString()) || null);
        } else {
            const fetched = await Player.find({ name: { $in: ranking }, leaderboard: leaderboardId }).lean();
            const mapByName = new Map(fetched.map(d => [d.name, d]));
            docs = ranking.map(name => mapByName.get(name) || null);
        }

        if (docs.some(d => !d)) {
            return res.status(404).json({ error: 'One or more players not found on this leaderboard.' });
        }

        // Duplicate guard
        const uniq = new Set(docs.map(d => d._id.toString()));
        if (uniq.size !== docs.length) {
            return res.status(400).json({ error: 'Duplicate players are not allowed.' });
        }

        // Build normalized entries with places only for top-3
        const normalized = docs.map((d, idx) => ({
            place: idx < 3 ? (idx + 1) : undefined, // only 1..3
            playerId: d._id,
            name: d.name
        }));

        const gamePlayers = normalized.map(n => ({ playerId: n.playerId, name: n.name }));

        const Game = require('../models/Game');
        const newGame = new Game({
            leaderboardId,
            gameType,
            players: gamePlayers,
            winnerId: normalized[0].playerId
        });
        await newGame.save();

        // Persist card-game specific details (ranking with only top-3 places)
        const CardGame = require('../models/CardGame');
        await new CardGame({
            gameId: newGame._id,
            ranking: normalized
        }).save();

        // Points: 1st=10, 2nd=5, 3rd=3, others=1
        const Stats = require('../models/Stats');
        const pointsFor = (place) => place === 1 ? 10 : place === 2 ? 5 : place === 3 ? 3 : 1;

        await Promise.all(normalized.map(async (n, idx) => {
            const place = n.place ?? (idx + 1); // for points calculation only
            const points = pointsFor(place);

            const updated = await Stats.findOneAndUpdate(
                { playerId: n.playerId, leaderboardId },
                {
                    $inc: {
                        'cardGames.gamesPlayed': 1,
                        'cardGames.totalPoints': points,
                        ...(place === 1 ? { 'cardGames.wins1st': 1 } : {}),
                        ...(place === 2 ? { 'cardGames.wins2nd': 1 } : {}),
                        ...(place === 3 ? { 'cardGames.wins3rd': 1 } : {}),
                    }
                },
                { new: true, upsert: true }
            );

            const wins1st = updated.cardGames.wins1st || 0;
            const totalPlayed = updated.cardGames.gamesPlayed || 0;
            const winPct = totalPlayed ? (wins1st / totalPlayed) * 100 : 0;

            await Stats.findOneAndUpdate(
                { playerId: n.playerId, leaderboardId },
                { $set: { 'cardGames.winPercentage': winPct } }
            );
        }));

        return res.status(201).json({ message: 'Card game result submitted successfully.', game: newGame });
    } catch (error) {
        console.error('Error submitting card game:', error);
        return res.status(500).json({ error: 'Failed to submit game result.' });
    }
};
// Get Card Game Ranking
exports.getCardGameRanking = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const ranking = await Stats.find({ leaderboardId: leaderboardId, 'cardGames.gamesPlayed': { $gt: 0 } })
            .sort({
                'cardGames.totalPoints': -1,
                'cardGames.winPercentage': -1,
            })
            .select('cardGames playerId leaderboardId')
            .populate('playerId', 'name');

        res.status(200).json(ranking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve card game ranking.' });
    }
};

// Get Card Game History
exports.getCardGameHistory = async (req, res) => {
    const { leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const games = await Game.find({ leaderboardId, gameType: 'card-games' })
            .sort({ createdAt: -1 })
            .populate('winnerId', 'name')
            .lean();

        const gameIds = games.map(g => g._id);
        const details = await CardGame.find({ gameId: { $in: gameIds } }).lean();

        // collect all playerIds used in rankings
        const allIds = [];
        details.forEach(d => (d.ranking || []).forEach(r => allIds.push(r.playerId)));
        const uniqueIds = [...new Set(allIds.map(id => id.toString()))];
        const players = await require('../models/Player').find({ _id: { $in: uniqueIds } }, 'name').lean();
        const nameMap = new Map(players.map(p => [p._id.toString(), p.name]));

        const byId = new Map(details.map(d => [d.gameId.toString(), d]));
        const enhanced = games.map(g => {
            const d = byId.get(g._id.toString());
            const ranking = (d?.ranking || []).map(r => ({
                ...r,
                name: nameMap.get(r.playerId.toString()) || r.name
            }));
            return {
                _id: g._id,
                leaderboardId: g.leaderboardId,
                gameType: g.gameType,
                createdAt: g.createdAt,
                winnerName: g.winnerId ? g.winnerId.name : null,
                ranking
            };
        });

        res.status(200).json(enhanced);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve card game history.' });
    }
};

// Get a Player's Card Games stats
exports.getCardGamesPlayerStats = async (req, res) => {
    const { playerId, leaderboardId } = req.params;
    try {
        await connectToDatabase();
        const stats = await Stats.findOne({ playerId, leaderboardId })
            .select('cardGames')
            .populate('playerId', 'name');

        if (!stats) {
            return res.status(404).json({ error: 'Stats not found for this player.' });
        }

        const games = await Game.find({
            leaderboardId,
            gameType: 'card-games',
            'players.playerId': playerId
        })
            .sort({ createdAt: -1 })
            .lean();

        const gameIds = games.map(g => g._id);
        const details = await CardGame.find({ gameId: { $in: gameIds } }).lean();

        const allIds = [];
        details.forEach(d => (d.ranking || []).forEach(r => allIds.push(r.playerId)));
        const uniqueIds = [...new Set(allIds.map(id => id.toString()))];
        const players = await require('../models/Player').find({ _id: { $in: uniqueIds } }, 'name').lean();
        const nameMap = new Map(players.map(p => [p._id.toString(), p.name]));
        const byId = new Map(details.map(d => [d.gameId.toString(), d]));

        const history = games.map(g => {
            const d = byId.get(g._id.toString());
            const ranking = (d?.ranking || []).map(r => ({
                ...r,
                name: nameMap.get(r.playerId.toString()) || r.name
            }));
            return {
                _id: g._id,
                leaderboardId: g.leaderboardId,
                createdAt: g.createdAt,
                winnerName: null, // optional: set from ranking[0].name if you want
                ranking
            };
        });

        return res.status(200).json({ name: stats.playerId.name, stats: stats.cardGames, history });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve card games stats.' });
    }
};