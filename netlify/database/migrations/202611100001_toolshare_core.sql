CREATE TABLE IF NOT EXISTS toolshare_members (
  identity_user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  town TEXT NOT NULL,
  postcode TEXT NOT NULL,
  mobile TEXT NOT NULL,
  membership_status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (membership_status IN ('pending_payment', 'active', 'suspended', 'expired')),
  membership_paid_at TIMESTAMPTZ,
  membership_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS toolshare_payments (
  id BIGSERIAL PRIMARY KEY,
  checkout_reference TEXT NOT NULL UNIQUE,
  sumup_checkout_id TEXT UNIQUE,
  identity_user_id TEXT NOT NULL REFERENCES toolshare_members(identity_user_id),
  membership_amount NUMERIC(10,2) NOT NULL CHECK (membership_amount = 30),
  contribution_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (contribution_amount >= 0),
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount = membership_amount + contribution_amount),
  currency TEXT NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired')),
  email_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (email_status IN ('not_sent', 'sending', 'sent', 'configuration_required', 'failed')),
  email_sent_at TIMESTAMPTZ,
  email_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS toolshare_payments_member_created_idx
  ON toolshare_payments(identity_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS toolshare_bookings (
  id TEXT PRIMARY KEY,
  identity_user_id TEXT NOT NULL REFERENCES toolshare_members(identity_user_id),
  tool_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  booking_status TEXT NOT NULL DEFAULT 'requested'
    CHECK (booking_status IN ('requested', 'confirmed', 'cancelled', 'complete')),
  collection_status TEXT NOT NULL DEFAULT 'awaiting_collection'
    CHECK (collection_status IN ('awaiting_collection', 'collected', 'returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  collected_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ
);

ALTER TABLE toolshare_bookings ADD COLUMN IF NOT EXISTS hire_payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (hire_payment_status IN ('unpaid', 'paid'));

CREATE INDEX IF NOT EXISTS toolshare_bookings_member_idx
  ON toolshare_bookings(identity_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS toolshare_donations (
  id TEXT PRIMARY KEY,
  identity_user_id TEXT,
  donor_name TEXT NOT NULL,
  donor_email TEXT NOT NULL,
  donor_phone TEXT NOT NULL,
  donor_address TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  description TEXT NOT NULL,
  condition TEXT NOT NULL,
  ownership_confirmed BOOLEAN NOT NULL CHECK (ownership_confirmed),
  safety_confirmed BOOLEAN NOT NULL CHECK (safety_confirmed),
  terms_confirmed BOOLEAN NOT NULL CHECK (terms_confirmed),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

ALTER TABLE toolshare_donations ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE toolshare_donations ADD COLUMN IF NOT EXISTS safety_requirements TEXT NOT NULL DEFAULT '';
ALTER TABLE toolshare_donations ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE toolshare_donations ADD COLUMN IF NOT EXISTS handover_method TEXT NOT NULL DEFAULT 'Drop-off';
ALTER TABLE toolshare_donations ADD COLUMN IF NOT EXISTS preferred_date DATE;
CREATE INDEX IF NOT EXISTS toolshare_donations_status_created_idx
  ON toolshare_donations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS toolshare_catalogue (
  tool_id TEXT PRIMARY KEY,
  tool_type TEXT NOT NULL DEFAULT 'Community' CHECK (tool_type IN ('Hall', 'Community')),
  submission_id TEXT UNIQUE REFERENCES toolshare_donations(id),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🛠️',
  category TEXT NOT NULL,
  daily_rate NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),
  replacement_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (replacement_value >= 0),
  condition TEXT NOT NULL,
  description TEXT NOT NULL,
  safety_requirements TEXT NOT NULL DEFAULT '',
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS toolshare_catalogue_active_idx
  ON toolshare_catalogue(active, category);
INSERT INTO toolshare_catalogue (tool_id, tool_type, name, icon, category, daily_rate, replacement_value, condition, description)
VALUES
  ('1', 'Hall', 'Step Ladder', '🪜', 'Access', 2, 40, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('2', 'Hall', '3 Tier Ladder', '🪜', 'Access', 2, 60, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('3', 'Hall', 'Wheelbarrow', '🛒', 'Garden', 2, 45, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('4', 'Hall', 'Spade', '🌱', 'Garden', 1, 20, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('5', 'Hall', 'Fork', '🌿', 'Garden', 1, 20, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('6', 'Hall', 'Kärcher Pressure Washer + Extension', '💦', 'Cleaning', 3, 100, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('7', 'Hall', 'Axe', '🪓', 'Garden', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('8', 'Hall', 'Club Hammer', '🔨', 'Hand Tools', 1, 25, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('9', 'Hall', 'Small Electric Breaker', '⚒️', 'Heavy Duty', 3, 120, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('10', 'Hall', 'Cement Mixing Paddle', '🌀', 'Building', 2, 50, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('11', 'Hall', 'DeWalt Drill', '🔧', 'DeWalt', 3, 90, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('12', 'Hall', 'DeWalt Large Hammer Drill', '🔨', 'DeWalt', 3, 120, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('13', 'Hall', 'DeWalt Impact Driver', '🔩', 'DeWalt', 3, 100, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('14', 'Hall', 'DeWalt Jigsaw', '🪚', 'DeWalt', 3, 100, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('15', 'Hall', 'DeWalt Router', '🪵', 'DeWalt', 3, 130, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('16', 'Hall', 'DeWalt Orbital Sander', '🛠️', 'DeWalt', 2, 80, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('17', 'Hall', 'DeWalt Square Sander', '🛠️', 'DeWalt', 2, 70, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('18', 'Hall', 'DeWalt Large Orbital Sander', '🛠️', 'DeWalt', 3, 110, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('19', 'Hall', 'DeWalt Reciprocating Saw', '🪚', 'DeWalt', 3, 110, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('20', 'Hall', 'DeWalt 1st Fix Nail Gun', '🔩', 'DeWalt', 3, 150, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('21', 'Hall', 'DeWalt 2nd Fix Nail Gun', '🔩', 'DeWalt', 3, 150, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('22', 'Hall', 'Makita Plunge Saw + Track', '🪚', 'Makita', 4, 150, 'Good', 'MAINS ELECTRIC — includes plunge saw and track; NO batteries.'),
  ('23', 'Hall', 'DeWalt Batteries', '🔋', 'Batteries', 1, 80, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('24', 'Hall', 'Hand Saw Set', '🪚', 'Hand Tools', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('25', 'Hall', 'Coping Saw', '🪚', 'Hand Tools', 1, 15, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('26', 'Hall', 'Metal Saw', '🪚', 'Hand Tools', 1, 15, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('27', 'Hall', 'Arbour Multi Tool', '🧰', 'Hand Tools', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('28', 'Hall', 'Spirit Level Set', '📏', 'Measuring', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('29', 'Hall', 'Clamp Set', '🗜️', 'Clamps', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('30', 'Hall', 'Wrecking Bar Set', '🔧', 'Demolition', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('31', 'Hall', 'Screwdriver Set', '🪛', 'Hand Tools', 1, 25, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('32', 'Hall', 'Pliers Set', '🔧', 'Hand Tools', 1, 25, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('33', 'Hall', 'Pry Bar Set', '🔧', 'Demolition', 1, 25, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('34', 'Hall', 'Set Square Set', '📐', 'Measuring', 1, 20, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.'),
  ('35', 'Hall', 'Chisel Set', '🔨', 'Hand Tools', 1, 30, 'Good', 'Hall-owned pilot equipment. Condition checked at collection.')
ON CONFLICT (tool_id) DO NOTHING;

