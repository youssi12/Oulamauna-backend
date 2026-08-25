const prisma = require("../config/db");

// ✅ ONE FUNCTION TO RULE THEM ALL
// Call this whenever an Admin approves ANY content (Scholar, Media, Work, Edit)
const promoteUserToContributor = async (userId) => {
  if (!userId) return;

  // 1. Get the user's current role
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { role_id: true }
  });
  if (!user) return;

  // 2. Dynamically find the roles from the database (No hardcoded IDs!)
  // ⚠️ Make sure "user" and "contributor" exactly match the role_name in your DB
  const [defaultUserRole, contributorRole] = await Promise.all([
    prisma.roles.findUnique({ where: { role_name: "user" } }), 
    prisma.roles.findUnique({ where: { role_name: "contributor" } })
  ]);

  // 3. If the user is still a basic "user", upgrade them to "contributor"
  if (defaultUserRole && user.role_id === defaultUserRole.role_id && contributorRole) {
    await prisma.users.update({
      where: { id: userId },
      data: {
        role_id: contributorRole.role_id,
        allowed_to_contribute: true // Ensure they are active
      },
    });
    console.log(`✅ User ${userId} automatically promoted to Contributor!`);
  }
};

module.exports = { promoteUserToContributor };