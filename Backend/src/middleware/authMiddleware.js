// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    // 1. Check if the Authorization header exists and starts with "Bearer"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 2. Extract the token (Header format is "Bearer <token_string>")
            token = req.headers.authorization.split(' ')[1];

            // 3. Verify the token using your secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

            // 4. Attach the decoded user ID to the request object so the controller can use it
            req.user = decoded; 

            // 5. Let the request pass to the next function (the controller)
            next();
        } catch (error) {
            console.error("Token verification failed:", error.message);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    }

    if (!token) {
        res.status(401).json({ message: "Not authorized, no token provided" });
    }
};

module.exports = { protect };