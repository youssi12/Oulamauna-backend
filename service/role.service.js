const prisma = require("../config/db");

// Helper function to fetch roles dynamically from the database
const getRoles = async () => {
  const [userRole, contributorRole, adminRole] = await Promise.all([
    prisma.roles.findFirst({ where: { role_name: "user" } }),
    prisma.roles.findFirst({ where: { role_name: "contributor" } }),
    prisma.roles.findFirst({ where: { role_name: "admin" } })
  ]);
  return { userRole, contributorRole, adminRole };
};

// ✅ 1. AUTO-PROMOTE: Upgrades a "user" to "contributor"
const promoteUserToContributor = async (userId) => {
  if (!userId) return;

  try {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { role_id: true } });
    if (!user) return;

    const { userRole, contributorRole } = await getRoles();

    // Only promote if they are currently a basic "user" and we found a "contributor" role
    if (userRole && user.role_id === userRole.role_id && contributorRole) {
      await prisma.users.update({
        where: { id: userId },
        data: { 
          role_id: contributorRole.role_id,
          allowed_to_contribute: true 
        },
      });
      console.log(`✅ User ${userId} automatically promoted to Contributor!`);
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
    return adminRole && user.role_id === adminRole.role_id;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// ✅ 3. BAN/DEMOTE: Downgrades a user and bans them
const demoteAndBanUser = async (userId) => {
  if (!userId) return;
  try {
    const { userRole } = await getRoles();
    if (!userRole) throw new Error("Could not find 'user' role in database");

    await prisma.users.update({
      where: { id: userId },
      data: {
        role_id: userRole.role_id,       // Downgrade to basic user
        allowed_to_contribute: false,    // Block from submitting
        is_banned: true                  // Lock out of the system
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
  demoteAndBanUser
};