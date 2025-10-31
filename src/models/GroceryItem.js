const mongoose = require('mongoose');

const groceryItemSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  category: {
    type: String,
    enum: ['fruits', 'vegetables', 'dairy', 'protein', 'grains', 'supplements', 'snacks', 'beverages'],
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  unit: {
    type: String,
    enum: ['kg', 'lb', 'piece', 'pack', 'bottle', 'box'],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  images: [{
    type: String, // Cloudinary URLs
  }],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    vitamins: [String],
    minerals: [String],
  },
  isOrganic: {
    type: Boolean,
    default: false,
  },
  isPregnancySafe: {
    type: Boolean,
    default: true,
  },
  allergens: [String],
  pregnancyBenefits: [String],
  isAvailable: {
    type: Boolean,
    default: true,
  },
  tags: [String],
}, {
  timestamps: true,
});

module.exports = mongoose.model('GroceryItem', groceryItemSchema);
