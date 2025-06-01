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

// List all users
async function listUsers() {
  try {
    await connectDB();
    
    console.log('📋 Listing all users in database...\n');
    
    const users = await Customer.find({}).select('id email name role status createdAt');
    
    if (users.length === 0) {
      console.log('⚠️ No users found in database');
    } else {
      console.log(`Found ${users.length} user(s):\n`);
      
      users.forEach(user => {
        console.log(`🔹 ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Created: ${user.createdAt}\n`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  }
}

// Run the script
listUsers(); 