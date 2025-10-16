const express = require('express');
const router = express.Router();
const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');

router.use('/auth', authRoutes);
router.use('/leaderboards', gameRoutes); // Change to leaderboards for consistency

module.exports = router;