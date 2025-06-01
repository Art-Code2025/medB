import mongoose from 'mongoose';

// Professional Category Schema for Medical Company
const categorySchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Category description is required'],
    trim: true,
    maxlength: [500, 'Category description cannot exceed 500 characters']
  },
  image: {
    type: String,
    required: [true, 'Category image is required'],
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  // SEO fields
  seoTitle: {
    type: String,
    trim: true,
    maxlength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    trim: true,
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ slug: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Virtual for image URL
categorySchema.virtual('imageUrl').get(function() {
  return this.image ? `/images/${this.image}` : null;
});

// Virtual to get products count
categorySchema.virtual('productsCount', {
  ref: 'Product',
  localField: 'id',
  foreignField: 'categoryId',
  count: true
});

// Instance methods
categorySchema.methods.getActiveProducts = function() {
  return mongoose.model('Product').find({ 
    categoryId: this.id, 
    isActive: true 
  });
};

// Static methods
categorySchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1, name: 1 });
};

categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isActive: true });
};

// Pre-save middleware
categorySchema.pre('save', function(next) {
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ى]/g, 'ي')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Auto-generate SEO fields if not provided
  if (!this.seoTitle && this.name) {
    this.seoTitle = this.name.substring(0, 60);
  }
  
  if (!this.seoDescription && this.description) {
    this.seoDescription = this.description.substring(0, 160);
  }
  
  next();
});

// Auto-generate unique ID for new categories
categorySchema.pre('save', async function(next) {
  if (this.isNew && !this.id) {
    const lastCategory = await this.constructor.findOne().sort({ id: -1 });
    this.id = lastCategory ? lastCategory.id + 1 : 1;
  }
  next();
});

const Category = mongoose.model('Category', categorySchema);

export default Category; 