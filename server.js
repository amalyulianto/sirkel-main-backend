const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mainRouter = require('./routes'); // Use the index.js file as the main router
const apiKeyAuth = require('./middleware/apiKey');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Use the main router to handle all API routes
// The base path for all your API endpoints will be /api
app.use(apiKeyAuth); // Apply API key authentication middleware
app.use('/api', mainRouter);