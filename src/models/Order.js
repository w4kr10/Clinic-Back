const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  motherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [{
    groceryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroceryItem',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
  deliveryTime: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'mpesa', 'bank-transfer'],
  },
  paymentId: {
    type: String, // Stripe payment intent ID or M-Pesa transaction ID
  },
  deliveryNotes: {
    type: String,
  },
  trackingNumber: {
    type: String,
  },
  estimatedDeliveryTime: {
    type: Date,
  },
  actualDeliveryTime: {
    type: Date,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  review: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);
