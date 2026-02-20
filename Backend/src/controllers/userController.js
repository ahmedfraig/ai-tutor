// src/controllers/userController.js
const db = require('../config/db');

const getUserProfile = async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await db.query(
            'SELECT id, full_name, email, created_at FROM users WHERE id = $1', 
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(result.rows[0]);

    } catch (error) {
        console.error("Error in getUserProfile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports = { getUserProfile };