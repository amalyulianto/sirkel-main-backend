const leaderboardController = require('./leaderboardController');
const footballController = require('./footballController');
const badmintonController = require('./badmintonController');
const cardGameController = require('./cardGameController');

// Export all controllers from a single module
module.exports = {
  ...leaderboardController,
  ...footballController,
  ...badmintonController,
  ...cardGameController,
};