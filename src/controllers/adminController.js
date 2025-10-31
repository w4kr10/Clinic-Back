const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const GroceryItem = require('../models/GroceryItem');
const ChatMessage = require('../models/ChatMessage');

// Get admin dashboard data
const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMothers = await User.countDocuments({ role: 'mother' });
    const totalMedical = await User.countDocuments({ role: 'medical' });
    const totalStores = await User.countDocuments({ role: 'grocery' });

    const pendingVerifications = await User.countDocuments({
      verificationStatus: 'pending',
      role: { $in: ['medical', 'grocery'] }
    });

    const totalAppointments = await Appointment.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalProducts = await GroceryItem.countDocuments();

    res.json({
      success: true,
      data: {
        totalUsers,
        totalMothers,
        totalMedical,
        totalStores,
        pendingVerifications,
        totalAppointments,
        totalOrders,
        totalProducts
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const { role, verificationStatus, search } = req.query;
    
    const filter = {};
    
    if (role) filter.role = role;
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let additionalData = {};

    if (user.role === 'mother') {
      const appointments = await Appointment.countDocuments({ motherId: id });
      const orders = await Order.countDocuments({ motherId: id });
      additionalData = { appointments, orders };
    } else if (user.role === 'medical') {
      const appointments = await Appointment.countDocuments({ medicalPersonnelId: id });
      const patients = await Appointment.distinct('motherId', { medicalPersonnelId: id });
      additionalData = { appointments, totalPatients: patients.length };
    } else if (user.role === 'grocery') {
      const products = await GroceryItem.countDocuments({ storeId: id });
      const orders = await Order.countDocuments({ storeId: id });
      additionalData = { products, orders };
    }

    res.json({ success: true, data: { user, ...additionalData } });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Failed to get user details' });
  }
};

// Verify user (approve/reject)
const verifyUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, isVerified } = req.body;

    if (!['approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ message: 'Invalid verification status' });
    }

    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!['medical', 'grocery'].includes(user.role)) {
      return res.status(400).json({ message: 'Only medical personnel and grocery stores require verification' });
    }

    user.verificationStatus = verificationStatus;
    user.isVerified = isVerified !== undefined ? isVerified : verificationStatus === 'approved';

    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ message: 'Failed to verify user' });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clean up related data based on role
    if (user.role === 'grocery') {
      await GroceryItem.deleteMany({ storeId: id });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

// Get platform analytics
const getAnalytics = async (req, res) => {
  try {
    // User growth by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { 
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' },
            role: '$role'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Appointment statistics
    const appointmentStats = await Appointment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { 
            month: { $month: '$appointmentDate' },
            year: { $year: '$appointmentDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Order statistics
    const orderStats = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { 
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Top performing stores
    const topStores = await Order.aggregate([
      {
        $group: {
          _id: '$storeId',
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    const populatedStores = await User.populate(topStores, {
      path: '_id',
      select: 'storeName storeAddress'
    });

    // AI chatbot engagement
    const aiChatEngagement = await ChatMessage.countDocuments({ isAI: true });

    res.json({
      success: true,
      data: {
        userGrowth,
        appointmentStats,
        orderStats,
        topStores: populatedStores,
        aiChatEngagement
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
};

// Get reports
const getReports = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    let reportData;

    switch (type) {
      case 'users':
        reportData = await User.aggregate([
          { $match: dateFilter.createdAt ? { createdAt: dateFilter } : {} },
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 }
            }
          }
        ]);
        break;

      case 'appointments':
        reportData = await Appointment.aggregate([
          { $match: dateFilter.appointmentDate ? { appointmentDate: dateFilter } : {} },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);
        break;

      case 'orders':
        reportData = await Order.aggregate([
          { $match: dateFilter.createdAt ? { createdAt: dateFilter } : {} },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' }
            }
          }
        ]);
        break;

      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    res.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Failed to get reports' });
  }
};

// Get AI assistant logs
const getAILogs = async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;

    const aiMessages = await ChatMessage.find({ isAI: true })
      .populate('senderId', 'firstName lastName email')
      .populate('receiverId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await ChatMessage.countDocuments({ isAI: true });

    res.json({
      success: true,
      data: {
        messages: aiMessages,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get AI logs error:', error);
    res.status(500).json({ message: 'Failed to get AI logs' });
  }
};

// Get all grocery stores with location and metrics
const getStores = async (req, res) => {
  try {
    const stores = await User.find({ role: 'grocery', isVerified: true })
      .select('storeName storeAddress location profileImage email phone createdAt')
      .lean();
    
    // Add metrics for each store
    const storesWithMetrics = await Promise.all(
      stores.map(async (store) => {
        const productCount = await GroceryItem.countDocuments({ storeId: store._id });
        const orderCount = await Order.countDocuments({ storeId: store._id });
        const revenueData = await Order.aggregate([
          { $match: { storeId: store._id, paymentStatus: 'paid' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        return {
          ...store,
          metrics: {
            products: productCount,
            orders: orderCount,
            revenue: revenueData[0]?.total || 0
          }
        };
      })
    );
    
    res.json({ success: true, data: storesWithMetrics });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ message: 'Failed to get stores' });
  }
};

// Get detailed store information
const getStoreDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await User.findOne({ _id: id, role: 'grocery' })
      .select('-password')
      .lean();
    
    if (!store) {
      return res.status(404).json({ message: 'Store not found' });
    }

    // Get store metrics
    const products = await GroceryItem.find({ storeId: id }).select('name price category isAvailable');
    const productCount = products.length;
    
    const orders = await Order.find({ storeId: id })
      .populate('motherId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const orderStats = await Order.aggregate([
      { $match: { storeId: store._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalRevenue = await Order.aggregate([
      { $match: { storeId: store._id, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        store,
        metrics: {
          products: productCount,
          orders: orders.length,
          revenue: totalRevenue[0]?.total || 0,
          orderStats
        },
        recentOrders: orders,
        topProducts: products.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Get store details error:', error);
    res.status(500).json({ message: 'Failed to get store details' });
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getUserDetails,
  verifyUser,
  deleteUser,
  getAnalytics,
  getReports,
  getAILogs,
  getStores,
  getStoreDetails
};
