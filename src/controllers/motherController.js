const PregnancyRecord = require('../models/PregnancyRecord');
const Appointment = require('../models/Appointment');
const GroceryItem = require('../models/GroceryItem');
const Order = require('../models/Order');
const User = require('../models/User');

// Get mother dashboard data
const getDashboard = async (req, res) => {
  try {
    const pregnancyRecord = await PregnancyRecord.findOne({ motherId: req.user.id })
      .populate('appointments')
      .populate('medications.prescribedBy', 'firstName lastName specialization');

    const upcomingAppointments = await Appointment.find({
      motherId: req.user.id,
      status: { $in: ['scheduled', 'confirmed'] },
      appointmentDate: { $gte: new Date() }
    }).populate('medicalPersonnelId', 'firstName lastName specialization').limit(5);

    const recentOrders = await Order.find({ motherId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('storeId', 'storeName');

    res.json({
      success: true,
      data: {
        pregnancyRecord,
        upcomingAppointments,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
};

// Get or create pregnancy record
const getPregnancyRecord = async (req, res) => {
  try {
    let record = await PregnancyRecord.findOne({ motherId: req.user.id })
      .populate('appointments')
      .populate('medications.prescribedBy', 'firstName lastName specialization');

    if (!record && req.user.dueDate) {
      // Create initial pregnancy record
      const dueDate = new Date(req.user.dueDate);
      const today = new Date();
      const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
      const currentWeek = Math.max(1, 40 - Math.floor(daysDiff / 7));
      
      let trimester = 'first';
      if (currentWeek > 28) trimester = 'third';
      else if (currentWeek > 14) trimester = 'second';

      record = new PregnancyRecord({
        motherId: req.user.id,
        dueDate,
        currentWeek,
        trimester,
        healthMetrics: {},
        symptoms: [],
        medications: []
      });
      await record.save();
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Get pregnancy record error:', error);
    res.status(500).json({ message: 'Failed to get pregnancy record' });
  }
};

// Update pregnancy record
const updatePregnancyRecord = async (req, res) => {
  try {
    const { healthMetrics, symptoms, notes } = req.body;

    let record = await PregnancyRecord.findOne({ motherId: req.user.id });
    
    if (!record) {
      return res.status(404).json({ message: 'Pregnancy record not found' });
    }

    if (healthMetrics) {
      record.healthMetrics = { ...record.healthMetrics, ...healthMetrics };
    }

    if (symptoms) {
      record.symptoms.push(...symptoms);
    }

    if (notes) {
      record.notes.push({
        content: notes,
        addedBy: req.user.id,
        date: new Date()
      });
    }

    await record.save();

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Update pregnancy record error:', error);
    res.status(500).json({ message: 'Failed to update pregnancy record' });
  }
};

// Get appointments
const getAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ motherId: req.user.id })
      .populate('medicalPersonnelId', 'firstName lastName specialization phone email profileImage')
      .sort({ appointmentDate: -1 });

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Failed to get appointments' });
  }
};

// Book appointment
const bookAppointment = async (req, res) => {
  try {
    const { medicalPersonnelId, appointmentDate, appointmentTime, type, notes } = req.body;

    const medicalPersonnel = await User.findById(medicalPersonnelId);
    if (!medicalPersonnel || medicalPersonnel.role !== 'medical') {
      return res.status(404).json({ message: 'Medical personnel not found' });
    }

    const appointment = new Appointment({
      motherId: req.user.id,
      medicalPersonnelId,
      appointmentDate,
      appointmentTime,
      type,
      notes,
      status: 'scheduled'
    });

    await appointment.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('medicalPersonnelId', 'firstName lastName specialization phone email');

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.to(medicalPersonnelId).emit('new-appointment', populatedAppointment);
    }

    res.status(201).json({ success: true, data: populatedAppointment });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ message: 'Failed to book appointment' });
  }
};

// Update appointment
const updateAppointment = async (req, res) => {
  try {
    const { appointmentDate, appointmentTime, type, notes } = req.body;
    const appointmentId = req.params.id;

    // Verify appointment belongs to the mother
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      motherId: req.user.id
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Update appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        appointmentDate,
        appointmentTime,
        type,
        notes
      },
      { new: true }
    ).populate('medicalPersonnelId', 'firstName lastName email specialization');

    // Send notification to medical personnel
    if (req.io) {
      req.io.to(updatedAppointment.medicalPersonnelId._id.toString()).emit('appointment-updated', {
        appointment: updatedAppointment,
        message: `Appointment with ${req.user.firstName} ${req.user.lastName} has been updated`
      });
    }

    res.json({ success: true, data: updatedAppointment });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ message: 'Failed to update appointment' });
  }
};

// Get grocery items
const getGroceryItems = async (req, res) => {
  try {
    const { category, search, isPregnancySafe, isOrganic } = req.query;

    const filter = { isAvailable: true };
    
    if (category) filter.category = category;
    if (isPregnancySafe === 'true') filter.isPregnancySafe = true;
    if (isOrganic === 'true') filter.isOrganic = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const items = await GroceryItem.find(filter)
      .populate('storeId', 'storeName storeAddress location')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get grocery items error:', error);
    res.status(500).json({ message: 'Failed to get grocery items' });
  }
};

// Create order
const createOrder = async (req, res) => {
  try {
    const { storeId, items, deliveryAddress, deliveryDate, deliveryTime, deliveryNotes } = req.body;

    // Calculate total amount
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const groceryItem = await GroceryItem.findById(item.groceryItemId);
      if (!groceryItem || !groceryItem.isAvailable) {
        return res.status(400).json({ message: `Item ${groceryItem?.name || 'unknown'} is not available` });
      }
      
      if (groceryItem.quantity < item.quantity) {
        return res.status(400).json({ message: `Insufficient quantity for ${groceryItem.name}` });
      }

      totalAmount += groceryItem.price * item.quantity;
      orderItems.push({
        groceryItemId: item.groceryItemId,
        quantity: item.quantity,
        price: groceryItem.price
      });
    }

    const order = new Order({
      motherId: req.user.id,
      storeId,
      items: orderItems,
      totalAmount,
      deliveryAddress,
      deliveryDate,
      deliveryTime,
      deliveryNotes,
      status: 'pending',
      paymentStatus: 'pending',
      trackingNumber: `MCO-${Date.now()}`
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('storeId', 'storeName storeAddress phone')
      .populate('items.groceryItemId');

    // Emit socket event for real-time notification to store
    if (req.io) {
      req.io.to(storeId).emit('new-order', populatedOrder);
    }

    res.status(201).json({ success: true, data: populatedOrder });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order' });
  }
};

// Get orders
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ motherId: req.user.id })
      .populate('storeId', 'storeName storeAddress phone')
      .populate('items.groceryItemId')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to get orders' });
  }
};

// Get medical personnel list
const getMedicalPersonnel = async (req, res) => {
  try {
    const { specialization } = req.query;
    
    // First, let's check what users exist with role 'medical'
    const allMedicalUsers = await User.find({ role: 'medical' }).lean();
    console.log('All medical users:', allMedicalUsers.map(u => ({
      id: u._id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      isVerified: u.isVerified,
      verificationStatus: u.verificationStatus,
      isActive: u.isActive
    })));

    const filter = { 
      role: { $regex: '^medical$', $options: 'i' }, // Case-insensitive match
      isVerified: true,
      verificationStatus: 'approved',
      isActive: true
    };
    
    if (specialization) {
      filter.specialization = specialization;
    }

    console.log('Applying filter:', JSON.stringify(filter));

    const medicalPersonnel = await User.find(filter)
      .select('firstName lastName specialization profileImage phone email licenseNumber')
      .sort({ firstName: 1, lastName: 1 })
      .lean();
    
    console.log('Filtered medical personnel count:', medicalPersonnel.length);

    if (!medicalPersonnel.length) {
      console.log('No verified medical personnel found. Filter:', JSON.stringify(filter));
    } else {
      console.log(`Found ${medicalPersonnel.length} medical personnel`);
    }

    res.json({ 
      success: true, 
      data: medicalPersonnel,
      totalCount: medicalPersonnel.length
    });
  } catch (error) {
    console.error('Get medical personnel error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get medical personnel',
      error: error.message
    });
  }
};

// Get nearby grocery stores (geospatial query)
const getNearbyStores = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km, default 10km

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInMeters = parseFloat(radius) * 1000; // Convert km to meters

    // Find stores within radius using geospatial query
    const stores = await User.find({
      role: 'grocery',
      isVerified: true,
      verificationStatus: 'approved',
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude] // Note: MongoDB uses [lng, lat]
          },
          $maxDistance: radiusInMeters
        }
      }
    })
    .select('storeName storeAddress location profileImage phone email')
    .lean();

    // Calculate distance and add metrics for each store
    const storesWithDetails = await Promise.all(
      stores.map(async (store) => {
        // Calculate distance in km
        const R = 6371; // Earth's radius in km
        const dLat = (latitude - store.location.coordinates[1]) * Math.PI / 180;
        const dLon = (longitude - store.location.coordinates[0]) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(store.location.coordinates[1] * Math.PI / 180) * 
          Math.cos(latitude * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Get product count
        const productCount = await GroceryItem.countDocuments({ 
          storeId: store._id, 
          isAvailable: true 
        });

        // Estimate delivery time (assuming 30 min for first 5km, +5 min per additional km)
        const baseTime = 30;
        const additionalTime = Math.max(0, (distance - 5)) * 5;
        const estimatedDeliveryTime = Math.round(baseTime + additionalTime);

        return {
          ...store,
          distance: parseFloat(distance.toFixed(2)),
          productCount,
          estimatedDeliveryTime: `${estimatedDeliveryTime}-${estimatedDeliveryTime + 15} minutes`
        };
      })
    );

    // Sort by distance
    storesWithDetails.sort((a, b) => a.distance - b.distance);

    res.json({ success: true, data: storesWithDetails });
  } catch (error) {
    console.error('Get nearby stores error:', error);
    res.status(500).json({ message: 'Failed to get nearby stores' });
  }
};

const controllers = {
  getDashboard,
  getPregnancyRecord,
  updatePregnancyRecord,
  getAppointments,
  bookAppointment,
  updateAppointment,
  getGroceryItems,
  createOrder,
  getOrders,
  getMedicalPersonnel,
  getNearbyStores
};

module.exports = controllers;
