const {
  uploadScholarImageService,
} = require("../service/scholarImage.service");

exports.uploadScholarImage = async (req, res) => {
  try {
    const { version_id } = req.body;

    const version = await uploadScholarImageService({
      version_id,
      file: req.file,
    });

    res.status(200).json({
      success: true,
      data: version,
    });
  } catch (error) {
    console.error("uploadScholarImage error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};