const prisma = require("../config/db");

const visibility = ["public", "registered_only", "private"];

// ── Get my settings ──
const getMySettings = async (req, res) => {
  const userId = req.user.id;

  try {
    const mysettings = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        preferred_language_id: true,
        notifications_enabled: true,
        profile_visibility: true,
        show_email: true,
        show_contributions: true,
        is_active: true,
        // no password_hash, no other sensitive fields
      },
    });

    if (!mysettings) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: mysettings });
  } catch (error) {
    console.error("getMySettings error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Update my settings ──
const updateMySettings = async (req, res) => {
  const userId = req.user.id;
  const { preferred_language_id, notifications_enabled, profile_visibility, show_email, show_contributions } = req.body;

  if (profile_visibility && !visibility.includes(profile_visibility)) {
    return res.status(400).json({ success: false, message: "Invalid profile_visibility value" });
  }

  try {
    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        preferred_language_id: preferred_language_id !== undefined ? parseInt(preferred_language_id) : undefined,
        notifications_enabled: notifications_enabled !== undefined ? notifications_enabled : undefined,
        profile_visibility: profile_visibility !== undefined ? profile_visibility : undefined,
        show_email: show_email !== undefined ? show_email : undefined,
        show_contributions: show_contributions !== undefined ? show_contributions : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateMySettings error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Deactivate account (reversible — data untouched, just blocked from login) ──
const deactivateAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    await prisma.users.update({
      where: { id: userId },
      data: { is_active: false, deactivated_at: new Date() },
    });

    res.json({ success: true, message: "Account deactivated" });
  } catch (error) {
    console.error("deactivateAccount error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Delete account (irreversible — anonymize, don't hard-delete) ──
// FIX: username/email must be per-user unique placeholders, not a shared
// literal — "anonymous" for everyone would crash on the second person to
// delete their account (both @unique columns). is_banned added so the
// account can never be logged into again even if password_hash somehow
// isn't null in some future code path.
const deleteAccount = async (req, res) => {
  const userId = req.user.id;

  try {
    await prisma.users.update({
      where: { id: userId },
      data: {
        username: `deleted_user_${userId}`,
        email: `deleted_${userId}@deleted.local`,
        name: null,
        bio: null,
        links: null,
        profile_picture: null, // or a default placeholder avatar URL, your call
        password_hash: null,
        is_active: false,
        is_banned: true,
        deactivated_at: new Date(),
      },
    });

    res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    console.error("deleteAccount error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getMySettings,
  updateMySettings,
  deactivateAccount,
  deleteAccount,
};