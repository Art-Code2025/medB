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

// Create test customer and admin
async function createTestUsers() {
  try {
    await connectDB();
    
    console.log('🔧 Creating test users...\n');
    
    // 1. Create/Update Admin user
    console.log('👑 Setting up admin user...');
    const existingAdmin = await Customer.findOne({ email: 'admin' });
    if (existingAdmin) {
      console.log('⚠️ Admin user already exists, updating password...');
      existingAdmin.password = '11111'; // Will be hashed by the pre-save hook
      await existingAdmin.save();
      console.log('✅ Admin password updated successfully!');
    } else {
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
    
    // 2. Create Test Customer
    console.log('\n👤 Setting up test customer...');
    const existingCustomer = await Customer.findOne({ email: 'test@customer.com' });
    if (existingCustomer) {
      console.log('⚠️ Test customer already exists, updating password...');
      existingCustomer.password = 'test123'; // Will be hashed by the pre-save hook
      await existingCustomer.save();
      console.log('✅ Test customer password updated successfully!');
    } else {
      const testCustomer = new Customer({
        email: 'test@customer.com',
        password: 'test123', // Will be hashed by the pre-save hook
        name: 'عميل تجريبي',
        phone: '+966501234567',
        city: 'الرياض',
        role: 'customer',
        status: 'active'
      });
      
      await testCustomer.save();
      console.log('✅ Test customer created successfully!');
    }
    
    console.log('\n📋 User credentials summary:');
    console.log('=' * 50);
    console.log('🔐 ADMIN LOGIN (Dashboard Access):');
    console.log('   URL: http://localhost:5173/login');
    console.log('   Email: admin');
    console.log('   Password: 11111');
    console.log('   Access: Dashboard + All Admin Features');
    
    console.log('\n👥 CUSTOMER LOGIN (Public Site):');
    console.log('   URL: http://localhost:5173/sign-in');
    console.log('   Email: test@customer.com');
    console.log('   Password: test123');
    console.log('   Access: Shopping, Cart, Wishlist');
    
    console.log('\n🎯 Testing URLs:');
    console.log('   Customer Sign-in: http://localhost:5173/sign-in');
    console.log('   Admin Login: http://localhost:5173/login');
    console.log('   Dashboard: http://localhost:5173/admin');
    console.log('   Homepage: http://localhost:5173/');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  }
}

// Run the script
createTestUsers(); 