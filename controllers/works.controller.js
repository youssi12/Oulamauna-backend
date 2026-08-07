const { createWorkService } = require("../service/works.service");

exports.createWork = async (req, res) => {
  const {
    version_id,
    title,
    year,
    format,
    description,
    media_url,
  } = req.body;

 console.log("hi working")

  if (!version_id || !title || !format) {
    return res.status(400).json({
      success: false,
      message: "version_id, title and format are required",
    });
  }

  try {
    const work = await createWorkService({
      version_id,
      title,
      year,
      format,
      description,
      media_url,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      data: work,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};