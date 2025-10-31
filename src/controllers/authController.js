const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Register user
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, role, ...additionalData } = req.body;

    console.log('Registration request received:', { firstName, lastName, email, phone, role });

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user data based on role
    const userData = {
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
    };

    // Add role-specific data
    if (role === 'mother') {
      userData.dueDate = additionalData.dueDate;
      userData.pregnancyStage = additionalData.pregnancyStage;
    } else if (role === 'medical') {
      userData.licenseNumber = additionalData.licenseNumber;
      userData.specialization = additionalData.specialization;
    } else if (role === 'grocery') {
      userData.storeName = additionalData.storeName;
      userData.storeAddress = additionalData.storeAddress;
    }

    const user = new User(userData);
    console.log('Attempting to save user:', user.email);
    await user.save();
    console.log('User saved successfully:', user._id);

    // Generate token
    const token = generateToken(user._id);

    // Send verification email
    if (role !== 'admin') {
      sendEmail({
        to: email,
        subject: 'Welcome to MCaid - Please verify your account',
        template: 'welcome',
        data: { firstName, verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${token}` }
      }).catch(err => {
        // Email sending is optional, log but don't fail registration
        console.warn('⚠️ Email sending skipped:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for email:', email);

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User found, checking password...');
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Password valid, generating token...');
    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user data' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, healthMetrics, ...additionalData } = req.body;
    
    const updateData = {};
    
    // Basic fields
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    
    // Health metrics for mothers
    if (healthMetrics && req.user.role === 'mother') {
      console.log('Updating health metrics:', healthMetrics);
      updateData.healthMetrics = healthMetrics;
    }

    // Add role-specific updates
    if (req.user.role === 'mother') {
      if (additionalData.dueDate) updateData.dueDate = additionalData.dueDate;
      if (additionalData.pregnancyStage) updateData.pregnancyStage = additionalData.pregnancyStage;
    } else if (req.user.role === 'medical') {
      if (additionalData.specialization) updateData.specialization = additionalData.specialization;
    } else if (req.user.role === 'grocery') {
      if (additionalData.storeName) updateData.storeName = additionalData.storeName;
      if (additionalData.storeAddress) updateData.storeAddress = additionalData.storeAddress;
    }

    console.log('Update profile request for user:', req.user.id, 'Data:', updateData);
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    console.log('Profile updated successfully');
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to change password' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
};
