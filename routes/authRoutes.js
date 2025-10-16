const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', authController.registerUser);
router.post('/signin', authController.userSignIn);
router.post('/signout', authController.userSignOut);
router.get('/profile', authMiddleware, authController.getUserProfile);
router.patch('/:userId', authMiddleware, authController.updateUserProfile);
router.post('/forgot-password', authController.forgotPassword); // not yet tested
router.post('/reset-password/:token', authController.resetPassword); // not yet tested

module.exports = router;