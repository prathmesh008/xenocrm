import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Customer from '../models/Customer';

// Attempt to load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env.local');
  process.exit(1);
}

const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const categories = ['Clothing', 'Electronics', 'Home', 'Beauty', 'Sports'];
const sources = ['Organic', 'Ads', 'Referral', 'Social Media', 'Direct'];

function getRandomItem(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected to MongoDB.');

    console.log('Clearing existing dummy customers...');
    await Customer.deleteMany({});
    
    console.log('Generating 10,000 customers...');
    const customers = [];
    const BATCH_SIZE = 1000;

    for (let i = 0; i < 10000; i++) {
      const firstName = getRandomItem(firstNames);
      const lastName = getRandomItem(lastNames);
      const orders = getRandomNumber(1, 50);
      const avgOrderValue = getRandomNumber(50, 1500);
      const spend = orders * avgOrderValue;
      const visits = getRandomNumber(orders, orders * 5); // visits > orders
      
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const customerSince = getRandomDate(twoYearsAgo, new Date());
      
      // Last active is anytime between customer_since and now
      const lastActive = getRandomDate(customerSince, new Date());
      
      customers.push({
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${getRandomNumber(1, 10000)}@example.com`,
        phone: `+1${getRandomNumber(2000000000, 9999999999)}`,
        spend,
        visits,
        orders,
        avg_order_value: avgOrderValue,
        clv: spend * 1.5, // Rough CLV estimation
        lastActive,
        customer_since: customerSince,
        last_order: lastActive, // Approximate
        preferred_category: getRandomItem(categories),
        source: getRandomItem(sources)
      });
      
      if (customers.length === BATCH_SIZE) {
        await Customer.insertMany(customers);
        console.log(`Inserted ${i + 1} customers...`);
        customers.length = 0; // Clear the array
      }
    }

    if (customers.length > 0) {
      await Customer.insertMany(customers);
    }

    console.log('✅ Successfully seeded 10,000 customers!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
