import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, getMongoUri } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Product Schema
const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true },
  mainImage: String,
  detailedImages: [String],
  isActive: { type: Boolean, default: true }
});

const Product = mongoose.model('Product', productSchema);

// دالة لإنشاء صورة placeholder بسيطة
function createPlaceholderImage(imagePath, productName) {
  const svgContent = `
    <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#F3F4F6"/>
      <rect x="150" y="150" width="100" height="100" rx="8" fill="#D1D5DB"/>
      <text x="200" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6B7280">
        ${productName.substring(0, 20)}
      </text>
      <text x="200" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#9CA3AF">
        صورة غير متوفرة
      </text>
    </svg>
  `;
  
  // تحويل SVG إلى base64 وحفظه كملف PNG placeholder
  const base64 = Buffer.from(svgContent).toString('base64');
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  
  // إنشاء ملف نصي يحتوي على SVG
  fs.writeFileSync(imagePath.replace('.png', '.svg'), svgContent);
  console.log(`📸 Created placeholder SVG: ${imagePath.replace('.png', '.svg')}`);
}

async function fixMissingImages() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(getMongoUri(), config.mongodb.options);
    console.log('✅ Connected to MongoDB');

    // الحصول على جميع المنتجات النشطة
    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} active products`);

    const imagesDir = path.join(__dirname, 'public/images/');
    let fixedCount = 0;
    let missingCount = 0;

    for (const product of products) {
      if (product.mainImage) {
        // إزالة /images/ من بداية المسار
        const imageName = product.mainImage.replace('/images/', '');
        const imagePath = path.join(imagesDir, imageName);

        // التحقق من وجود الصورة
        if (!fs.existsSync(imagePath)) {
          console.log(`❌ Missing image for product "${product.name}": ${imagePath}`);
          missingCount++;

          // إنشاء صورة placeholder
          try {
            createPlaceholderImage(imagePath, product.name);
            fixedCount++;
          } catch (error) {
            console.error(`❌ Failed to create placeholder for ${product.name}:`, error);
          }
        } else {
          console.log(`✅ Image exists for product "${product.name}"`);
        }
      } else {
        console.log(`⚠️ Product "${product.name}" has no mainImage set`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Total products: ${products.length}`);
    console.log(`   - Missing images: ${missingCount}`);
    console.log(`   - Fixed images: ${fixedCount}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error fixing missing images:', error);
    process.exit(1);
  }
}

// تشغيل السكريبت
fixMissingImages(); 