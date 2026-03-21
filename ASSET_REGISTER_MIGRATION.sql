-- Asset Register Migration for Affinity CRM
-- This migration creates tables for asset management and tracking
-- Run this in Supabase SQL Editor after backing up your database

-- ============================================
-- 1. ASSETS TABLE - Main asset inventory
-- ============================================
DROP TABLE IF EXISTS public.asset_requests CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- e.g., 'Electronics', 'Tools', 'Vehicles', 'Office Equipment'
  serial_number TEXT, -- Optional serial/model number
  status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Under Maintenance', 'Retired')),
  location TEXT, -- Where the asset is stored/located
  purchase_date DATE,
  purchase_value NUMERIC(12, 2),
  condition TEXT DEFAULT 'Good', -- e.g., 'Excellent', 'Good', 'Fair', 'Poor'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_assets_category ON public.assets(category);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_name ON public.assets(name);

-- ============================================
-- 2. ASSET REQUESTS TABLE - Track borrowing/returning
-- ============================================
CREATE TABLE public.asset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL, -- Name of the person requesting the asset
  requester_email TEXT, -- Email of the requester
  requester_department TEXT, -- Department of the requester
  
  -- Request dates
  request_date TIMESTAMPTZ DEFAULT NOW(),
  requested_take_date DATE, -- When the user wants to take the asset
  approved_by TEXT, -- Who approved the request
  approval_date TIMESTAMPTZ,
  
  -- Take and return dates
  actual_take_date TIMESTAMPTZ, -- When the asset was actually taken
  expected_return_date DATE, -- When the asset is expected to be returned
  actual_return_date TIMESTAMPTZ, -- When the asset was actually returned
  
  -- Status
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Taken', 'Returned', 'Overdue')),
  rejection_reason TEXT, -- Why the request was rejected
  
  -- Notes
  purpose TEXT, -- Why the asset is needed
  notes TEXT, -- Any additional notes
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_asset_requests_asset_id ON public.asset_requests(asset_id);
CREATE INDEX idx_asset_requests_status ON public.asset_requests(status);
CREATE INDEX idx_asset_requests_requested_by ON public.asset_requests(requested_by);
CREATE INDEX idx_asset_requests_actual_take_date ON public.asset_requests(actual_take_date);
CREATE INDEX idx_asset_requests_actual_return_date ON public.asset_requests(actual_return_date);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

-- Assets table RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers, Accountants, and Admins can view assets"
  ON public.assets FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager', 'Accountant')
    )
  );

CREATE POLICY "Managers and Admins can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Managers and Admins can update assets"
  ON public.assets FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- Asset Requests table RLS
ALTER TABLE public.asset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers, Accountants, and Admins can view asset requests"
  ON public.asset_requests FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager', 'Accountant')
    )
  );

CREATE POLICY "Managers and Admins can insert asset requests"
  ON public.asset_requests FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Managers and Admins can update asset requests"
  ON public.asset_requests FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' IN ('Admin', 'Manager')
    )
  );

CREATE POLICY "Admins can delete asset requests"
  ON public.asset_requests FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users 
      WHERE raw_user_meta_data->>'role' = 'Admin'
    )
  );

-- ============================================
-- 4. SEED SOME SAMPLE DATA
-- ============================================
INSERT INTO public.assets (name, description, category, serial_number, status, location, condition) VALUES
  ('MacBook Pro 16"', '2023 MacBook Pro 16" with M2 Pro', 'Electronics', 'C02XG0GTJGH5', 'Available', 'Office - Harare', 'Excellent'),
  ('MacBook Air 13"', '2022 MacBook Air with M1 chip', 'Electronics', 'C02FG0GTJG56', 'Available', 'Office - Harare', 'Good'),
  ('Dell Precision 5560', 'Mobile Workstation', 'Electronics', 'DELL-PREC-5560-001', 'Available', 'Office - UK', 'Good'),
  ('iPhone 14 Pro', 'Company mobile phone', 'Electronics', 'IMEI-123456789012', 'Available', 'Office - Harare', 'Good'),
  ('iPad Pro 12.9"', 'Company tablet', 'Electronics', 'IPAD-PRO-12-001', 'Available', 'Office - Harare', 'Good'),
  ('Canon EOS R5', 'Professional camera', 'Equipment', 'CANON-EOS-R5-001', 'Available', 'Office - Harare', 'Excellent'),
  ('Projector - Epson', 'Epson EB-2250U projector', 'Office Equipment', 'EPSON-EB-2250-001', 'Available', 'Conference Room A', 'Good'),
  ('GPS Navigation - Garmin', 'Garmin Drive 52', 'Electronics', 'GARMIN-52-001', 'Available', 'Office - Harare', 'Good'),
  ('Power Drill - DeWalt', 'DeWalt 20V MAX Cordless Drill', 'Tools', 'DEWALT-DCD791D2-001', 'Available', 'Warehouse', 'Good'),
  ('Ladder - Aluminum', '10ft aluminum extension ladder', 'Tools', 'LADDER-ALU-10FT-001', 'Available', 'Warehouse', 'Good'),
  ('Office Chair - Herman Miller', 'Aeron chair size B', 'Furniture', 'HM-AERON-B-001', 'Available', 'Office - Harare', 'Good'),
  ('Conference Table', '8-person conference table', 'Furniture', 'CONF-TABLE-8-001', 'Available', 'Conference Room A', 'Good'),
  ('Tent - 6 Person', 'Coleman 6-person instant tent', 'Equipment', 'COLEMAN-TENT-6-001', 'Available', 'Warehouse', 'Good'),
  ('Portable Generator', 'Honda EU2200i generator', 'Equipment', 'HONDA-EU2200I-001', 'Available', 'Warehouse', 'Good'),
  ('First Aid Kit', 'OSHA compliant first aid kit', 'Safety', 'FAK-OSHA-001', 'Available', 'Reception', 'Good');
