const { cloudinary } = require("../config/cloudinary");
const prisma = require("../config/db");

const uploadProfilePictureService = async ({ userId, file }) => {
  if (!file) {
    throw new Error("Image is required");
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const oldProfilePicture = user.profile_picture;

  const updatedUser = await prisma.users.update({
    where: { id: userId },
    data: {
      profile_picture: file.path,
    },
  });

  if (oldProfilePicture) {
    // Match everything after /upload/v<digits>/ up to (but excluding) the file extension.
    // Handles any folder depth correctly, unlike a fixed slice(-2).
    const match = oldProfilePicture.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    const public_id = match ? match[1] : null;

    if (public_id) {
      try {
        await cloudinary.uploader.destroy(public_id, {
          resource_type: "image",
        });
      } catch (err) {
        console.error("Failed to delete old profile picture:", err.message);
      }
    } else {
      console.error("Could not parse public_id from URL:", oldProfilePicture);
    }
  }

  return updatedUser;
};

module.exports = { uploadProfilePictureService };