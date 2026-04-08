// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { validateString, validateEmail, firstError } = require('../middleware/validateInput');
const { logError } = require('../utils/logger');

// P3-3: Pre-computed dummy hash to prevent login timing oracle.
// By always running ONE bcrypt.compare (against this when user not found),
// both the 'user not found' and 'wrong password' paths take the same time.
// Generated once at startup — zero per-request overhead.
let DUMMY_HASH;
(async () => { DUMMY_HASH = await bcrypt.hash('__timing_guard__', 10); })();

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
        const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            // Email enumeration is mitigated by the auth rate limiter (10 req/15min).
            // Without an email verification flow, a clear message is the better UX tradeoff.
            return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
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

        // 3. Look up user by email
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows.length > 0 ? result.rows[0] : null;

        // P3-3: Always run bcrypt.compare — even if user not found.
        // This ensures 'invalid email' and 'wrong password' paths take identical time,
        // preventing attackers from enumerating valid emails via response timing.
        const hashToCheck = user ? user.password_hash : DUMMY_HASH;
        const isMatch = await bcrypt.compare(password, hashToCheck);

        if (!user || !isMatch) {
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