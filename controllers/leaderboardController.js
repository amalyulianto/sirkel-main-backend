const mongoose = require('mongoose');
const Game = require('../models/Game');
const CardGame = require('../models/CardGame');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const Player = require('../models/Player');
const Stats = require('../models/Stats');

// --- Leaderboard Management Controllers ---
// Create leaderboard
exports.createLeaderboard = async (req, res) => {
    const { name, gameType, leaderboardFormat, playersList } = req.body;

    if (!name || !gameType || !leaderboardFormat || !playersList || playersList.length === 0) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Normalize player names: trim and collapse whitespace
    const normalizedPlayers = playersList
        .map(p => (typeof p === 'string' ? p.trim().replace(/\s+/g, ' ') : ''))
        .filter(p => p.length > 0);

    // Prevent duplicates (case-insensitive)
    const lowered = normalizedPlayers.map(p => p.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
        return res.status(400).json({ error: 'Duplicate player names are not allowed.' });
    }

    try {
        await connectToDatabase();
        const newLeaderboard = new Leaderboard({
            name,
            gameType,
            leaderboardFormat,
            owner: req.user._id,
        });

        // Save first to get ID
        await newLeaderboard.save();

        const playerPromises = normalizedPlayers.map(async (playerName) => {
            const newPlayer = new Player({
                name: playerName,
                leaderboard: newLeaderboard._id,
            });
            await newPlayer.save();

            const newStats = new Stats({
                leaderboardId: newLeaderboard._id,
                playerId: newPlayer._id
            });
            await newStats.save();

            newPlayer.stats = newStats._id;
            await newPlayer.save();

            return newPlayer._id;
        });

        const newPlayers = await Promise.all(playerPromises);

        newLeaderboard.players = newPlayers;
        await newLeaderboard.save();

        res.status(201).json({ message: 'Leaderboard created successfully.', leaderboard: newLeaderboard });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'A leaderboard with this name already exists.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to create leaderboard.' });
    }
};
exports.getLeaderboardDetails = async (req, res) => {
    try {
        await connectToDatabase();
        const { leaderboardId } = req.params;
        const leaderboard = await Leaderboard.findById(leaderboardId)
            .populate({
                path: 'players',
                select: 'name'
            })
            .populate({
                path: 'editors',
                select: 'username'
            })
             .populate('owner', 'username'); 

        if (!leaderboard) {
            return res.status(404).json({ message: 'Leaderboard not found.' });
        }

        res.status(200).json(leaderboard);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve leaderboard details.' });
    }
};

// Add editor to leaderboard
exports.addEditor = async (req, res) => {
    const { leaderboardId } = req.params;
    const { username } = req.body; // <-- Change to username
    const authenticatedUserId = req.user._id;

    try {
        await connectToDatabase();
        const leaderboard = await Leaderboard.findById(leaderboardId);
        if (!leaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        // Check if the authenticated user is the owner
        if (leaderboard.owner.toString() !== authenticatedUserId.toString()) {
            return res.status(403).json({ error: 'Only the owner can add editors.' });
        }

        // Find the user to be added by their username
        const userToAdd = await User.findOne({ username: username }); // <-- Change the search query
        if (!userToAdd) {
            return res.status(404).json({ error: 'User to add not found.' });
        }

        // Add the user's ID to the editors array if they're not already there
        // Check if the user is already an editor or the owner
        if (leaderboard.editors.includes(userToAdd._id) || leaderboard.owner.toString() === userToAdd._id.toString()) {
            return res.status(409).json({ error: 'User is already an editor or the owner.' });
        }

        leaderboard.editors.push(userToAdd._id);
        await leaderboard.save();

        res.status(200).json({ message: 'Editor added successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add editor.' });
    }
};

// Remove editor from leaderboard
exports.removeEditor = async (req, res) => {
    const { leaderboardId, editorId } = req.params;
    const authenticatedUserId = req.user._id;

    try {
        await connectToDatabase();
        const leaderboard = await Leaderboard.findById(leaderboardId);

        if (!leaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        // Only the owner can remove editors
        if (leaderboard.owner.toString() !== authenticatedUserId.toString()) {
            return res.status(403).json({ error: 'You do not have permission to remove this editor.' });
        }

        // Check if the user to be removed is in the editors list
        if (!leaderboard.editors.includes(editorId)) {
            return res.status(404).json({ error: 'Editor not found on this leaderboard.' });
        }

        // Use $pull to remove the editor's ID from the editors array
        await Leaderboard.findByIdAndUpdate(
            leaderboardId,
            { $pull: { editors: editorId } },
            { new: true }
        );

        res.status(200).json({ message: 'Editor removed successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove editor.' });
    }
};

// Get all leaderboards
exports.getAllLeaderboards = async (req, res) => {
    try {
        
        await connectToDatabase();
        const authenticatedUserId = req.user._id;

        const leaderboards = await Leaderboard.find({
            $or: [
                { owner: authenticatedUserId },
                { editors: authenticatedUserId }
            ]
        })
            .populate({
                path: 'players',
                select: 'name'
            })
            .populate({
                path: 'editors',
                select: 'username'
            })
             .populate('owner', 'username')
            .select('name owner gameType leaderboardFormat editors');

        res.status(200).json(leaderboards);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve leaderboards.' });
    }
};

// Delete leaderboard
exports.deleteLeaderboard = async (req, res) => {
    const { leaderboardId } = req.params;
    const authenticatedUserId = req.user._id;

    try {
        await connectToDatabase();
        const leaderboard = await Leaderboard.findById(leaderboardId);

        if (!leaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        // Security check: Only the owner can delete
        if (leaderboard.owner.toString() !== authenticatedUserId.toString()) {
            return res.status(403).json({ error: 'You do not have permission to delete this leaderboard.' });
        }

        // If ownership is verified, delete the leaderboard
        await Leaderboard.findByIdAndDelete(leaderboardId);
        res.status(200).json({ message: 'Leaderboard deleted successfully.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete leaderboard.' });
    }
};

// Add player to leaderboard
exports.addPlayerToLeaderboard = async (req, res) => {
    try {
        await connectToDatabase();
        const { leaderboardId } = req.params;
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Player name is required.' });
        }

        // 1. Find the leaderboard to check authorization
        const leaderboard = await Leaderboard.findById(leaderboardId);
        if (!leaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        // Check for an existing player with the same name on this specific leaderboard
        const existingPlayer = await Player.findOne({ name, leaderboard: leaderboardId });
        if (existingPlayer) {
            return res.status(409).json({ error: 'A player with this name already exists on this leaderboard.' });
        }

        // 2. Create the new Player document
        const newPlayer = new Player({
            name,
            leaderboard: leaderboardId
        });
        await newPlayer.save();

        // 3. Create the new Stats document and link it to the new Player and Leaderboard
        const newStats = new Stats({
            leaderboardId: leaderboard._id,
            playerId: newPlayer._id,
        });
        await newStats.save();

        // 4. Update the Player document to reference the new Stats document
        newPlayer.stats = newStats._id;
        await newPlayer.save();

        // 5. Add the new player's ID to the leaderboard's players array
        leaderboard.players.push(newPlayer._id);
        await leaderboard.save();

        res.status(201).json({ message: 'Player added successfully.', player: newPlayer });

    } catch (error) {
        console.error('Detailed Error:', error);
        res.status(500).json({
            error: 'Failed to add player to leaderboard.',
            details: error.message
        });
    }
};
// Rename player on leaderboard
exports.renamePlayerOnLeaderboard = async (req, res) => {
	try {
		await connectToDatabase();
        const { leaderboardId, playerId } = req.params;
		const { name } = req.body;

		if (!name || !name.trim()) {
			return res.status(400).json({ error: 'New player name is required.' });
		}

		const newName = name.trim().replace(/\s+/g, ' ');

		const player = await Player.findOne({ _id: playerId, leaderboard: leaderboardId });
		if (!player) {
			return res.status(404).json({ error: 'Player not found on this leaderboard.' });
		}

		const escape = s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
		const duplicate = await Player.findOne({
			leaderboard: leaderboardId,
			_id: { $ne: playerId },
			name: { $regex: `^${escape(newName)}$`, $options: 'i' }
		});
		if (duplicate) {
			return res.status(409).json({ error: 'A player with this name already exists on this leaderboard.' });
		}

		// 1) Update the Player doc (authoritative)
		player.name = newName;
		await player.save();

		const lbId = new mongoose.Types.ObjectId(leaderboardId);
		const pId = new mongoose.Types.ObjectId(player._id);

		// 2) Best-effort: update denormalized names in Game.players
		try {
			await Game.updateMany(
				{ leaderboardId: lbId, 'players.playerId': pId },
				{ $set: { 'players.$[p].name': newName } },
				{ arrayFilters: [{ 'p.playerId': pId }] }
			);
		} catch (e) {
			console.error('Rename: failed to update Game players name:', e.message);
		}

		// 3) Best-effort: update CardGame.ranking name for related games
		try {
			const gamesWithPlayer = await Game.find(
				{ leaderboardId: lbId, gameType: 'card-games', 'players.playerId': pId },
				{ _id: 1 }
			).lean();

			if (gamesWithPlayer.length) {
				const gameIds = gamesWithPlayer.map(g => g._id);
				await CardGame.updateMany(
					{ gameId: { $in: gameIds } },
					{ $set: { 'ranking.$[r].name': newName } },
					{ arrayFilters: [{ 'r.playerId': pId }] }
				);
			}
		} catch (e) {
			console.error('Rename: failed to update CardGame ranking name:', e.message);
		}

		return res.status(200).json({ message: 'Player renamed successfully.', player: { _id: player._id, name: newName } });
	} catch (error) {
		return res.status(500).json({ error: 'Failed to rename player.' });
	}
};
// Remove player from leaderboard
exports.removePlayerFromLeaderboard = async (req, res) => {
    try {
        await connectToDatabase();
        const { leaderboardId, playerId } = req.params;

        const updatedLeaderboard = await Leaderboard.findByIdAndUpdate(
            leaderboardId,
            { $pull: { players: playerId } },
            { new: true }
        );

        if (!updatedLeaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        res.status(200).json(updatedLeaderboard);
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove player from leaderboard.' });
    }
};

// Edit leaderboard name
exports.editLeaderboardName = async (req, res) => {
    try {
        await connectToDatabase();
        const { leaderboardId } = req.params;
        const { name } = req.body;
        const authenticatedUserId = req.user._id; // Get the authenticated user's ID

        // Find the leaderboard first to check ownership
        const leaderboard = await Leaderboard.findById(leaderboardId);

        if (!leaderboard) {
            return res.status(404).json({ error: 'Leaderboard not found.' });
        }

        // Security check: Only the owner can edit the name
        if (leaderboard.owner.toString() !== authenticatedUserId.toString()) {
            return res.status(403).json({ error: 'You do not have permission to edit this leaderboard.' });
        }

        const updatedLeaderboard = await Leaderboard.findByIdAndUpdate(
            leaderboardId,
            { name },
            { new: true, runValidators: true } // Run validators for schema checks
        );

        res.status(200).json(updatedLeaderboard);
    } catch (error) {
        res.status(500).json({ error: 'Failed to edit leaderboard name.' });
    }
};

