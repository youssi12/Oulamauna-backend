const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ 1. ADD THIS IMPORT AT THE TOP (Check if your folder is 'service' or 'services')
const { sendContactReplyEmail } = require('../service/email.service'); 

// ==========================================
// PUBLIC FUNCTIONS (For the Website Users)
// ==========================================

exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format.' });
    }

    const newMessage = await prisma.contact_messages.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject ? subject.trim() : 'General Inquiry',
        message: message.trim(),
        status: 'pending',
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully! We will get back to you soon.',
      data: newMessage,
    });

  } catch (error) {
    console.error('Error submitting contact form:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// ==========================================
// ADMIN FUNCTIONS (For the Admin Panel)
// ==========================================

exports.getAllMessages = async (req, res) => {
  try {
    const messages = await prisma.contact_messages.findMany({
      orderBy: { created_at: 'desc' },
    });

    return res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.contact_messages.findUnique({
      where: { id: parseInt(id) },
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found.' });
    }

    return res.status(200).json({
      success: true,
      data: message,
    });

  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

// ✅ 2. THIS FUNCTION NOW SENDS THE EMAIL
exports.replyToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_reply, admin_note } = req.body;

    if (!admin_reply) {
      return res.status(400).json({ success: false, error: 'Reply content is required.' });
    }

    const updatedMessage = await prisma.contact_messages.update({
      where: { id: parseInt(id) },
      data: {
        admin_reply: admin_reply,
        admin_note: admin_note || null,
        status: 'replied',
        replied_at: new Date(),
        updated_at: new Date(),
      },
    });

    // ✅ SEND THE EMAIL HERE
    try {
      await sendContactReplyEmail(updatedMessage.email, updatedMessage.subject, admin_reply);
    } catch (emailError) {
      console.error('Database updated, but email failed to send:', emailError);
    }

    return res.status(200).json({
      success: true,
      message: 'Reply saved and email sent successfully.',
      data: updatedMessage,
    });

  } catch (error) {
    console.error('Error replying to message:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

exports.archiveMessage = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Update status to "archived" instead of deleting
    await prisma.contact_messages.update({
      where: { id: parseInt(id) },
      data: { status: "archived" },
    });

    return res.status(200).json({
      success: true,
      message: 'Message archived successfully.',
    });

  } catch (error) {
    console.error('Error archiving message:', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};