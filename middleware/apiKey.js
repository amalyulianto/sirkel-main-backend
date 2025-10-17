// middleware/apiKeyAuth.js

const API_AUTH_KEY = process.env.API_AUTH_KEY;

const apiKeyAuth = (req, res, next) => {
    // 1. Get the key from the request header (a standard practice)
    const clientKey = req.headers['x-api-key']; 

    // 2. Check if the key exists and matches the secret environment variable
    if (!clientKey || clientKey !== API_AUTH_KEY) {
        // Send a 401 Unauthorized response if the key is missing or invalid
        return res.status(401).json({ 
            message: 'Unauthorized: Missing or invalid API key.',
            access: 'Denied'
        });
    }

    // 3. If the key is valid, proceed to the next middleware or route handler
    next();
};

module.exports = apiKeyAuth;