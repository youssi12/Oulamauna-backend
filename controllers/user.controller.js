const prisma = require("../config/db");
const { isAdminUser } = require("../service/role.service");
const {uploadProfilePictureService} = require("../service/profilePicture.service");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { id: true, username: true, email: true, role_id: true, is_banned: true, created_at: true }
    });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, username: true, email: true, role_id: true, is_banned: true, created_at: true }
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.banUser = async (req, res) => {
  const { id } = req.params;
  try {
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ message: "You cannot ban yourself" });

    const user = await prisma.users.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.is_banned) return res.status(400).json({ message: "User is already banned" });

    await prisma.users.update({
      where: { id: parseInt(id) },
      data: { is_banned: true }
    });

    res.json({ message: `User ${id} has been banned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.unbanUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.users.findUnique({ where: { id: parseInt(id) } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.is_banned) return res.status(400).json({ message: "User is not banned" });

    await prisma.users.update({
      where: { id: parseInt(id) },
      data: { is_banned: false }
    });

    res.json({ message: `User ${id} has been unbanned` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getMyProfile = async (req,res) =>{
  const userId = req.user.id;
  try {
     const user = await prisma.users.findUnique({
      where:{id:userId},
       
      select:{
        name:true,
        username:true,
        email:true,
        bio:true,
        links:true,
        profile_picture:true ,
        contributorBadge:true,
        role_id:true
      }
     })

     if(!user){
      return res.status(404).json({message:"the users doesnt exist"})
     }

     const adminBadge = user.role_id == 1 ?true :false;
     
     res.json({
      success: true,
      data:{
        ...user,
        adminBadge
      }
     })


  } catch (error) {
    res.status(500).json({error:error})
  }

}

exports.getUserProfile = async (req,res) =>{
  const targetUserId = parseInt(req.params.id,10);
    if(Number.isNaN(targetUserId)){
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }


   const requestinguserid = req.user?.id ?? null; 
   // i put null here in the case teh user is nt logged in and thus he still can see teh proile if lalowed 
  try{
    const user = await prisma.users.findUnique({
      where:{id:targetUserId},
        select: {
        username: true,
        name: true,
        bio: true,
        profile_picture: true,
        links: true,
        email: true,
        contributorBadge: true,
        role_id: true
       }
       
    })
   
     if(!user){
        return res.status(404).json({
         success: false,
        message: "User not found"
         });
       }

     const isSelf= targetUserId === requestinguserid; // null for the unprotected  user case (cause i think u can see prophile without havng to login)



     const canSeeMyProphile = true // later we get it from his settings 

     if(!canSeeMyProphile ){
      return res.status(400).json({message:"can't see his prophile "})
     }
     const canSeeMyEmail = canSeeMyProphile // take it from setngs late 

     const AdminBadge = user.role_id == 1;

     const data = {
      username : user.username,
      name:user.name,
      bio:user.bio,
      profile_picture:user.profile_picture,
      links:user.links,
      email:canSeeMyEmail ? user.email :null,
      contributorBadge: user.contributorBadge,
      adminBadge:AdminBadge

     }
     res.json({ success: true, data });

  }catch(err){
      console.error("getUserProphile error:", err);

  res.status(500).json({
    success: false,
    message: "Server error"
  });

  }
}

 

exports.updateMyProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, bio, links } = req.body;

  try {
    if (req.file) {
      await uploadProfilePictureService({ userId, file: req.file });
    }

    // TODO: your existing PATCH-style "only update what was sent" logic
    // for name/bio/links, same as we discussed for editScholar's pattern

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name : undefined, // TODO: confirm Prisma's undefined-skip behavior here, test it
        bio: bio !== undefined ? bio : undefined,
        links: links !== undefined ? links : undefined,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};


