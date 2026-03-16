// src/controllers/userController.js
const db = require('../config/db');
const bcrypt = require('bcrypt');

// GET /api/users/profile - Get the logged-in user's profile
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(
            'SELECT id, full_name, email, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// GET /api/users - Get all users (admin-level, no sensitive data)
const getAllUsers = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAllUsers:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// PUT /api/users/profile - Update the logged-in user's own profile
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { full_name, email, password } = req.body;

        const fields = [];
        const values = [];
        let paramIndex = 1;

        if (full_name !== undefined) {
            fields.push(`full_name = $${paramIndex++}`);
            values.push(full_name);
        }

        if (email !== undefined) {
            // Check if the email is already taken by another user
            const emailCheck = await db.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email, userId]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Email is already in use by another account' });
            }
            fields.push(`email = $${paramIndex++}`);
            values.push(email);
        }

        if (password !== undefined) {
            if (password.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters' });
            }
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            fields.push(`password_hash = $${paramIndex++}`);
            values.push(password_hash);
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields provided to update' });
        }

        values.push(userId);

        const result = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, full_name, email, created_at`,
            values
        );

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateUserProfile:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// DELETE /api/users/:id - Delete a user by ID
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, full_name, email',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { getUserProfile, getAllUsers, updateUserProfile, deleteUser };