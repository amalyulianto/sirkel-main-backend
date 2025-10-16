const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/authMiddleware');

// --- Leaderboard Routes (relative to /api/leaderboards) ---
router.post('/', authMiddleware, gameController.createLeaderboard); // Create a new leaderboard
router.get('/', authMiddleware, gameController.getAllLeaderboards); // Get all leaderboards for the authenticated user
router.get('/:leaderboardId', gameController.getLeaderboardDetails); // Get details of a specific leaderboard by ID
router.delete('/:leaderboardId', authMiddleware, gameController.deleteLeaderboard); // Delete a leaderboard by ID NOT YET TESTED
router.put('/:leaderboardId', authMiddleware, gameController.editLeaderboardName); // Edit leaderboard name by ID NOT YET TESTED
// GET /api/leaderboards - Retrieves all leaderboards a user owns or edits


// --- Nested Resources (Players & Editors) ---
router.post('/:leaderboardId/players', authMiddleware, gameController.addPlayerToLeaderboard); // Add a player to a leaderboard
router.delete('/:leaderboardId/players/:playerId', authMiddleware, gameController.removePlayerFromLeaderboard); // Remove a player from a leaderboard
router.put('/:leaderboardId/players/:playerId', authMiddleware, gameController.renamePlayerOnLeaderboard);
router.post('/:leaderboardId/editors', authMiddleware, gameController.addEditor); // Add an editor to a leaderboard
router.delete('/:leaderboardId/editors/:editorId', authMiddleware, gameController.removeEditor); // Remove an editor from a leaderboard

// --- Football Routes ---
router.post('/:leaderboardId/games/football', gameController.submitFootballGame);
router.get('/:leaderboardId/ranking/football', gameController.getFootballRanking);
router.get('/:leaderboardId/history/football', gameController.getFootballGameHistory);
router.get('/:leaderboardId/players/:playerId/stats/football', gameController.getFootballPlayerStats);

// --- Badminton Routes ---
router.post('/:leaderboardId/games/badminton', gameController.submitBadmintonGame);
router.get('/:leaderboardId/ranking/badminton', gameController.getBadmintonRanking);
router.get('/:leaderboardId/history/badminton', gameController.getBadmintonGameHistory);
router.get('/:leaderboardId/players/:playerId/stats/badminton', gameController.getBadmintonPlayerStats);

// --- Card Games Routes ---
router.post('/:leaderboardId/games/card-games', gameController.submitCardGame);
router.get('/:leaderboardId/ranking/card-games', gameController.getCardGameRanking);
router.get('/:leaderboardId/history/card-games', gameController.getCardGameHistory);
router.get('/:leaderboardId/players/:playerId/stats/card-games', gameController.getCardGamesPlayerStats);


module.exports = router;