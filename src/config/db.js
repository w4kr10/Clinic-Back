const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_ATLAS_URI;
    
    if (!mongoUri) {
      console.warn('⚠️  MONGODB_URI or MONGODB_ATLAS_URI not set in .env file');
      console.warn('Database connection skipped. Set MONGODB_URI in .env to connect.');
      return;
    }
    
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.warn('⚠️  Server running without database connection');
  }
};

module.exports = connectDB;
