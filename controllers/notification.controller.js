const prisma = require("../config/db");

 const ADMIN_ONLY_TYPES = [
  "NEW_SCHOLAR_SUBMISSION",
  "EDIT_PROPOSAL",
  "REPORT_SUBMITTED",
  "NEW_DISCIPLINE_SUBMISSION",
  "NEW_REGION_SUBMISSION",
  "NEW_FORUM_POST",
];
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  const { unread_only, page = 1, limit = 20, scope } = req.query;

  try {
    const where = { user_id: userId };
    if (unread_only === "true") {
      where.is_read = false;
    }

    // scope=public  -> exclude admin-only types
    // scope=admin   -> only admin-only types
    // no scope      -> everything (kept for backward compatibility)
    if (scope === "public") {
      where.type = { notIn: ADMIN_ONLY_TYPES };
    } else if (scope === "admin") {
      where.type = { in: ADMIN_ONLY_TYPES };
    }

    const notifications = await prisma.notifications.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    });

    const unreadCount = await prisma.notifications.count({
      where: { ...where, is_read: false },
    });

    res.json({
      success: true,
      data: notifications,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

 
exports.markNotificationRead = async (req, res) => {
  const notificationId = parseInt(req.params.id);
  const userId = req.user.id;
  
  if (Number.isNaN(notificationId)){
    return res.status(400).json({message:"missing notification id"})
  }

  try {
    const notification = await prisma.notifications.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

     
    if (notification.user_id !== userId) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const updated = await prisma.notifications.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("markNotificationRead error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

 
exports.markAllNotificationsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    await prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};