-- Add client_id to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  vehicle_id UUID REFERENCES vehicles(id),
  description VARCHAR(500) NOT NULL,
  origin VARCHAR(200) NOT NULL,
  destination VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'Pending',
  shipping_date DATE,
  delivery_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_client_id ON shipments(client_id);
CREATE INDEX IF NOT EXISTS idx_shipments_vehicle_id ON shipments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);