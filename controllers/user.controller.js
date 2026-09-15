const prisma = require("../config/db");
const { isAdminUser } = require("../service/role.service");
const {uploadProfilePictureService} = require("../service/profilePicture.service");

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.users.findMany({
      select: { 
        id: true, 
        username: true, 
        email: true, 
        name: true,                  // ✅ ADDED
        bio: true,                   // ✅ ADDED
        profile_picture: true,       // ✅ ADDED (for avatar)
        contributorBadge: true,      // ✅ ADDED
        is_banned: true, 
        created_at: true,
        allowed_to_contribute: true, 
        roles: {                     
          select: { role_name: true }
        }
      }
    });
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      bio: user.bio,
      profile_picture: user.profile_picture,
      contributorBadge: user.contributorBadge,
      role: user.roles?.role_name || "user", 
      is_banned: user.is_banned,
      created_at: user.created_at,
      allowed_to_contribute: user.allowed_to_contribute
    }));

    res.json({ success: true, users: formattedUsers }); 
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
    res.status(500).json({ success: false, message: "Server error" });
    console.log("err: ",error)
  }

}

exports.getUserProfile = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  const requestingUserId = req.user?.id ?? null;

  try {
    const user = await prisma.users.findUnique({
      where: { id: targetUserId },
      select: {
        username: true,
        name: true,
        bio: true,
        profile_picture: true,
        links: true,
        email: true,
        show_email: true,
        contributorBadge: true,
        role_id: true,
        is_active: true,
        is_banned: true,
        profile_visibility: true,
        show_contributions: true, // ADDED
        password_hash: true, // used only to detect "deleted" (null = deleted), never sent to client
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isSelf = targetUserId === requestingUserId;

    // Deleted: password_hash was nulled out on delete — fully blank, no username.
    if (user.password_hash === null) {
      return res.json({
        success: true,
        data: { status: "deleted" },
      });
    }

    // Banned: fully blank, no username — same as deleted from the viewer's perspective.
    if (user.is_banned) {
      return res.json({
        success: true,
        data: { status: "banned" },
      });
    }

    // Deactivated (and viewed by someone else): show the username + status only.
    if (!user.is_active && !isSelf) {
      return res.json({
        success: true,
        data: {
          status: "deactivated",
          username: user.username,
        }
      });
    }

    // Profile visibility (only applies to someone else viewing — owner always sees their own profile):
    if (!isSelf) {
      // Private: nobody but the owner can see it, not even other logged-in users.
      if (user.profile_visibility === "private") {
        return res.json({ success: true, data: { status: "private" } });
      }
      // Registered only: blocks anonymous guests, lets any logged-in user through.
      if (user.profile_visibility === "registered_only" && !requestingUserId) {
        return res.json({ success: true, data: { status: "registered_only" } });
      }
    }

    const canSeeEmail = isSelf || user.show_email === true;
    const canSeeContributions = isSelf || user.show_contributions !== false; // ADDED
    const adminBadge = user.role_id === 1;

    const data = {
      username: user.username,
      name: user.name,
      bio: user.bio,
      profile_picture: user.profile_picture,
      links: user.links,
      email: canSeeEmail ? user.email : null,
      contributorBadge: user.contributorBadge,
      adminBadge: adminBadge,
      role_id: user.role_id,
      show_contributions: canSeeContributions // ADDED
    };

    res.json({ success: true, data });

  } catch (err) {
    console.error("getUserProfile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

 

exports.updateMyProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, bio } = req.body; // links removed from here
  let { links } = req.body;       // declared once, using let so it can be reassigned

  if (links !== undefined) {
    try {
      links = typeof links === "string" ? JSON.parse(links) : links;
    } catch {
      return res.status(400).json({ success: false, message: "Links must be valid JSON" });
    }
    if (typeof links !== "object" || links === null || Array.isArray(links)) {
      return res.status(400).json({ success: false, message: "Links must be a valid object" });
    }
  }

  try {
    if (req.file) {
      await uploadProfilePictureService({ userId, file: req.file });
    }

    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name : undefined,
        bio: bio !== undefined ? bio : undefined,
        links: links !== undefined ? links : undefined,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        links: true,
        profile_picture: true,
        contributorBadge: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("updateMyProfile error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.getUserContributions = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    const [scholarVersions, mediaItems, works] = await Promise.all([
      prisma.scholar_versions.findMany({
        where: { created_by: targetUserId, status: "approved" },
        select: {
          version_id: true,
          scholar_id: true,
          canonical_name: true,
          image_url: true,
          version_type: true,
          created_at: true,
          languages: { select: { code: true } }
        },
        orderBy: { created_at: "desc" }
      }),
      prisma.media.findMany({
        where: { uploaded_by: targetUserId, status: "approved" },
        select: {
          media_id: true,
          title: true,
          media_url: true,
          uploaded_at: true,
          scholar_versions: {
            select: { scholar_id: true, languages: { select: { code: true } } }
          }
        },
        orderBy: { uploaded_at: "desc" }
      }),
      // NEW: works added directly to an existing approved scholar
      prisma.scholar_works.findMany({
        where: { created_by: targetUserId, status: "approved" },
        select: {
          work_id: true,
          title: true,
          format: true,
          scholar_versions: {
            select: { scholar_id: true, languages: { select: { code: true } } }
          }
        },
        orderBy: { work_id: "desc" } // no created_at column, so use id as the recency proxy
      })
    ]);

    const contributions = [
      ...scholarVersions.map(v => ({
        type: v.version_type === "edition" ? "edition" : "scholar",
        id: v.version_id,
        title: v.canonical_name,
        image_url: v.image_url,
        created_at: v.created_at,
        scholar_id: v.scholar_id,
        lang: v.languages?.code ?? null
      })),
      ...mediaItems.map(m => ({
        type: "media",
        id: m.media_id,
        title: m.title,
        image_url: m.media_url,
        created_at: m.uploaded_at,
        scholar_id: m.scholar_versions?.scholar_id ?? null,
        lang: m.scholar_versions?.languages?.code ?? null
      })),
      // NEW: mapped with created_at: null since there's nothing to sort by
      ...works.map(w => ({
        type: "work",
        id: w.work_id,
        title: w.title,
        image_url: null,
        format: w.format,
        created_at: null,
        scholar_id: w.scholar_versions?.scholar_id ?? null,
        lang: w.scholar_versions?.languages?.code ?? null
      }))
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ success: true, data: contributions });
  } catch (error) {
    console.error("getUserContributions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUserForumPosts = async (req, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  if (Number.isNaN(targetUserId)) {
    return res.status(400).json({ success: false, message: "Invalid user id" });
  }

  try {
    // TODO: same private/banned/deactivated guard as getUserProfile —
    // run it before this query so a private profile's posts don't leak.

    const posts = await prisma.forum_posts.findMany({
      where: { user_id: targetUserId, deleted_at: null },
      select: {
        post_id: true,
        title: true,
        content: true,
        like_count: true,
        created_at: true,
        forum_categories: { select: { category_id: true, name: true } }
      },
      orderBy: { created_at: "desc" }
    });

    const data = posts.map(p => ({
      post_id: p.post_id,
      title: p.title,
      excerpt: p.content.length > 150 ? p.content.slice(0, 150) + "…" : p.content,
      like_count: p.like_count,
      created_at: p.created_at,
      category: p.forum_categories?.name ?? null
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("getUserForumPosts error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};