const prisma = require("../config/db");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, username: true, email: true, role_id: true, is_banned: true, created_at: true }
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, username: true, email: true, role_id: true, is_banned: true, created_at: true }
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.banUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ message: "You cannot ban yourself" });

    const user = await prisma.users.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.is_banned) return res.status(400).json({ message: "User is already banned" });

    await prisma.users.update({
      where: { id: parseInt(id) },
      data: { is_banned: true }
    });

    res.json({ message: `User ${id} has been banned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.unbanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.is_banned) return res.status(400).json({ message: "User is not banned" });

    await prisma.users.update({
      where: { id: parseInt(id) },
      data: { is_banned: false }
    });

    res.json({ message: `User ${id} has been unbanned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};