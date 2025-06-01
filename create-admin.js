import mongoose from 'mongoose';
import { config, getMongoUri } from './config.js';
import Customer from './models/Customer.js';

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(getMongoUri(), config.mongodb.options);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

// Create admin user
async function createAdmin() {
  try {
    await connectDB();
    
    console.log('🔧 Creating admin user...');
    
    // Check if admin already exists
    const existingAdmin = await Customer.findOne({ email: 'admin' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists, updating password...');
      existingAdmin.password = '11111'; // Will be hashed by the pre-save hook
      await existingAdmin.save();
      console.log('✅ Admin password updated successfully!');
    } else {
      // Create new admin user
      const adminUser = new Customer({
        email: 'admin',
        password: '11111', // Will be hashed by the pre-save hook
        name: 'المدير العام',
        phone: '',
        city: '',
        role: 'admin',
        status: 'active'
      });
      
      await adminUser.save();
      console.log('✅ Admin user created successfully!');
    }
    
    console.log('📋 Admin credentials:');
    console.log('   Email: admin');
    console.log('   Password: 11111');
    console.log('   Role: admin');
    
    console.log('🎯 You can now login at: http://localhost:5173/login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdmin(); 