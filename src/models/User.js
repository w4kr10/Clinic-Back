const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
  },
  role: {
    type: String,
    enum: ['mother', 'medical', 'grocery', 'admin'],
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  // Whether the account is active (used to filter available personnel/stores)
  isActive: {
    type: Boolean,
    default: true,
  },
  profileImage: {
    type: String,
    default: '',
  },
  // Mother specific fields
  dueDate: {
    type: Date,
  },
  pregnancyStage: {
    type: String,
    enum: ['first-trimester', 'second-trimester', 'third-trimester'],
  },
  // Health metrics for mothers
  healthMetrics: {
    weight: Number,
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
    },
    bloodSugar: Number,
    heartRate: Number,
    temperature: Number,
    lastUpdated: Date,
  },
  // Medical personnel specific fields
  licenseNumber: {
    type: String,
  },
  specialization: {
    type: String,
  },
  credentials: [{
    type: String, // URLs to uploaded documents
  }],
  // Grocery store specific fields
  storeName: {
    type: String,
  },
  storeAddress: {
    type: String,
  },
  businessLicense: {
    type: String,
  },
  // Location
  location: {
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  },
  // Notification preferences
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true,
    },
    sms: {
      type: Boolean,
      default: true,
    },
    push: {
      type: Boolean,
      default: true,
    },
  },
}, {
  timestamps: true,
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
