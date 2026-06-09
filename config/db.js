const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

// Test connection
prisma.$connect()
  .then(() => console.log("✅ Database connected!"))
  .catch((e) => console.error("❌ DB connection failed:", e.message));

module.exports = prisma;