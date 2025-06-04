import mongoose from 'mongoose';
import Product from './models/Product.js';

mongoose.connect('mongodb://localhost:27017/medicine').then(async () => {
  console.log('✅ متصل بقاعدة بيانات medicine');
  
  // إضافة بعض المنتجات الأساسية
  const products = [
    {
      id: 1,
      name: 'عباية تخرج كلاسيكية',
      description: 'عباية تخرج أنيقة للحفلات',
      price: 250,
      originalPrice: 300,
      stock: 10,
      categoryId: 1,
      mainImage: '/images/graduation-gown-1.jpg',
      detailedImages: [],
      productType: 'عباية تخرج',
      dynamicOptions: [],
      specifications: []
    },
    {
      id: 17,
      name: 'كرسي اطفال',
      description: 'كرسي مريح للأطفال',
      price: 350,
      originalPrice: 500,
      stock: 25,
      categoryId: 2,
      mainImage: '/images/1745961297959-668757027.avif',
      detailedImages: [],
      productType: 'وشاح وكاب',
      dynamicOptions: [],
      specifications: []
    },
    {
      id: 6,
      name: 'سماعه طبيه',
      description: 'سماعة طبية عالية الجودة',
      price: 180,
      originalPrice: 220,
      stock: 15,
      categoryId: 3,
      mainImage: '/images/1745961297959-668757027.avif',
      detailedImages: [],
      productType: 'معدات طبية',
      dynamicOptions: [],
      specifications: []
    }
  ];
  
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log('✅ تم إضافة', products.length, 'منتج إلى قاعدة بيانات medicine');
  
  // إضافة منتج للسلة
  const CartItem = mongoose.model('CartItem', new mongoose.Schema({}, {strict: false}));
  await CartItem.deleteMany({});
  
  const cartItem = new CartItem({
    id: 1,
    userId: 'guest',
    productId: 17,
    quantity: 1,
    selectedOptions: {},
    optionsPricing: {},
    attachments: {}
  });
  
  await cartItem.save();
  console.log('✅ تم إضافة منتج للسلة');
  
  console.log('🎉 تم إعداد قاعدة بيانات medicine بنجاح!');
  process.exit(0);
}).catch(err => {
  console.error('❌ خطأ:', err);
  process.exit(1);
}); 