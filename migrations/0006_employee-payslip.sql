-- ============================================
-- EMPLOYEE & PAYSLIP TABLES MIGRATION
-- ============================================
-- Creates tables for employee management and payslip generation
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. EMPLOYEES TABLE
-- ============================================
DROP TABLE IF EXISTS public.employees CASCADE;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  department TEXT,
  position TEXT NOT NULL,
  base_pay_usd NUMERIC(12, 2) NOT NULL CHECK (base_pay_usd >= 0),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'NAD', 'GBP')),
  employment_type TEXT DEFAULT 'Full-time' CHECK (employment_type IN ('Full-time', 'Part-time', 'Contract', 'Intern')),
  date_hired DATE NOT NULL,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Terminated')),
  national_id TEXT,
  bank_account TEXT,
  bank_name TEXT,
  tax_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_department ON public.employees(department);
CREATE INDEX idx_employees_email ON public.employees(email);
CREATE INDEX idx_employees_number ON public.employees(employee_number);

-- RLS Policies
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employees"
  ON public.employees FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can create employees"
  ON public.employees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. PAYSLIPS TABLE
-- ============================================
DROP TABLE IF EXISTS public.payslips CASCADE;

CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_number TEXT NOT NULL UNIQUE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2000),
  
  -- Earnings
  base_pay NUMERIC(12, 2) NOT NULL CHECK (base_pay >= 0),
  overtime_hours NUMERIC(8, 2) DEFAULT 0 CHECK (overtime_hours >= 0),
  overtime_rate NUMERIC(8, 2) DEFAULT 0 CHECK (overtime_rate >= 0),
  overtime_pay NUMERIC(12, 2) DEFAULT 0 CHECK (overtime_pay >= 0),
  bonus NUMERIC(12, 2) DEFAULT 0 CHECK (bonus >= 0),
  allowances NUMERIC(12, 2) DEFAULT 0 CHECK (allowances >= 0),
  commission NUMERIC(12, 2) DEFAULT 0 CHECK (commission >= 0),
  
  -- Deductions
  tax_deduction NUMERIC(12, 2) DEFAULT 0 CHECK (tax_deduction >= 0),
  pension_deduction NUMERIC(12, 2) DEFAULT 0 CHECK (pension_deduction >= 0),
  health_insurance NUMERIC(12, 2) DEFAULT 0 CHECK (health_insurance >= 0),
  other_deductions NUMERIC(12, 2) DEFAULT 0 CHECK (other_deductions >= 0),
  
  -- Totals
  gross_pay NUMERIC(12, 2) NOT NULL CHECK (gross_pay >= 0),
  total_deductions NUMERIC(12, 2) NOT NULL CHECK (total_deductions >= 0),
  net_pay NUMERIC(12, 2) NOT NULL CHECK (net_pay >= 0),
  
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'NAD', 'GBP')),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('Bank Transfer', 'Cash', 'Cheque', 'Mobile Money')),
  status TEXT DEFAULT 'Generated' CHECK (status IN ('Generated', 'Approved', 'Paid', 'Cancelled')),
  notes TEXT,
  
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one payslip per employee per month
  UNIQUE(employee_id, month, year)
);

-- Indexes for faster lookups
CREATE INDEX idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX idx_payslips_month_year ON public.payslips(year DESC, month DESC);
CREATE INDEX idx_payslips_status ON public.payslips(status);
CREATE INDEX idx_payslips_created_at ON public.payslips(created_at DESC);

-- RLS Policies
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payslips"
  ON public.payslips FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Admins and Accountants can see all
      EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
      )
      -- Employees can see their own
      OR employee_id IN (
        SELECT e.id FROM public.employees e
        JOIN public.user_profiles u ON u.email = e.email
        WHERE u.id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and Accountants can create payslips"
  ON public.payslips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update payslips"
  ON public.payslips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete payslips"
  ON public.payslips FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'Admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. HELPER FUNCTIONS
-- ============================================

-- Function to generate employee number
CREATE OR REPLACE FUNCTION generate_employee_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  emp_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO next_number FROM public.employees;
  emp_number := 'EMP-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN emp_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate payslip number
CREATE OR REPLACE FUNCTION generate_payslip_number(p_employee_id UUID, p_month INTEGER, p_year INTEGER)
RETURNS TEXT AS $$
DECLARE
  emp_number TEXT;
  payslip_num TEXT;
BEGIN
  SELECT employee_number INTO emp_number FROM public.employees WHERE id = p_employee_id;
  payslip_num := 'PAY-' || emp_number || '-' || TO_CHAR(p_year, 'FM0000') || '-' || TO_CHAR(p_month, 'FM00');
  RETURN payslip_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. VERIFICATION QUERIES
-- ============================================

-- Check if tables were created
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('employees', 'payslips')
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('employees', 'payslips')
ORDER BY tablename;

-- Sample employee insert (for testing)
-- INSERT INTO public.employees (
--   employee_number, name, email, position, base_pay_usd, date_hired
-- ) VALUES (
--   generate_employee_number(),
--   'Test Employee',
--   'test.employee@affinity.com',
--   'Driver',
--   3500.00,
--   CURRENT_DATE
-- );

-- Sample payslip generation (for testing)
-- INSERT INTO public.payslips (
--   payslip_number, employee_id, month, year, 
--   base_pay, gross_pay, total_deductions, net_pay,
--   generated_by
-- ) VALUES (
--   generate_payslip_number(
--     (SELECT id FROM public.employees LIMIT 1),
--     EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
--     EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
--   ),
--   (SELECT id FROM public.employees LIMIT 1),
--   EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
--   EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
--   3500.00,
--   3500.00,
--   525.00,
--   2975.00,
--   auth.uid()
-- );
