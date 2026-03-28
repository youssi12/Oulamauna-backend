const db = require("../config/db");

// GET all users
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, role_id, is_banned, created_at FROM users`
    );

    res.json({ users: rows });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// GET single user by id
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, role_id, is_banned, created_at FROM users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json({ user: rows[0] });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// BAN a user
exports.banUser = async (req, res) => {
  const { id } = req.params;
  try {
    // prevent admin from banning themselves
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ message: "You cannot ban yourself" });

    const [rows] = await db.query(
      `SELECT id, is_banned FROM users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    if (rows[0].is_banned)
      return res.status(400).json({ message: "User is already banned" });

    await db.query(
      `UPDATE users SET is_banned = true WHERE id = ?`,
      [id]
    );

    res.json({ message: `User ${id} has been banned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// UNBAN a user
exports.unbanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT id, is_banned FROM users WHERE id = ?`,
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    if (!rows[0].is_banned)
      return res.status(400).json({ message: "User is not banned" });

    await db.query(
      `UPDATE users SET is_banned = false WHERE id = ?`,
      [id]
    );

    res.json({ message: `User ${id} has been unbanned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};