const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

// Get chat messages
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50 } = req.query;

    const messages = await ChatMessage.find({ chatRoom: roomId })
      .populate('senderId', 'firstName lastName profileImage')
      .populate('receiverId', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, data: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to get messages' });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, messageType, chatRoom, attachments } = req.body;

    const messageData = {
      senderId: req.user.id,
      receiverId,
      message,
      messageType: messageType || 'text',
      chatRoom,
      attachments: attachments || []
    };

    const chatMessage = new ChatMessage(messageData);
    await chatMessage.save();

    const populatedMessage = await ChatMessage.findById(chatMessage._id)
      .populate('senderId', 'firstName lastName profileImage')
      .populate('receiverId', 'firstName lastName profileImage');

    // Emit socket event for real-time delivery
    if (req.io) {
      req.io.to(chatRoom).emit('receive-message', populatedMessage);
    }

    res.status(201).json({ success: true, data: populatedMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Get chat rooms
const getChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get unique chat rooms for this user
    const messages = await ChatMessage.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
      .populate('senderId', 'firstName lastName profileImage role')
      .populate('receiverId', 'firstName lastName profileImage role')
      .sort({ createdAt: -1 });

    // Group by chat room and get last message
    const roomsMap = new Map();
    
    messages.forEach(msg => {
      if (!roomsMap.has(msg.chatRoom)) {
        const otherUser = msg.senderId._id.toString() === userId 
          ? msg.receiverId 
          : msg.senderId;
        
        roomsMap.set(msg.chatRoom, {
          roomId: msg.chatRoom,
          otherUser,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
          isRead: msg.receiverId._id.toString() === userId ? msg.isRead : true
        });
      }
    });

    const rooms = Array.from(roomsMap.values());

    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error('Get chat rooms error:', error);
    res.status(500).json({ message: 'Failed to get chat rooms' });
  }
};

// Create chat room
const createChatRoom = async (req, res) => {
  try {
    const { receiverId } = req.body;

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create unique room ID
    const roomId = [req.user.id, receiverId].sort().join('-');

    res.status(201).json({
      success: true,
      data: {
        roomId,
        receiver: {
          id: receiver._id,
          firstName: receiver.firstName,
          lastName: receiver.lastName,
          profileImage: receiver.profileImage,
          role: receiver.role
        }
      }
    });
  } catch (error) {
    console.error('Create chat room error:', error);
    res.status(500).json({ message: 'Failed to create chat room' });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;

    await ChatMessage.updateMany(
      {
        chatRoom: roomId,
        receiverId: req.user.id,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const count = await ChatMessage.countDocuments({
      receiverId: req.user.id,
      isRead: false
    });

    res.json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  getChatRooms,
  createChatRoom,
  markAsRead,
  getUnreadCount
};
