const prisma = require("../config/db");

// Helper function to fetch roles dynamically from the database
const getRoles = async () => {
  const [userRole, adminRole] = await Promise.all([
    prisma.roles.findFirst({ where: { role_name: "user" } }),
    prisma.roles.findFirst({ where: { role_name: "admin" } })
  ]);
  return { userRole, adminRole };
};

// ✅ 1. AUTO-PROMOTE: Gives a user the contributor badge (independent of role)
const promoteUserToContributor = async (userId) => {
  if (!userId) return;

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { contributorBadge: true },
    });
    if (!user) return;

    // Only update if they don't already have the badge
    if (!user.contributorBadge) {
      await prisma.users.update({
        where: { id: userId },
        data: { contributorBadge: true },
      });
      console.log(`✅ User ${userId} awarded Contributor badge!`);
    }
  } catch (error) {
    console.error("Error promoting user:", error);
  }
};

// ✅ 2. ADMIN BYPASS: Checks if a user is an Admin
const isAdminUser = async (userId) => {
  if (!userId) return false;
  try {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { role_id: true } });
    if (!user) return false;

    const { adminRole } = await getRoles();
    return !!(adminRole && user.role_id === adminRole.role_id);
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// ✅ 2b. NEW: Checks if a user has the contributor badge
const isContributor = async (userId) => {
  if (!userId) return false;
  try {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { contributorBadge: true } });
    return !!user?.contributorBadge;
  } catch (error) {
    console.error("Error checking contributor status:", error);
    return false;
  }
};

// ✅ 3. BAN/DEMOTE: Downgrades a user's role, bans them, and revokes contributor badge
const demoteAndBanUser = async (userId) => {
  if (!userId) return;
  try {
    const { userRole } = await getRoles();
    if (!userRole) throw new Error("Could not find 'user' role in database");

    await prisma.users.update({
      where: { id: userId },
      data: {
        role_id: userRole.role_id,     // Downgrade to basic user role
        contributorBadge: false,       // Revoke contributor badge
        is_banned: true,               // Lock out of the system
      },
    });
  } catch (error) {
    console.error("Error banning user:", error);
    throw error;
  }
};

module.exports = {
  promoteUserToContributor,
  isAdminUser,
  isContributor,
  demoteAndBanUser
};