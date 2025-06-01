import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const customerSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, // كلمة المرور المُشفرة
  phone: { type: String, default: '' },
  name: { type: String, required: true },
  city: { type: String, default: '' },
  
  // إحصائيات بسيطة
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  lastOrderDate: { type: Date },
  
  // حالة بسيطة
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  
  // أدوار المستخدم
  role: {
    type: String,
    enum: ['customer', 'admin'],
    default: 'customer'
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Auto-increment ID
customerSchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    const lastCustomer = await this.constructor.findOne().sort({ id: -1 });
    this.id = lastCustomer ? lastCustomer.id + 1 : 1;
  }
  
  // تشفير كلمة المرور قبل الحفظ
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  next();
});

// مقارنة كلمة المرور
customerSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// تحديث كلمة المرور
customerSchema.methods.updatePassword = async function(newPassword) {
  this.password = newPassword;
  await this.save();
};

const Customer = mongoose.model('Customer', customerSchema);

export default Customer; 