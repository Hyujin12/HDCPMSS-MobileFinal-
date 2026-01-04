const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH MIDDLEWARE (from UserRoutes)
// -----------------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Message Model Schema (models/Message.js)
/*
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  sender: {
    type: String,
    required: true,
    enum: ['patient', 'admin']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
messageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
*/

// GET /api/messages/:userId - Get all messages for a user
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is accessing their own messages or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const messages = await Message.find({ userId })
      .sort({ createdAt: 1 }) // Oldest first for chat display
      .lean();

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching messages',
      error: error.message 
    });
  }
});

// POST /api/messages - Send a new message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { userId, userEmail, username, message, sender } = req.body;

    // Validation
    if (!userId || !userEmail || !username || !message || !sender) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (!['patient', 'admin'].includes(sender)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid sender type' 
      });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message cannot be empty' 
      });
    }

    if (message.length > 500) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message too long (max 500 characters)' 
      });
    }

    // Verify user is sending message for themselves (unless admin)
    if (sender === 'patient' && req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const newMessage = new Message({
      userId,
      userEmail,
      username,
      message: message.trim(),
      sender,
      isRead: sender === 'patient', // Patient messages are auto-read
      createdAt: new Date()
    });

    await newMessage.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending message',
      error: error.message 
    });
  }
});

// PUT /api/messages/:userId/mark-read - Mark all messages as read for a user
router.put('/:userId/mark-read', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user is marking their own messages
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const result = await Message.updateMany(
      { 
        userId, 
        isRead: false,
        sender: 'admin' // Only mark admin messages as read
      },
      { 
        $set: { isRead: true } 
      }
    );

    res.json({
      success: true,
      message: 'Messages marked as read',
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error marking messages as read',
      error: error.message 
    });
  }
});

// GET /api/messages/:userId/unread-count - Get unread message count
router.get('/:userId/unread-count', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const count = await Message.countDocuments({
      userId,
      sender: 'admin',
      isRead: false
    });

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting unread count',
      error: error.message 
    });
  }
});

// DELETE /api/messages/:messageId - Delete a message (admin only)
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    // Only admins can delete messages
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can delete messages' 
      });
    }

    const { messageId } = req.params;
    
    const deletedMessage = await Message.findByIdAndDelete(messageId);

    if (!deletedMessage) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting message',
      error: error.message 
    });
  }
});

// GET /api/messages/admin/all - Get all conversations (admin only)
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
    }

    // Get unique users who have sent messages
    const conversations = await Message.aggregate([
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$userId',
          username: { $first: '$username' },
          userEmail: { $first: '$userEmail' },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$createdAt' },
          lastSender: { $first: '$sender' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$sender', 'patient'] },
                  { $eq: ['$isRead', false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching conversations',
      error: error.message 
    });
  }
});

module.exports = router;