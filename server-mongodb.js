import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, getMongoUri } from './config.js';

// Import Models
import Coupon from './models/Coupon.js';
import Customer from './models/Customer.js';
import Cart from './models/Cart.js';
import Wishlist from './models/Wishlist.js';
import Order from './models/Order.js';
import Review from './models/Review.js';
import Category from './models/Category.js';
import Product from './models/Product.js';

// Import Email Service
import { sendOTPEmail, sendWelcomeEmail } from './services/emailService.js';

// محاكاة __dirname في ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:5173', // Development frontend
    'http://localhost:5174', // Another local dev port if needed
    'http://localhost:3000', // Common local dev port
    'https://medicinef.netlify.app',
    'http://medicinef.netlify.app',
    'medicinef.netlify.app',     // Your new Netlify frontend URL
    // إضافة دعم للموبايل والتطبيقات
    'https://medicinef.netlify.app',
    'https://*.netlify.app',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
    // دعم preview URLs من Netlify
    /https:\/\/.*--medicinef\.netlify\.app$/,
    /https:\/\/medicinef--.*\.netlify\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'Pragma',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Access-Control-Allow-Origin'
  ],
  optionsSuccessStatus: 200,
  preflightContinue: false,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));

// إضافة middleware خاص للموبايل
app.use((req, res, next) => {
  // إضافة headers إضافية للموبايل
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH,HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // معالجة preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '50mb' })); // زيادة الحد الأقصى لدعم base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// إضافة timeout middleware
app.use((req, res, next) => {
  // timeout أطول للموبايل
  res.setTimeout(60000, () => {
    console.log('Request timeout for:', req.url);
    res.status(408).json({ 
      message: 'Request timeout',
      error: 'الطلب استغرق وقتاً أطول من المتوقع'
    });
  });
  next();
});

// دالة للتحقق من صحة base64 image
function isValidBase64Image(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return false;
  }
  
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|avif);base64,/;
  return base64Regex.test(base64String);
}

// دالة لضغط وتحسين الصور base64
function optimizeBase64Image(base64String) {
  try {
    // التحقق من أن الصورة صحيحة
    if (!isValidBase64Image(base64String)) {
      throw new Error('Invalid base64 image format');
    }
    
    // يمكن إضافة منطق ضغط هنا إذا لزم الأمر
    return base64String;
  } catch (error) {
    console.error('Error optimizing base64 image:', error);
    return null;
  }
}

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

// ======================
// HEALTH CHECK & DIAGNOSTICS
// ======================
app.get('/api/health', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const dbStats = await mongoose.connection.db.stats();
    
    // معلومات إضافية للتشخيص
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      },
      database: {
        status: mongoStatus,
        name: dbStats.db,
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        indexSize: dbStats.indexSize
      },
      api: {
        baseUrl: req.protocol + '://' + req.get('host'),
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        mobile: /Mobile|Android|iPhone|iPad/.test(req.get('User-Agent') || ''),
        cors: req.get('Origin') ? 'enabled' : 'not-applicable'
      },
      counts: {
        categories: await Category.countDocuments({ isActive: true }),
        products: await Product.countDocuments({ isActive: true }),
        customers: await Customer.countDocuments(),
        orders: await Order.countDocuments(),
        coupons: await Coupon.countDocuments({ isActive: true })
      }
    };
    
    res.json(healthInfo);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API خاص للموبايل لاختبار الاتصال
app.get('/api/mobile-test', async (req, res) => {
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  res.json({
    success: true,
    message: isMobile ? 'Mobile connection successful' : 'Desktop connection successful',
    timestamp: new Date().toISOString(),
    client: {
      userAgent,
      isMobile,
      ip: req.ip || req.connection.remoteAddress,
      origin: req.get('Origin'),
      referer: req.get('Referer')
    },
    server: {
      status: 'running',
      cors: 'enabled',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  });
});

// ======================
// CATEGORIES APIs
// ======================
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    console.error('Error in GET /api/categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const category = await Category.findOne({ id: parseInt(req.params.id), isActive: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    console.error('Error in GET /api/categories/:id:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    console.log('Creating category with data:', req.body);
    
    const { name, description, mainImage } = req.body;
    
    // التحقق من صحة الصورة إذا كانت موجودة
    let optimizedImage = '';
    if (mainImage && isValidBase64Image(mainImage)) {
      optimizedImage = optimizeBase64Image(mainImage);
      if (!optimizedImage) {
        return res.status(400).json({ message: 'صورة غير صحيحة' });
      }
    }
    
    const category = new Category({
      name,
      description: description || '',
      image: optimizedImage
    });

    await category.save();
    console.log('Category created successfully:', category.name);
    res.status(201).json(category);
  } catch (error) {
    console.error('Error in POST /api/categories:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const { name, description, mainImage } = req.body;

    const updateData = {
      name,
      description: description || ''
    };

    // التحقق من صحة الصورة إذا كانت موجودة
    if (mainImage) {
      if (isValidBase64Image(mainImage)) {
        const optimizedImage = optimizeBase64Image(mainImage);
        if (optimizedImage) {
          updateData.image = optimizedImage;
        }
      } else {
        return res.status(400).json({ message: 'صورة غير صحيحة' });
      }
    }

    const category = await Category.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      updateData,
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error in PUT /api/categories/:id:', error);
    res.status(500).json({ message: 'Failed to update category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Check if category has products
    const productCount = await Product.countDocuments({ categoryId, isActive: true });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It has ${productCount} products.` 
      });
    }

    const category = await Category.findOneAndUpdate(
      { id: categoryId },
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/categories/:id:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

// ======================
// PRODUCTS APIs
// ======================
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error in GET /api/products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: parseInt(req.params.id), isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error in GET /api/products/:id:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

app.get('/api/products/category/:categoryId', async (req, res) => {
  try {
    const products = await Product.find({ 
      categoryId: parseInt(req.params.categoryId), 
      isActive: true 
    }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error in GET /api/products/category/:categoryId:', error);
    res.status(500).json({ message: 'Failed to fetch products by category' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    console.log('Creating product with data - name:', req.body.name);
    
    const { 
      name, 
      description, 
      price, 
      originalPrice, 
      stock, 
      categoryId, 
      specifications, 
      productType, 
      dynamicOptions,
      mainImage,
      detailedImages
    } = req.body;

    let parsedSpecifications = [];
    if (specifications) {
      try {
        parsedSpecifications = typeof specifications === 'string' 
          ? JSON.parse(specifications) 
          : specifications;
      } catch (error) {
        console.error('Error parsing specifications:', error);
      }
    }

    let parsedDynamicOptions = [];
    if (dynamicOptions) {
      try {
        parsedDynamicOptions = typeof dynamicOptions === 'string' 
          ? JSON.parse(dynamicOptions) 
          : dynamicOptions;
      } catch (error) {
        console.error('Error parsing dynamic options:', error);
      }
    }

    // معالجة الصورة الرئيسية
    let optimizedMainImage = '';
    if (mainImage && isValidBase64Image(mainImage)) {
      optimizedMainImage = optimizeBase64Image(mainImage);
      if (!optimizedMainImage) {
        return res.status(400).json({ message: 'الصورة الرئيسية غير صحيحة' });
      }
    }

    // معالجة الصور التفصيلية
    let optimizedDetailedImages = [];
    if (detailedImages && Array.isArray(detailedImages)) {
      for (const image of detailedImages) {
        if (isValidBase64Image(image)) {
          const optimized = optimizeBase64Image(image);
          if (optimized) {
            optimizedDetailedImages.push(optimized);
          }
        }
      }
    }

    const product = new Product({
      name,
      description: description || '',
      price: parseFloat(price),
      originalPrice: originalPrice && parseFloat(originalPrice) > 0 ? parseFloat(originalPrice) : null,
      stock: parseInt(stock) || 0,
      categoryId: parseInt(categoryId),
      productType: productType || 'وشاح وكاب',
      dynamicOptions: parsedDynamicOptions,
      mainImage: optimizedMainImage,
      detailedImages: optimizedDetailedImages,
      sizeGuideImage: '',
      specifications: parsedSpecifications
    });

    await product.save();
    console.log('Product created successfully:', product.name);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error in POST /api/products:', error);
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      originalPrice, 
      stock, 
      categoryId, 
      specifications, 
      productType, 
      dynamicOptions,
      mainImage,
      detailedImages
    } = req.body;

    let parsedSpecifications = [];
    if (specifications) {
      try {
        parsedSpecifications = typeof specifications === 'string' 
          ? JSON.parse(specifications) 
          : specifications;
      } catch (error) {
        console.error('Error parsing specifications:', error);
      }
    }

    let parsedDynamicOptions = [];
    if (dynamicOptions) {
      try {
        parsedDynamicOptions = typeof dynamicOptions === 'string' 
          ? JSON.parse(dynamicOptions) 
          : dynamicOptions;
      } catch (error) {
        console.error('Error parsing dynamic options:', error);
      }
    }

    const updateData = {
      name,
      description: description || '',
      price: parseFloat(price),
      originalPrice: originalPrice && parseFloat(originalPrice) > 0 ? parseFloat(originalPrice) : null,
      stock: parseInt(stock) || 0,
      categoryId: parseInt(categoryId),
      productType: productType || 'وشاح وكاب',
      dynamicOptions: parsedDynamicOptions,
      specifications: parsedSpecifications,
      sizeGuideImage: ''
    };

    // معالجة الصورة الرئيسية
    if (mainImage) {
      if (isValidBase64Image(mainImage)) {
        const optimized = optimizeBase64Image(mainImage);
        if (optimized) {
          updateData.mainImage = optimized;
        }
      } else {
        return res.status(400).json({ message: 'الصورة الرئيسية غير صحيحة' });
      }
    }

    // معالجة الصور التفصيلية
    if (detailedImages && Array.isArray(detailedImages)) {
      const optimizedDetailedImages = [];
      for (const image of detailedImages) {
        if (isValidBase64Image(image)) {
          const optimized = optimizeBase64Image(image);
          if (optimized) {
            optimizedDetailedImages.push(optimized);
          }
        }
      }
      updateData.detailedImages = optimizedDetailedImages;
    }

    const product = await Product.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      updateData,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Error in PUT /api/products/:id:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/products/:id:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

// Get default options for product type
app.get('/api/products/default-options/:productType', async (req, res) => {
  try {
    const { productType } = req.params;
    
    const defaultOptions = {
      'وشاح وكاب': [
        {
          optionName: 'nameOnSash',
          optionType: 'text',
          required: true,
          placeholder: 'الاسم على الوشاح (ثنائي أو ثلاثي)',
          validation: { minLength: 2, maxLength: 50 }
        },
        {
          optionName: 'embroideryColor',
          optionType: 'select',
          required: true,
          options: [
            { value: 'ذهبي' },
            { value: 'فضي' },
            { value: 'أسود' },
            { value: 'أبيض' },
            { value: 'أحمر' },
            { value: 'أزرق' }
          ]
        },
        {
          optionName: 'capFabric',
          optionType: 'select',
          required: true,
          options: [
            { value: 'قطن' },
            { value: 'حرير' },
            { value: 'بوليستر' },
            { value: 'صوف' }
          ]
        }
      ],
      'جاكيت': [
        {
          optionName: 'size',
          optionType: 'select',
          required: true,
          options: [
            { value: 'XS' },
            { value: 'S' },
            { value: 'M' },
            { value: 'L' },
            { value: 'XL' },
            { value: '2XL' }
          ]
        }
      ],
      'عباية تخرج': [
        {
          optionName: 'size',
          optionType: 'select',
          required: true,
          options: [
            { value: '48' },
            { value: '50' },
            { value: '52' },
            { value: '54' },
            { value: '56' },
            { value: '58' },
            { value: '60' }
          ]
        },
        {
          optionName: 'nameOnSash',
          optionType: 'text',
          required: false,
          placeholder: 'الاسم على الوشاح (ثنائي أو ثلاثي)',
          validation: { minLength: 2, maxLength: 50 }
        },
        {
          optionName: 'embroideryColor',
          optionType: 'select',
          required: true,
          options: [
            { value: 'ذهبي' },
            { value: 'فضي' },
            { value: 'أسود' },
            { value: 'أبيض' },
            { value: 'أحمر' },
            { value: 'أزرق' }
          ]
        }
      ],
      'مريول مدرسي': [
        {
          optionName: 'size',
          optionType: 'select',
          required: true,
          options: [
            { value: '34' },
            { value: '36' },
            { value: '38' },
            { value: '40' },
            { value: '42' },
            { value: '44' },
            { value: '46' },
            { value: '48' },
            { value: '50' },
            { value: '52' },
            { value: '54' }
          ]
        }
      ],
      'كاب فقط': [
        {
          optionName: 'capColor',
          optionType: 'select',
          required: true,
          options: [
            { value: 'أسود' },
            { value: 'كحلي' },
            { value: 'أبيض' },
            { value: 'رمادي' },
            { value: 'بني' },
            { value: 'عنابي' }
          ]
        },
        {
          optionName: 'embroideryColor',
          optionType: 'select',
          required: true,
          options: [
            { value: 'ذهبي' },
            { value: 'فضي' },
            { value: 'أبيض' },
            { value: 'أسود' },
            { value: 'أحمر' },
            { value: 'أزرق' }
          ]
        },
        {
          optionName: 'dandoshColor',
          optionType: 'select',
          required: true,
          options: [
            { value: 'ذهبي' },
            { value: 'فضي' },
            { value: 'أسود' },
            { value: 'أبيض' },
            { value: 'أحمر' },
            { value: 'أزرق' }
          ]
        }
      ]
    };
    
    const options = defaultOptions[productType] || [];
    res.json(options);
  } catch (error) {
    console.error('Error in GET /api/products/default-options:', error);
    res.status(500).json({ message: 'Failed to get default options' });
  }
});

// ======================
// ORDERS APIs (حقيقية مش وهمية!)
// ======================
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: parseInt(req.params.id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error in GET /api/orders/:id:', error);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});

// إنشاء طلب جديد من السلة
app.post('/api/orders', async (req, res) => {
  try {
    console.log('Creating order with data:', req.body);
    
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      items,
      couponCode,
      paymentMethod,
      notes,
      deliveryFee = 0
    } = req.body;

    // التحقق من الكوبون إن وجد
    let couponDiscount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountResult = coupon.calculateDiscount(subtotal);
        if (!discountResult.error) {
          couponDiscount = discountResult.discount;
          // زيادة عدد مرات الاستخدام
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
    }

    const order = new Order({
      customerName,
      customerEmail,
      customerPhone,
      address,
      city,
      items,
      deliveryFee,
      couponCode: couponCode || '',
      couponDiscount,
      paymentMethod: paymentMethod || 'cash',
      notes: notes || ''
    });

    await order.save();
    
    // إزالة العناصر من السلة بعد إنشاء الطلب
    await Cart.deleteMany({ userId: req.body.userId || 'guest' });
    
    console.log('Order created successfully:', order);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error in POST /api/orders:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

// تحديث حالة الطلب
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = parseInt(req.params.id);
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    order.status = status;
    if (status === 'delivered') {
      order.deliveredAt = new Date();
    }
    
    await order.save();
    res.json(order);
  } catch (error) {
    console.error('Error in PUT /api/orders/:id/status:', error);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// حذف طلب
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    const order = await Order.findOne({ id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'الطلب غير موجود' });
    }
    
    await Order.deleteOne({ id: orderId });
    res.json({ message: 'تم حذف الطلب بنجاح' });
  } catch (error) {
    console.error('Error in DELETE /api/orders/:id:', error);
    res.status(500).json({ message: 'فشل في حذف الطلب' });
  }
});

// إحصائيات الطلبات
app.get('/api/orders/stats', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    res.json({
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    console.error('Error in GET /api/orders/stats:', error);
    res.status(500).json({ message: 'Failed to fetch order stats' });
  }
});

// ======================
// COUPONS APIs
// ======================
app.get('/api/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    console.error('Error in GET /api/coupons:', error);
    res.status(500).json({ message: 'Failed to fetch coupons' });
  }
});

app.get('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOne({ id: parseInt(req.params.id) });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.json(coupon);
  } catch (error) {
    console.error('Error in GET /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to fetch coupon' });
  }
});

// Create coupon without file upload
app.post('/api/coupons', async (req, res) => {
  try {
    console.log('Creating coupon with data:', req.body);
    
    // Auto-generate ID if not provided
    if (!req.body.id) {
      const lastCoupon = await Coupon.findOne().sort({ id: -1 });
      req.body.id = lastCoupon ? lastCoupon.id + 1 : 1;
    }
    
    const coupon = new Coupon(req.body);
    await coupon.save();
    console.log('Coupon created successfully:', coupon);
    res.status(201).json(coupon);
  } catch (error) {
    console.error('Error in POST /api/coupons:', error);
    res.status(500).json({ message: 'Failed to create coupon', error: error.message });
  }
});

app.put('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      req.body,
      { new: true }
    );

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(coupon);
  } catch (error) {
    console.error('Error in PUT /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to update coupon' });
  }
});

app.delete('/api/coupons/:id', async (req, res) => {
  try {
    const coupon = await Coupon.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/coupons/:id:', error);
    res.status(500).json({ message: 'Failed to delete coupon' });
  }
});

// Validate coupon
app.post('/api/coupons/validate', async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.status(404).json({ message: 'كوبون غير صحيح' });
    }

    const result = coupon.calculateDiscount(totalAmount);
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    res.json({
      coupon: coupon,
      discountAmount: result.discount
    });
  } catch (error) {
    console.error('Error in POST /api/coupons/validate:', error);
    res.status(500).json({ message: 'Failed to validate coupon' });
  }
});

// ======================
// CART APIs
// ======================
app.get('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const items = await Cart.find({ userId }).sort({ createdAt: -1 });
    
    // إضافة بيانات المنتج لكل عنصر
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},  // إضافة المواصفات المختارة
        optionsPricing: item.optionsPricing || {},    // إضافة أسعار الخيارات
        attachments: item.attachments || {},          // إضافة المرفقات
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          detailedImages: product.detailedImages || [],
          stock: product.stock,
          productType: product.productType,
          dynamicOptions: product.dynamicOptions || [],
          specifications: product.specifications || [],
          sizeGuideImage: product.sizeGuideImage
        } : null
      };
    }));
    
    res.json(itemsWithProducts);
  } catch (error) {
    console.error('Error in GET /api/cart:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

app.post('/api/cart', async (req, res) => {
  try {
    const { userId = 'guest', productId, productName, price, quantity = 1, image = '', selectedOptions = {}, optionsPricing = {}, attachments = {} } = req.body;
    
    console.log('🛒 ADD TO GUEST CART REQUEST:', {
      userId,
      productId,
      productIdType: typeof productId,
      quantity,
      selectedOptions,
      requestBody: req.body
    });
    
    // التحقق من المنتج بطرق متعددة
    let product = null;
    
    // جرب البحث بـ id أولاً
    if (Number.isInteger(productId) || !isNaN(Number(productId))) {
      product = await Product.findOne({ id: parseInt(productId) });
      console.log('🔍 Guest cart - Product search by ID:', { productId: parseInt(productId), found: !!product });
    }
    
    // إذا مالقاهوش، جرب البحث بـ _id كـ fallback
    if (!product) {
      try {
        product = await Product.findById(productId);
        console.log('🔍 Guest cart - Product search by _id:', { productId, found: !!product });
      } catch (error) {
        console.log('⚠️ Guest cart - Invalid ObjectId format:', productId);
      }
    }
    
    // إذا لسه مالقاهوش، جرب البحث في كل المنتجات
    if (!product) {
      const allProducts = await Product.find({});
      console.log('📦 Guest cart - All products in database:', allProducts.map(p => ({ id: p.id, _id: p._id, name: p.name })));
      
      // جرب تطابق النصوص
      product = allProducts.find(p => p.id === productId || p._id.toString() === productId.toString());
      console.log('🔍 Guest cart - Product search in all products:', { found: !!product });
    }
    
    if (!product) {
      console.error('❌ Guest cart - Product not found after all search attempts:', { productId });
      return res.status(404).json({ 
        message: 'المنتج غير موجود',
        debug: {
          searchedId: productId,
          searchedIdType: typeof productId,
          searchedAsNumber: parseInt(productId),
          isNaN: isNaN(Number(productId))
        }
      });
    }
    
    console.log('✅ Guest cart - Product found:', {
      productId: product.id,
      productName: product.name,
      productDbId: product._id
    });
    
    // Check if item already exists with same options
    const existingItem = await Cart.findOne({ 
      userId, 
      productId: product.id,
      selectedOptions: selectedOptions 
    });
    
    if (existingItem) {
      existingItem.quantity += quantity;
      // تحديث المرفقات إذا كانت موجودة
      if (attachments && (attachments.text || attachments.images?.length > 0)) {
        existingItem.attachments = attachments;
      }
      await existingItem.save();
      console.log('✅ Guest cart - Updated existing cart item:', existingItem);
      return res.json(existingItem);
    }

    const cartItem = new Cart({
      userId,
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      image: product.mainImage,
      selectedOptions: selectedOptions || {},
      optionsPricing: optionsPricing || {},
      attachments: attachments || {}
    });

    await cartItem.save();
    console.log('✅ Guest cart - Created new cart item:', cartItem);
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('❌ Error in POST /api/cart:', error);
    res.status(500).json({ message: 'Failed to add to cart', error: error.message });
  }
});

app.put('/api/cart/:id', async (req, res) => {
  try {
    const { quantity } = req.body;
    const item = await Cart.findOneAndUpdate(
      { id: parseInt(req.params.id) },
      { quantity: parseInt(quantity) },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error in PUT /api/cart/:id:', error);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
});

app.delete('/api/cart/:id', async (req, res) => {
  try {
    const item = await Cart.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/cart/:id:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Clear cart
app.delete('/api/cart', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    await Cart.deleteMany({ userId });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/cart:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

// ======================
// WISHLIST APIs
// ======================
app.get('/api/wishlist', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const items = await Wishlist.find({ userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    console.error('Error in GET /api/wishlist:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

app.post('/api/wishlist', async (req, res) => {
  try {
    const { userId = 'guest', productId, productName, price, image = '' } = req.body;
    
    // Check if item already exists
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(400).json({ message: 'المنتج موجود بالفعل في المفضلة' });
    }

    const wishlistItem = new Wishlist({
      userId,
      productId,
      productName,
      price,
      image
    });

    await wishlistItem.save();
    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error('Error in POST /api/wishlist:', error);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

app.delete('/api/wishlist/:id', async (req, res) => {
  try {
    const item = await Wishlist.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!item) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error in DELETE /api/wishlist/:id:', error);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// Check if product is in wishlist
app.get('/api/wishlist/check/:productId', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const productId = parseInt(req.params.productId);
    
    const item = await Wishlist.findOne({ userId, productId });
    res.json({ inWishlist: !!item });
  } catch (error) {
    console.error('Error in GET /api/wishlist/check/:productId:', error);
    res.status(500).json({ message: 'Failed to check wishlist' });
  }
});

// ======================
// CUSTOMERS APIs
// ======================
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await Customer.find({ status: 'active' }).sort({ createdAt: -1 });
    
    // Add cart and wishlist stats
    const customersWithStats = await Promise.all(customers.map(async (customer) => {
      const cartItemsCount = await Cart.countDocuments({ userId: customer.id.toString() });
      const wishlistItemsCount = await Wishlist.countDocuments({ userId: customer.id.toString() });
      
      return {
        ...customer.toObject(),
        cartItemsCount,
        wishlistItemsCount,
        hasCart: cartItemsCount > 0,
        hasWishlist: wishlistItemsCount > 0
      };
    }));

    res.json(customersWithStats);
  } catch (error) {
    console.error('Error in GET /api/customers:', error);
    res.status(500).json({ message: 'Failed to fetch customers' });
  }
});

// Customer stats endpoint
app.get('/api/customers/stats', async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments({ status: 'active' });
    const activeCustomers = await Customer.countDocuments({ status: 'active' });
    const totalCartItems = await Cart.countDocuments();
    const totalWishlistItems = await Wishlist.countDocuments();
    
    // Calculate averages
    const avgCartItems = totalCustomers > 0 ? (totalCartItems / totalCustomers).toFixed(1) : 0;
    const avgWishlistItems = totalCustomers > 0 ? (totalWishlistItems / totalCustomers).toFixed(1) : 0;

    res.json({
      totalCustomers,
      activeCustomers,
      totalCartItems,
      totalWishlistItems,
      avgCartItems: parseFloat(avgCartItems),
      avgWishlistItems: parseFloat(avgWishlistItems)
    });
  } catch (error) {
    console.error('Error in GET /api/customers/stats:', error);
    res.status(500).json({ message: 'Failed to fetch customer stats' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error in POST /api/customers:', error);
    res.status(500).json({ message: 'Failed to create customer' });
  }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    
    // حذف العميل من قاعدة البيانات
    const result = await Customer.deleteOne({ id: customerId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }
    
    // حذف السلة وقائمة الأمنيات المرتبطة بالعميل
    await Cart.deleteMany({ userId: customerId });
    await Wishlist.deleteMany({ userId: customerId });
    
    console.log(`✅ Customer ${customerId} deleted successfully`);
    res.json({ message: 'تم حذف العميل بنجاح' });
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    res.status(500).json({ error: 'فشل في حذف العميل' });
  }
});

// ======================
// REVIEWS APIs
// ======================

// Get reviews for a product
app.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const reviews = await Review.find({ productId }).sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error in GET /api/products/:productId/reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Add a review
app.post('/api/products/:productId/reviews', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const { customerId, customerName, comment } = req.body;
    
    if (!customerId || !customerName || !comment) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }
    
    const review = new Review({
      productId,
      customerId,
      customerName,
      comment
    });
    
    await review.save();
    res.status(201).json({ 
      message: 'تم إضافة تعليقك بنجاح!',
      review 
    });
  } catch (error) {
    console.error('Error in POST /api/products/:productId/reviews:', error);
    res.status(500).json({ message: 'Failed to add review' });
  }
});

// Get all reviews (for admin)
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error('Error in GET /api/reviews:', error);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Delete review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    
    const review = await Review.findOneAndDelete({ id: reviewId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/reviews/:id:', error);
    res.status(500).json({ message: 'Failed to delete review' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const categoriesCount = await Category.countDocuments({ isActive: true });
    const productsCount = await Product.countDocuments({ isActive: true });
    const couponsCount = await Coupon.countDocuments({ isActive: true });
    const cartItemsCount = await Cart.countDocuments();
    const wishlistItemsCount = await Wishlist.countDocuments();
    const customersCount = await Customer.countDocuments({ status: 'active' });
    const ordersCount = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const reviewsCount = await Review.countDocuments();
    
    res.json({
      status: 'healthy',
      database: 'MongoDB',
      categories: categoriesCount,
      products: productsCount,
      coupons: couponsCount,
      cartItems: cartItemsCount,
      wishlistItems: wishlistItemsCount,
      customers: customersCount,
      orders: ordersCount,
      pendingOrders: pendingOrders,
      reviews: reviewsCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// ======================
// AUTH APIs (للفرونت إند)
// ======================

// تسجيل دخول بـ email و password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // التحقق من وجود البيانات
    if (!email || !password) {
      return res.status(400).json({ message: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور' });
    }

    // البحث عن المستخدم
    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // التحقق من كلمة المرور
    const isPasswordValid = await customer.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    // إرجاع بيانات المستخدم (بدون كلمة المرور)
    const userResponse = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      city: customer.city,
      role: customer.role,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      status: customer.status
    };

    res.json({ 
      message: 'تم تسجيل الدخول بنجاح', 
      user: userResponse,
      isAdmin: customer.role === 'admin'
    });
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    res.status(500).json({ message: 'خطأ في الخادم. حاول مرة أخرى' });
  }
});

// تسجيل حساب جديد
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, city } = req.body;

    // التحقق من وجود البيانات المطلوبة
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'الرجاء إدخال جميع البيانات المطلوبة' });
    }

    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    // التحقق من وجود المستخدم مسبقاً
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
    if (existingCustomer) {
      return res.status(409).json({ message: 'يوجد حساب مسجل بهذا البريد الإلكتروني مسبقاً' });
    }

    // إنشاء المستخدم الجديد
    const newCustomer = new Customer({
      email: email.toLowerCase(),
      password,
      name,
      phone: phone || '',
      city: city || '',
      role: 'customer'
    });

    await newCustomer.save();

    // إرجاع بيانات المستخدم (بدون كلمة المرور)
    const userResponse = {
      id: newCustomer.id,
      email: newCustomer.email,
      name: newCustomer.name,
      phone: newCustomer.phone,
      city: newCustomer.city,
      role: newCustomer.role,
      totalOrders: newCustomer.totalOrders,
      totalSpent: newCustomer.totalSpent,
      status: newCustomer.status
    };

    res.status(201).json({ 
      message: 'تم إنشاء الحساب بنجاح', 
      user: userResponse 
    });
  } catch (error) {
    console.error('Error in POST /api/auth/register:', error);
    res.status(500).json({ message: 'خطأ في الخادم. حاول مرة أخرى' });
  }
});

// تغيير كلمة المرور
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ message: 'الرجاء إدخال جميع البيانات المطلوبة' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });
    if (!customer) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const isCurrentPasswordValid = await customer.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    }

    await customer.updatePassword(newPassword);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('Error in POST /api/auth/change-password:', error);
    res.status(500).json({ message: 'خطأ في الخادم. حاول مرة أخرى' });
  }
});

// ======================
// USER-SPECIFIC APIs (للتوافق مع الفرونت إند)
// ======================

// Get user's cart
app.get('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    const items = await Cart.find({ userId }).sort({ createdAt: -1 });
    
    // إضافة بيانات المنتج لكل عنصر
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions || {},  // إضافة المواصفات المختارة
        optionsPricing: item.optionsPricing || {},    // إضافة أسعار الخيارات
        attachments: item.attachments || {},          // إضافة المرفقات
        product: product ? {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          detailedImages: product.detailedImages || [],
          stock: product.stock,
          productType: product.productType,
          dynamicOptions: product.dynamicOptions || [],
          specifications: product.specifications || [],
          sizeGuideImage: product.sizeGuideImage
        } : null
      };
    }));
    
    res.json(itemsWithProducts);
  } catch (error) {
    console.error('Error in GET /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

// Add to user's cart
app.post('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId, quantity = 1, selectedOptions = {}, optionsPricing = {}, attachments = {} } = req.body;
    
    console.log('🛒 ADD TO CART REQUEST:', {
      userId,
      productId,
      productIdType: typeof productId,
      quantity,
      selectedOptions,
      requestBody: req.body
    });
    
    // التحقق من المنتج بطرق متعددة
    let product = null;
    
    // جرب البحث بـ id أولاً
    if (Number.isInteger(productId) || !isNaN(Number(productId))) {
      product = await Product.findOne({ id: parseInt(productId) });
      console.log('🔍 Product search by ID:', { productId: parseInt(productId), found: !!product });
    }
    
    // إذا مالقاهوش، جرب البحث بـ _id كـ fallback
    if (!product) {
      try {
        product = await Product.findById(productId);
        console.log('🔍 Product search by _id:', { productId, found: !!product });
      } catch (error) {
        console.log('⚠️ Invalid ObjectId format:', productId);
      }
    }
    
    // إذا لسه مالقاهوش، جرب البحث في كل المنتجات
    if (!product) {
      const allProducts = await Product.find({});
      console.log('📦 All products in database:', allProducts.map(p => ({ id: p.id, _id: p._id, name: p.name })));
      
      // جرب تطابق النصوص
      product = allProducts.find(p => p.id === productId || p._id.toString() === productId.toString());
      console.log('🔍 Product search in all products:', { found: !!product });
    }
    
    if (!product) {
      console.error('❌ Product not found after all search attempts:', { productId });
      return res.status(404).json({ 
        message: 'المنتج غير موجود',
        debug: {
          searchedId: productId,
          searchedIdType: typeof productId,
          searchedAsNumber: parseInt(productId),
          isNaN: isNaN(Number(productId))
        }
      });
    }
    
    console.log('✅ Product found:', {
      productId: product.id,
      productName: product.name,
      productDbId: product._id
    });
    
    // التحقق من وجود العنصر في السلة مع نفس الخيارات
    const existingItem = await Cart.findOne({ 
      userId, 
      productId: product.id, // استخدم product.id المؤكد
      selectedOptions: selectedOptions 
    });
    
    if (existingItem) {
      existingItem.quantity += quantity;
      // تحديث المرفقات إذا كانت موجودة
      if (attachments && (attachments.text || attachments.images?.length > 0)) {
        existingItem.attachments = attachments;
      }
      await existingItem.save();
      console.log('✅ Updated existing cart item:', existingItem);
      return res.json(existingItem);
    }

    const cartItem = new Cart({
      userId,
      productId: product.id, // استخدم product.id المؤكد
      productName: product.name,
      price: product.price,
      quantity,
      image: product.mainImage,
      selectedOptions: selectedOptions || {},
      optionsPricing: optionsPricing || {},
      attachments: attachments || {}
    });

    await cartItem.save();
    console.log('✅ Created new cart item:', cartItem);
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('❌ Error in POST /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to add to cart', error: error.message });
  }
});

// Update cart item quantity
app.put('/api/user/:userId/cart/:itemId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const itemId = parseInt(req.params.itemId);
    const { quantity, selectedOptions, optionsPricing, attachments, productId } = req.body;
    
    console.log(`🔄 Updating cart item ${itemId} for user ${userId}`);
    console.log('📦 Request body:', { quantity, selectedOptions, optionsPricing, attachments, productId });
    
    // تحضير البيانات للتحديث
    const updateData = {};
    
    if (quantity !== undefined) {
      if (quantity < 1) {
        return res.status(400).json({ message: 'Invalid quantity' });
      }
      updateData.quantity = quantity;
      console.log(`📊 Updating quantity to: ${quantity}`);
    }
    
    if (selectedOptions !== undefined) {
      updateData.selectedOptions = selectedOptions;
      console.log(`🎯 Updating selectedOptions:`, selectedOptions);
    }
    
    if (optionsPricing !== undefined) {
      updateData.optionsPricing = optionsPricing;
      console.log(`💰 Updating optionsPricing:`, optionsPricing);
    }
    
    if (attachments !== undefined) {
      updateData.attachments = attachments;
      console.log(`📎 Updating attachments:`, attachments);
    }
    
    if (productId !== undefined) {
      updateData.productId = productId;
      console.log(`🏷️ Updating productId to: ${productId}`);
    }
    
    // Try to find by id (number) first
    let item = await Cart.findOneAndUpdate(
      { id: itemId, userId },
      updateData,
      { new: true }
    );
    
    // If not found, try by _id (ObjectId) as fallback
    if (!item) {
      console.log(`🔄 Item not found by id, trying _id for item ${itemId}`);
      try {
        item = await Cart.findOneAndUpdate(
          { _id: itemId, userId },
          updateData,
          { new: true }
        );
      } catch (err) {
        console.log(`❌ Invalid ObjectId format: ${itemId}`);
      }
    }

    if (!item) {
      console.log(`❌ Cart item ${itemId} not found for user ${userId}`);
      return res.status(404).json({ message: 'Cart item not found' });
    }

    console.log(`✅ Cart item ${itemId} updated successfully for user ${userId}`);
    console.log(`✅ Final item state:`, {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
      optionsPricing: item.optionsPricing,
      attachments: item.attachments
    });
    
    res.json({ 
      message: 'Cart item updated successfully', 
      item: {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        selectedOptions: item.selectedOptions,
        optionsPricing: item.optionsPricing,
        attachments: item.attachments
      }
    });
  } catch (error) {
    console.error('Error in PUT /api/user/:userId/cart/:itemId:', error);
    res.status(500).json({ message: 'Failed to update cart item' });
  }
});

// Remove product from cart by productId
app.delete('/api/user/:userId/cart/product/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    const item = await Cart.findOneAndDelete({ userId, productId });

    if (!item) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart/product/:productId:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Remove cart item by itemId
app.delete('/api/user/:userId/cart/:itemId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const itemId = parseInt(req.params.itemId);
    
    console.log(`🗑️ DELETE REQUEST RECEIVED`);
    console.log(`🗑️ User ID: ${userId} (type: ${typeof userId})`);
    console.log(`🗑️ Item ID: ${itemId} (type: ${typeof itemId})`);
    console.log(`🗑️ Raw Item ID from params: ${req.params.itemId}`);
    console.log(`🗑️ Request headers:`, req.headers);
    console.log(`🗑️ Attempting to delete cart item ${itemId} for user ${userId}`);
    
    // Try to find by id (number) first
    let item = await Cart.findOneAndDelete({ id: itemId, userId });
    
    // If not found, try by _id (ObjectId) as fallback
    if (!item) {
      console.log(`🔄 Item not found by id, trying _id for item ${itemId}`);
      try {
        item = await Cart.findOneAndDelete({ _id: itemId, userId });
      } catch (err) {
        console.log(`❌ Invalid ObjectId format: ${itemId}`);
      }
    }

    if (!item) {
      console.log(`❌ Cart item ${itemId} not found for user ${userId}`);
      return res.status(404).json({ message: 'Cart item not found' });
    }

    console.log(`✅ Cart item ${itemId} deleted successfully for user ${userId}`);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart/:itemId:', error);
    res.status(500).json({ message: 'Failed to remove from cart' });
  }
});

// Clear user's cart
app.delete('/api/user/:userId/cart', async (req, res) => {
  try {
    const userId = req.params.userId;
    await Cart.deleteMany({ userId });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/cart:', error);
    res.status(500).json({ message: 'Failed to clear cart' });
  }
});

// Get user's wishlist
app.get('/api/user/:userId/wishlist', async (req, res) => {
  try {
    const userId = req.params.userId;
    const items = await Wishlist.find({ userId }).sort({ createdAt: -1 });
    
    // إضافة بيانات المنتج لكل عنصر
    const itemsWithProducts = await Promise.all(items.map(async (item) => {
      const product = await Product.findOne({ id: item.productId });
      return {
        id: item.id,
        productId: item.productId,
        userId: item.userId,
        addedAt: item.createdAt,
        product: product ? {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          mainImage: product.mainImage,
          stock: product.stock
        } : null
      };
    }));
    
    res.json(itemsWithProducts);
  } catch (error) {
    console.error('Error in GET /api/user/:userId/wishlist:', error);
    res.status(500).json({ message: 'Failed to fetch wishlist' });
  }
});

// Add to wishlist
app.post('/api/user/:userId/wishlist', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId } = req.body;
    
    // الحصول على بيانات المنتج
    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ message: 'المنتج غير موجود' });
    }
    
    // التحقق من وجود العنصر في قائمة الأمنيات
    const existingItem = await Wishlist.findOne({ userId, productId });
    if (existingItem) {
      return res.status(400).json({ message: 'المنتج موجود بالفعل في المفضلة' });
    }

    const wishlistItem = new Wishlist({
      userId,
      productId,
      productName: product.name,
      price: product.price,
      image: product.mainImage
    });

    await wishlistItem.save();
    res.status(201).json(wishlistItem);
  } catch (error) {
    console.error('Error in POST /api/user/:userId/wishlist:', error);
    res.status(500).json({ message: 'Failed to add to wishlist' });
  }
});

// Remove from wishlist
app.delete('/api/user/:userId/wishlist/product/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    const item = await Wishlist.findOneAndDelete({ userId, productId });

    if (!item) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Error in DELETE /api/user/:userId/wishlist/product/:productId:', error);
    res.status(500).json({ message: 'Failed to remove from wishlist' });
  }
});

// Check if product is in user's wishlist
app.get('/api/user/:userId/wishlist/check/:productId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const productId = parseInt(req.params.productId);
    
    const item = await Wishlist.findOne({ userId, productId });
    res.json({ isInWishlist: !!item });
  } catch (error) {
    console.error('Error in GET /api/user/:userId/wishlist/check/:productId:', error);
    res.status(500).json({ message: 'Failed to check wishlist' });
  }
});

// Upload attachment images
app.post('/api/upload-attachments', async (req, res) => {
  try {
    if (!req.body.images || !req.body.images.length) {
      return res.status(400).json({ message: 'No images uploaded' });
    }

    const optimizedImages = req.body.images.map(image => ({
      ...image,
      optimizedImage: optimizeBase64Image(image.base64Image)
    }));

    res.json({ 
      message: 'Images uploaded successfully',
      images: optimizedImages
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ message: 'Failed to upload images' });
  }
});

// Checkout endpoint
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, customerInfo, paymentMethod, total, subtotal, deliveryFee, couponDiscount, appliedCoupon, paymentId, paymentStatus, userId, isGuestOrder } = req.body;
    
    console.log('Creating order with data:', {
      customerInfo,
      itemsCount: items.length,
      total,
      subtotal,
      deliveryFee,
      couponDiscount,
      paymentMethod,
      paymentStatus,
      userId,
      isGuestOrder
    });
    
    // تحضير عناصر الطلب - البيانات جاهزة من الفرونت إند
    const orderItems = items.map(item => ({
      productId: item.productId,
      productName: item.productName || 'منتج غير معروف',
      price: item.price || 0,
      quantity: item.quantity || 1,
      totalPrice: item.totalPrice || (item.price * item.quantity),
      selectedOptions: item.selectedOptions || {},
      optionsPricing: item.optionsPricing || {},
      productImage: item.productImage || '',
      attachments: item.attachments || {}
    }));

    // استخدام القيم المحسوبة من الفرونت إند أو حساب قيم احتياطية
    const orderSubtotal = subtotal || orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const orderDeliveryFee = deliveryFee || 0;
    const orderCouponDiscount = couponDiscount || 0;
    const orderTotal = total || (orderSubtotal + orderDeliveryFee - orderCouponDiscount);

    // معلومات الكوبون
    let couponCode = '';
    if (appliedCoupon && appliedCoupon.code) {
      couponCode = appliedCoupon.code;
      // يمكن إضافة التحقق من الكوبون هنا إذا لزم الأمر
    }

    const order = new Order({
      customerName: customerInfo.name,
      customerEmail: customerInfo.email || '',
      customerPhone: customerInfo.phone || '',
      address: customerInfo.address,
      city: customerInfo.city,
      items: orderItems,
      subtotal: orderSubtotal,
      deliveryFee: orderDeliveryFee,
      total: orderTotal,
      couponCode,
      couponDiscount: orderCouponDiscount,
      paymentMethod: paymentMethod || 'cod',
      paymentStatus: paymentStatus || 'pending',
      notes: customerInfo.notes || '',
      userId: userId || 'guest', // Support both guest and authenticated users
      isGuestOrder: isGuestOrder !== undefined ? isGuestOrder : (userId === 'guest' || !userId) // Determine if it's a guest order
    });

    // إضافة معرف الدفع إذا كان متوفراً
    if (paymentId) {
      order.paymentId = paymentId;
    }

    await order.save();
    
    console.log('Order created successfully:', {
      orderId: order.id,
      customerName: order.customerName,
      isGuestOrder: order.isGuestOrder,
      userId: order.userId
    });
    
    res.status(201).json({ 
      message: 'تم إرسال طلبك بنجاح!',
      orderId: order.id,
      order: {
        id: order.id,
        customerName: order.customerName,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate,
        isGuestOrder: order.isGuestOrder,
        userId: order.userId
      }
    });
  } catch (error) {
    console.error('Error in POST /api/checkout:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

// Update cart item options (alternative endpoint for options-only updates)
app.put('/api/user/:userId/cart/update-options', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId, selectedOptions, attachments } = req.body;
    
    console.log(`🔄 Updating cart options for user ${userId}, product ${productId}`);
    console.log('📝 New options:', selectedOptions);
    console.log('📎 New attachments:', attachments);
    
    // العثور على العنصر في السلة
    const cartItem = await Cart.findOne({ userId, productId });
    if (!cartItem) {
      return res.status(404).json({ message: 'المنتج غير موجود في السلة' });
    }
    
    // تحديث الخيارات والمرفقات
    if (selectedOptions !== undefined) {
      cartItem.selectedOptions = selectedOptions;
    }
    if (attachments !== undefined) {
      cartItem.attachments = attachments;
    }
    
    await cartItem.save();
    
    console.log('✅ Cart options updated successfully');
    console.log('✅ Final cart item:', {
      id: cartItem.id,
      productId: cartItem.productId,
      selectedOptions: cartItem.selectedOptions,
      attachments: cartItem.attachments
    });
    
    res.json({ 
      message: 'تم تحديث خيارات المنتج بنجاح',
      cartItem: {
        id: cartItem.id,
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        selectedOptions: cartItem.selectedOptions,
        optionsPricing: cartItem.optionsPricing,
        attachments: cartItem.attachments
      }
    });
  } catch (error) {
    console.error('❌ Error updating cart options:', error);
    res.status(500).json({ message: 'فشل في تحديث خيارات المنتج' });
  }
});

// Cart Migration - Move guest cart to authenticated user
app.post('/api/migrate-cart', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId || userId === 'guest') {
      return res.status(400).json({ message: 'Valid user ID is required' });
    }

    console.log(`🔄 [Cart Migration] Starting cart migration for user: ${userId}`);
    
    // Get guest cart items
    const guestCartItems = await Cart.find({ userId: 'guest' });
    console.log(`📦 [Cart Migration] Found ${guestCartItems.length} guest cart items`);
    
    if (guestCartItems.length === 0) {
      return res.json({ 
        message: 'No guest cart items to migrate',
        migratedCount: 0 
      });
    }

    let migratedCount = 0;
    let mergedCount = 0;

    for (const guestItem of guestCartItems) {
      try {
        // Check if user already has this product with same options
        const existingUserItem = await Cart.findOne({
          userId: userId,
          productId: guestItem.productId,
          selectedOptions: guestItem.selectedOptions || {}
        });

        if (existingUserItem) {
          // Merge quantities if item exists
          existingUserItem.quantity += guestItem.quantity;
          
          // Update attachments if guest has newer ones
          if (guestItem.attachments && (guestItem.attachments.text || guestItem.attachments.images?.length > 0)) {
            existingUserItem.attachments = guestItem.attachments;
          }
          
          await existingUserItem.save();
          mergedCount++;
          console.log(`🔄 [Cart Migration] Merged item ${guestItem.productId} with existing user item`);
        } else {
          // Create new item for user
          const newUserItem = new Cart({
            userId: userId,
            productId: guestItem.productId,
            productName: guestItem.productName,
            price: guestItem.price,
            quantity: guestItem.quantity,
            image: guestItem.image,
            selectedOptions: guestItem.selectedOptions || {},
            optionsPricing: guestItem.optionsPricing || {},
            attachments: guestItem.attachments || {}
          });
          
          await newUserItem.save();
          migratedCount++;
          console.log(`✅ [Cart Migration] Migrated item ${guestItem.productId} to user cart`);
        }

        // Delete the guest item
        await Cart.deleteOne({ _id: guestItem._id });
        
      } catch (itemError) {
        console.error(`❌ [Cart Migration] Error migrating item ${guestItem.productId}:`, itemError);
      }
    }

    console.log(`✅ [Cart Migration] Completed: ${migratedCount} new items, ${mergedCount} merged items`);
    
    res.json({
      message: 'Cart migration completed successfully',
      migratedCount: migratedCount,
      mergedCount: mergedCount,
      totalProcessed: migratedCount + mergedCount
    });

  } catch (error) {
    console.error('❌ [Cart Migration] Error:', error);
    res.status(500).json({ 
      message: 'Failed to migrate cart',
      error: error.message 
    });
  }
});

// ======================
// ORIGINAL APIs (تم الاحتفاظ بها للتوافق مع الداش بورد)
// ======================

// Start server
async function startServer() {
  await connectDB();
  
  app.listen(port, () => {
    console.log('🚀 Mawasiem Server with MongoDB is running!');
    console.log(`📍 Server: http://localhost:${port}`);
    console.log(`🗄️  Database: MongoDB`);
    console.log(`🔍 Health Check: http://localhost:${port}/api/health`);
    console.log(`🎯 Frontend: Remember to run 'cd frontend && npm run dev'`);
  });
}

startServer().catch(console.error);