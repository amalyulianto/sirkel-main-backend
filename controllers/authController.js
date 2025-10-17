const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Built-in Node.js module
const connectToDatabase = require('../utils/db');

// Register user
exports.registerUser = async (req, res) => {
  const { username, email, password, name } = req.body;
  try {
    await connectToDatabase();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({ username, email, password: hashedPassword, name });
    await newUser.save();
    res.status(201).send('User registered successfully.');
  } catch (error) {
    res.status(400).json({ error: 'Username or email already exists.' });
  }
};

// User sign in
exports.userSignIn = async (req, res) => {
  const { username, password } = req.body;
  try {
    await connectToDatabase();
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials.' });

    const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, username: user.username, name: user.name, email: user.email} });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// User sign out
exports.userSignOut = (req, res) => {
    res.status(200).json({ message: 'Signed out successfully.' });
};

// Get user profile (for token validation)
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ 
      id: user._id, 
      username: user.username, 
      name: user.name,
      email: user.email 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  const { userId } = req.params;
  const { name, password } = req.body;

  // Security check: Ensure the user is only updating their own profile
  if (req.user._id.toString() !== userId) {
    return res.status(403).json({ message: 'Authorization failed: You can only update your own profile.' });
  }

  try {
    const updateData = {};
    if (name) {
      updateData.name = name;
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true, select: '-password' });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });

  } catch (error) {
    res.status(500).json({ message: 'An error occurred while updating the profile.', error });
  }
};

// Request forgot password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // Token valid for 1 hour
        await user.save();

        const transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`; // Ganti dengan URL frontend Anda
        
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            html: `<p>You are receiving this because you have requested the reset of the password for your account.</p>
                   <p>Please click on the following link, or paste this into your browser to complete the process:</p>
                   <a href="${resetUrl}">${resetUrl}</a>
                   <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Password reset email sent successfully.' });

    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ message: 'Failed to send password reset email.' });
    }
    
};
// Post password reset
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() } // $gt means "greater than"
        });

        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        // Hash the new password before saving it
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined; // Clear the token
        user.resetPasswordExpires = undefined; // Clear the expiration date

        await user.save();

        res.status(200).json({ message: 'Your password has been reset successfully.' });

    } catch (error) {
        console.error('Error in password reset:', error);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
};