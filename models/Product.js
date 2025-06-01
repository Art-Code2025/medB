import mongoose from 'mongoose';

// Schema for product specifications
const specificationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  }
}, { _id: false });

// Main Product Schema - Simplified for Medical Company
const productSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [2000, 'Product description cannot be more than 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative'],
    default: null
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  categoryId: {
    type: Number,
    required: [true, 'Category ID is required'],
    ref: 'Category'
  },
  
  mainImage: {
    type: String,
    trim: true,
    default: ''
  },
  detailedImages: {
    type: [String],
    default: []
  },
  specifications: {
    type: [specificationSchema],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: {
    type: [String],
    default: []
  },
  seoTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'SEO title cannot be more than 60 characters']
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'SEO description cannot be more than 160 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
productSchema.index({ categoryId: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ featured: 1 });
productSchema.index({ name: 'text', description: 'text' });

// Virtual for image URLs
productSchema.virtual('imageUrl').get(function() {
  return this.mainImage ? `/images/${this.mainImage}` : null;
});

// Instance methods
productSchema.methods.isInStock = function() {
  return this.stock > 0;
};

productSchema.methods.reduceStock = function(quantity) {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  this.stock -= quantity;
  return this.save();
};

productSchema.methods.increaseStock = function(quantity) {
  this.stock += quantity;
  return this.save();
};

productSchema.methods.getDiscountPercentage = function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
};

// Pre-save middleware
productSchema.pre('save', function(next) {
  // Ensure originalPrice is higher than current price for discounts
  if (this.originalPrice && this.originalPrice <= this.price) {
    this.originalPrice = null;
  }
  next();
});

// Static methods
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ categoryId, isActive: true });
};

productSchema.statics.findFeatured = function() {
  return this.find({ featured: true, isActive: true });
};

productSchema.statics.searchProducts = function(query) {
  return this.find({
    $text: { $search: query },
    isActive: true
  });
};

const Product = mongoose.model('Product', productSchema);

export default Product; 