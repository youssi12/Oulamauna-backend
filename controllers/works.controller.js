const prisma = require("../config/db");

exports.createWork = async (req, res) => {
  const {
    version_id,
    title,
    year,
    format,
    description,
    media_url,
  } = req.body;

  const file = req.file;

  if (!version_id || !title || !format) {
    return res.status(400).json({
      success: false,
      message: "version_id, title and format are required",
    });
  }

  try {
    const version = await prisma.scholar_versions.findUnique({
      where: {
        version_id: parseInt(version_id),
      },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "Scholar version not found",
      });
    }

    if (file && media_url) {
      return res.status(400).json({
        success: false,
        message: "Provide either a file or a media_url, not both",
      });
    }

    let workData = {
      version_id: parseInt(version_id),
      title,
      year: year ? parseInt(year) : null,
      format,
      description: description || null,
    };

    if (file) {
      workData = {
        ...workData,
        file_name: file.originalname,
        file_path: file.path,
        source_type: "upload",
      };
    } else if (media_url) {
      workData = {
        ...workData,
        media_url,
        source_type: "external",
      };
    }

    const work = await prisma.scholar_works.create({
      data: workData,
    });

    res.status(201).json({
      success: true,
      data: work,
    });

  } catch (error) {
    console.error("createWork error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
exports.getVersionWorks = async (req, res) => {
  const versionId = parseInt(req.params.versionId);

  try {
    const works = await prisma.scholar_works.findMany({
      where: {
        version_id: versionId,
      },
      orderBy: {
        year: "desc",
      },
    });

    res.json({
      success: true,
      count: works.length,
      data: works,
    });

  } catch (error) {
    console.error("getVersionWorks error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};