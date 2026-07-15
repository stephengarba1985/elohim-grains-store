-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'retail',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  bulk_price DECIMAL(10,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  weight VARCHAR(255),
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  weight VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  bulk_price DECIMAL(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create stock_history table
CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cart table
CREATE TABLE IF NOT EXISTS cart (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  is_bulk BOOLEAN DEFAULT FALSE,
  is_subscription BOOLEAN DEFAULT FALSE,
  is_bnpl BOOLEAN DEFAULT FALSE,
  is_escrow BOOLEAN DEFAULT FALSE,
  escrow_status VARCHAR(30) DEFAULT 'none',
  payment_gateway VARCHAR(50),
  payment_channel VARCHAR(50),
  payment_status VARCHAR(30) DEFAULT 'pending',
  rider_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'available',
  current_location JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tracking table
CREATE TABLE IF NOT EXISTS tracking (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  plan VARCHAR(20) NOT NULL,
  next_delivery TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create bulk_requests table
CREATE TABLE IF NOT EXISTS bulk_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  requested_price DECIMAL(10,2),
  approved_price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create grain_plans table
CREATE TABLE IF NOT EXISTS grain_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  payment_frequency VARCHAR(20) DEFAULT 'monthly',
  plan_type VARCHAR(20) DEFAULT 'monthly',
  auto_debit_enabled BOOLEAN DEFAULT TRUE,
  maturity_date TIMESTAMP,
  status VARCHAR(30) DEFAULT 'active',
  penalty_rate DECIMAL(5,4) DEFAULT 0.1,
  reward_rate DECIMAL(5,4) DEFAULT 0.02,
  reward_amount DECIMAL(10,2) DEFAULT 0,
  completed_at TIMESTAMP,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create grain_plan_payments table
CREATE TABLE IF NOT EXISTS grain_plan_payments (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES grain_plans(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  related_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  plan_id INTEGER REFERENCES grain_plans(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet virtual accounts table
CREATE TABLE IF NOT EXISTS wallet_virtual_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  account_number VARCHAR(30) UNIQUE NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) DEFAULT 'monnify',
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create wallet virtual account deposits table
CREATE TABLE IF NOT EXISTS wallet_virtual_account_deposits (
  id SERIAL PRIMARY KEY,
  virtual_account_id INTEGER REFERENCES wallet_virtual_accounts(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(30) NOT NULL,
  sender_name VARCHAR(255),
  reference VARCHAR(100) UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create BNPL agreements table
CREATE TABLE IF NOT EXISTS bnpl_agreements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  frequency VARCHAR(20) NOT NULL DEFAULT 'weekly',
  duration_months INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  installment_amount DECIMAL(10,2) NOT NULL,
  credit_score INTEGER DEFAULT 600,
  guarantor_name VARCHAR(255) NOT NULL,
  guarantor_phone VARCHAR(50) NOT NULL,
  guarantor_relationship VARCHAR(100),
  status VARCHAR(30) DEFAULT 'active',
  next_due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create BNPL payments table
CREATE TABLE IF NOT EXISTS bnpl_payments (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER REFERENCES bnpl_agreements(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cooperative groups table
CREATE TABLE IF NOT EXISTS cooperative_groups (
  id SERIAL PRIMARY KEY,
  creator_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  group_type VARCHAR(50) DEFAULT 'other',
  target_amount DECIMAL(10,2) DEFAULT 0,
  delivery_address TEXT,
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cooperative members table
CREATE TABLE IF NOT EXISTS cooperative_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cooperative contributions table
CREATE TABLE IF NOT EXISTS cooperative_contributions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES cooperative_members(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cooperative bulk requests table
CREATE TABLE IF NOT EXISTS cooperative_bulk_requests (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  requested_price DECIMAL(10,2),
  delivery_note TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create escrow payments table
CREATE TABLE IF NOT EXISTS escrow_payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'held',
  release_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP
);

-- Create payment gateway transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  channel VARCHAR(50) NOT NULL,
  reference VARCHAR(100) UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  account_number VARCHAR(30),
  account_name VARCHAR(255),
  bank_name VARCHAR(255),
  ussd_code VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);
