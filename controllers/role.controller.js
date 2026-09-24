const prisma = require("../config/db");

// ✅ Get all roles and specifically identify the admin role ID
exports.getRoles = async (req, res) => {
  try {
    const roles = await prisma.roles.findMany({
      select: { role_id: true, role_name: true }
    });
    
    // Dynamically find the admin role ID (case-insensitive)
    const adminRole = roles.find(r => r.role_name.toLowerCase() === "admin");
    
    res.json({ 
      success: true, 
      data: {
        roles,
        adminRoleId: adminRole ? adminRole.role_id : null
      } 
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ success: false, message: "Failed to fetch roles" });
  }
};

module.exports = exports;