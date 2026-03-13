// src/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const registerUser = async (req, res) => {
    try {
        // 1. Extract data from the frontend request
        const { full_name, email, password } = req.body;

        // 2. Basic Validation
        if (!full_name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // 3. Check if user already exists
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // 4. Hash the password (10 salt rounds is the industry standard)
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // 5. Insert the new user into the Neon database
        const insertQuery = `
            INSERT INTO users (full_name, email, password_hash) 
            VALUES ($1, $2, $3) 
            RETURNING id, full_name, email, created_at;
        `;
        const newUser = await db.query(insertQuery, [full_name, email, password_hash]);

        // 6. Generate a JWT Token so they are logged in immediately
        const token = jwt.sign(
            { userId: newUser.rows[0].id }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '7d' } // Token expires in 7 days
        );

        // 7. Send the successful response back to the frontend
        res.status(201).json({
            message: "User registered successfully",
            user: newUser.rows[0],
            token: token
        });

    } catch (error) {
        console.error("Error in registerUser:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


const loginUser = async (req, res) => {
    try {
        // 1. Extract email and password from the frontend request
        const { email, password } = req.body;

        // 2. Basic Validation
        if (!email || !password) {
            return res.status(400).json({ message: "Please provide both email and password" });
        }

        // 3. Find the user in the database
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid email or password" }); // Keep errors vague for security!
        }

        const user = result.rows[0];

        // 4. Compare the provided password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // 5. Generate a new JWT Token
        const token = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '7d' } 
        );

        // 6. Send the successful response back
        res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email
            },
            token: token
        });

    } catch (error) {
        console.error("Error in loginUser:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = {
    registerUser,
    loginUser
};