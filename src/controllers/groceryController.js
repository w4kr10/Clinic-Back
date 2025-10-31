const GroceryItem = require('../models/GroceryItem');
const Order = require('../models/Order');
const User = require('../models/User');

// Get grocery dashboard data
const getDashboard = async (req, res) => {
  try {
    const totalProducts = await GroceryItem.countDocuments({ storeId: req.user.id });
    const availableProducts = await GroceryItem.countDocuments({ 
      storeId: req.user.id, 
      isAvailable: true 
    });

    const todayOrders = await Order.countDocuments({
      storeId: req.user.id,
      createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    const pendingOrders = await Order.countDocuments({
      storeId: req.user.id,
      status: { $in: ['pending', 'confirmed', 'preparing'] }
    });

    const recentOrders = await Order.find({ storeId: req.user.id })
      .populate('motherId', 'firstName lastName phone email')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        totalProducts,
        availableProducts,
        todayOrders,
        pendingOrders,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Grocery dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
};

// Get inventory
const getInventory = async (req, res) => {
  try {
    const { category, isAvailable, search } = req.query;
    
    const filter = { storeId: req.user.id };
    
    if (category) filter.category = category;
    if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await GroceryItem.find(filter).sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to get inventory' });
  }
};

// Add inventory item
const addInventoryItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      storeId: req.user.id
    };

    const item = new GroceryItem(itemData);
    await item.save();

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Add inventory item error:', error);
    res.status(500).json({ message: 'Failed to add inventory item' });
  }
};

// Update inventory item
const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await GroceryItem.findOne({ _id: id, storeId: req.user.id });
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    Object.assign(item, req.body);
    await item.save();

    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ message: 'Failed to update inventory item' });
  }
};

// Delete inventory item
const deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await GroceryItem.findOneAndDelete({ _id: id, storeId: req.user.id });
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ message: 'Failed to delete inventory item' });
  }
};

// Get orders
const getOrders = async (req, res) => {
  try {
    const { status, date } = req.query;
    
    const filter = { storeId: req.user.id };
    
    if (status) {
      filter.status = status;
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const orders = await Order.find(filter)
      .populate('motherId', 'firstName lastName phone email')
      .populate('items.groceryItemId')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, estimatedDeliveryTime } = req.body;

    const order = await Order.findOne({ _id: id, storeId: req.user.id });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    
    if (estimatedDeliveryTime) {
      order.estimatedDeliveryTime = estimatedDeliveryTime;
    }
    
    if (status === 'delivered') {
      order.actualDeliveryTime = new Date();
    }

    await order.save();

    const updatedOrder = await Order.findById(id)
      .populate('motherId', 'firstName lastName phone email')
      .populate('items.groceryItemId');

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.to(order.motherId.toString()).emit('order-status-updated', updatedOrder);
    }

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
};

// Get analytics
const getAnalytics = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments({ storeId: req.user.id });
    
    const completedOrders = await Order.countDocuments({
      storeId: req.user.id,
      status: 'delivered'
    });

    const totalRevenue = await Order.aggregate([
      { $match: { storeId: req.user._id, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // Top selling products
    const topProducts = await Order.aggregate([
      { $match: { storeId: req.user._id } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.groceryItemId',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Populate product details
    const populatedTopProducts = await GroceryItem.populate(topProducts, {
      path: '_id',
      select: 'name category price images'
    });

    // Orders by month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const ordersByMonth = await Order.aggregate([
      {
        $match: {
          storeId: req.user._id,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
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

    res.json({
      success: true,
      data: {
        totalOrders,
        completedOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        topProducts: populatedTopProducts,
        ordersByMonth
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Failed to get analytics' });
  }
};

module.exports = {
  getDashboard,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  getOrders,
  updateOrderStatus,
  getAnalytics
};
