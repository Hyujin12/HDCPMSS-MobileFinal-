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

// Indexes for better performance
messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ userId: 1, isRead: 1 });

// Export with custom collection name "Messages" (capital M)
module.exports = mongoose.model('Message', messageSchema, 'Messages');