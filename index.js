const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rongali-threads', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected')).catch(err => console.error('MongoDB error:', err));

// User model
const User = require('./models/Auser');

// In-memory product data (same as frontend)
const products = [
  {
    id: 1,
    title: "Pure Padmini Mekhela Chador",
    price: "₹599",
    originalPrice: "₹999",
    description: "Exquisite handwoven Muga silk with traditional motifs.",
    features: [
      "100% Pure Muga Silk",
      "Handwoven by skilled artisans",
      "Traditional Assamese motifs"
    ],
    image: "./image/w1.jpg",
    category: "mekhla",
    stock: 5
  },
  {
    id: 2,
    title: "Pure Gilele Pat Gamosa",
    price: "₹499",
    description: "Authentic Assamese Gamosa set of 3 pieces.",
    features: [
      "Set of 3 pure cotton Gamosas",
      "Traditional red and white designs"
    ],
    image: "./image/g1.jpg",
    category: "gamosa",
    stock: 10
  },
  {
    id: 3,
    title: "Assamese Jewelry Set",
    price: "₹499",
    description: "Traditional Assamese jewelry with colorful beads.",
    features: [
      "Includes necklace, earrings, and bangles",
      "Handcrafted by local artisans"
    ],
    image: "./image/w2.jpg",
    category: "accessories",
    stock: 3
  },
  {
    id: 4,
    title: "Traditional Mekhela Chador",
    price: "₹799",
    description: "Beautiful cotton Mekhela Chador with traditional patterns.",
    features: [
      "100% Pure Cotton",
      "Comfortable for daily wear",
      "Handwoven by local artisans"
    ],
    image: "./image/w3.jpg",
    category: "mekhla",
    stock: 7
  },
  {
    id: 5,
    title: "Assamese Silk Scarf",
    price: "₹699",
    description: "Elegant silk scarf with traditional designs.",
    features: [
      "Pure Muga Silk",
      "Lightweight and comfortable",
      "Perfect for all occasions"
    ],
    image: "./image/w4.jpg",
    category: "accessories",
    stock: 12
  },
  {
    id: 6,
    title: "Premium Gamosa Set",
    price: "₹499",
    description: "Set of 5 premium quality Gamosas.",
    features: [
      "Set of 5 pieces",
      "Traditional designs",
      "High quality cotton"
    ],
    image: "./image/g2.jpg",
    category: "gamosa",
    stock: 8
  }
];

// In-memory cart and orders (for demo)
let cart = [];
let orders = [];

// Get all products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// Get single product by id
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id == req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Get cart
app.get('/api/cart', (req, res) => {
  res.json(cart);
});

// Add to cart
app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id == productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.stock < quantity) return res.status(400).json({ error: 'Not enough stock' });
  const existing = cart.find(item => item.productId == productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId, quantity });
  }
  res.json(cart);
});

// Order Schema for MongoDB
const orderSchema = new mongoose.Schema({
  productId: Number,
  quantity: Number,
  address: {
    name: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String
  },
  product: Object,
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Place order (from frontend address form)
app.post('/api/orders', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.json({ success: true, orderId: order._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all orders (for admin)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });
    res.json({ message: 'User registered', user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Serve admin panel
app.get('/admin', authMiddleware, async (req, res) => {
  // Optionally, check for admin role here
  res.render('admin');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
});