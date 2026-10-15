const prisma = require("../config/db");

// ✅ GET ALL LANGUAGES FOR FRONTEND DROPDOWNS
exports.getAllLanguages = async (req, res) => {
  try {
    const languages = await prisma.languages.findMany({
      select: {
        language_id: true,
        code: true,
        name: true
      },
      orderBy: {
        language_id: 'asc' 
      }
    });

    res.json({
      success: true,
      data: languages
    });
  } catch (error) {
    console.error("getAllLanguages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// exports.connectDiffrentLanguages = async (req,res)=>{
//   const  {acceptedVersionId,secondVersionId} = req.body;

//   // how it will work the father id

// }