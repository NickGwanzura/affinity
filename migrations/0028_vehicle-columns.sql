-- Add new columns to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS reg_number VARCHAR(50) DEFAULT '';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) DEFAULT 'Resale';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS cbca_applied BOOLEAN DEFAULT false;

-- Update indexes if needed
CREATE INDEX IF NOT EXISTS idx_vehicles_purpose ON vehicles(purpose);
CREATE INDEX IF NOT EXISTS idx_vehicles_cbca_applied ON vehicles(cbca_applied);