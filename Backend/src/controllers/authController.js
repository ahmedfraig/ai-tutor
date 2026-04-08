// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateString, validateEmail, firstError } = require('../middleware/validateInput');
const { logError } = require('../utils/logger');

// MED-3: HttpOnly cookie options — JS cannot read this cookie at all.
// Production (Vercel → Render cross-origin):
//   - secure: true   → only sent over HTTPS
//   - sameSite: 'none' → required for cross-origin (different domains)
// Development (localhost):
//   - secure: false  → works over http
//   - sameSite: 'lax' → works for same-origin dev proxy
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: IS_PROD,                      // HTTPS only in prod
    sameSite: IS_PROD ? 'none' : 'lax',  // cross-origin in prod, relaxed in dev
    maxAge: 7 * 24 * 60 * 60 * 1000,     // 7 days
    path: '/',
};

const registerUser = async (req, res) => {
    try {
        // 1. Extract data
        const { full_name, email, password } = req.body;

        // 2. Validation (MED-2)
        const validationError = firstError(
            validateString(full_name, 'Full name', { min: 2, max: 100 }),
            validateEmail(email),
            validateString(password,  'Password',  { min: 8, max: 128 })
        );
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        // 3. Check if user already exists
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // 4. Hash the password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 5. Insert the new user
        const newUser = await db.query(
            `INSERT INTO users (full_name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, full_name, email, created_at`,
            [full_name, email, password_hash]
        );

        // 6. Generate JWT
        const token = jwt.sign(
            { userId: newUser.rows[0].id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 7. MED-3: set HttpOnly cookie — browser sends this automatically, JS never sees it
        res.cookie('authToken', token, COOKIE_OPTIONS);

        // Return user info only — no token in body (cookie is sufficient for browser clients)
        res.status(201).json({
            message: 'User registered successfully',
            user: newUser.rows[0],
        });

    } catch (error) {
        logError('registerUser', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};


const loginUser = async (req, res) => {
    try {
        // 1. Extract email and password
        const { email, password } = req.body;

        // 2. Validation
        const validationError = firstError(
            validateEmail(email),
            validateString(password, 'Password', { min: 1, max: 128 })
        );
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        // 3. Find the user
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // 4. Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // 5. Generate JWT
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 6. MED-3: set HttpOnly cookie
        res.cookie('authToken', token, COOKIE_OPTIONS);

        // Return user info only — no token in body
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
            },
        });

    } catch (error) {
        logError('loginUser', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// POST /api/auth/logout — clears the HttpOnly cookie server-side
const logoutUser = (req, res) => {
    res.clearCookie('authToken', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.status(200).json({ message: 'Logged out successfully' });
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
};