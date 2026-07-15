-- Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS bulk_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'retail';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Ensure stock_history table exists
CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop and recreate product_variants table
DROP TABLE IF EXISTS product_variants;
CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  weight VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  bulk_price DECIMAL(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add variant_id to cart table
ALTER TABLE cart ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS cart (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  rider_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'available',
  current_location JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tracking (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  location JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add reference column to orders table for Paystack integration
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference VARCHAR(255) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_bulk BOOLEAN DEFAULT FALSE;

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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_bnpl BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_escrow BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS escrow_status VARCHAR(30) DEFAULT 'none';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending';

-- Add variant_id column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

-- Make total_amount nullable for reference-based orders
ALTER TABLE orders ALTER COLUMN total_amount DROP NOT NULL;

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

-- Add variant and payment frequency support to grain plans
ALTER TABLE grain_plans
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS auto_debit_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS maturity_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS penalty_rate DECIMAL(5,4) DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS reward_rate DECIMAL(5,4) DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS reward_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

UPDATE grain_plans
SET
  plan_type = COALESCE(plan_type, payment_frequency, 'monthly'),
  auto_debit_enabled = COALESCE(auto_debit_enabled, TRUE),
  maturity_date = COALESCE(maturity_date, created_at + (duration || ' months')::interval),
  status = COALESCE(status, 'active'),
  penalty_rate = COALESCE(penalty_rate, 0.1),
  reward_rate = COALESCE(reward_rate, 0.02),
  reward_amount = COALESCE(reward_amount, 0);

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

CREATE TABLE IF NOT EXISTS bnpl_payments (
  id SERIAL PRIMARY KEY,
  agreement_id INTEGER REFERENCES bnpl_agreements(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS cooperative_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cooperative_contributions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES cooperative_groups(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES cooperative_members(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
