const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio', 'video'],
    default: 'text',
  },
  attachments: [{
    type: String, // URLs to files
    filename: String,
    size: Number,
  }],
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  isAI: {
    type: Boolean,
    default: false,
  },
  chatRoom: {
    type: String, // Unique identifier for chat room
    required: true,
  },
}, {
  timestamps: true,
});

// Index for efficient querying
chatMessageSchema.index({ chatRoom: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, receiverId: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
