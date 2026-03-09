-- ============================================
-- MULTI-LINE QUOTES & INVOICES MIGRATION
-- ============================================
-- This migration creates dedicated line item tables for quotes and invoices
-- Provides better data integrity, querying, and reporting capabilities
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE QUOTE_ITEMS TABLE
-- ============================================
DROP TABLE IF EXISTS public.quote_items CASCADE;

CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  tax_rate NUMERIC(5, 2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount NUMERIC(12, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_quote_line UNIQUE (quote_id, line_number)
);

-- Indexes for performance
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_line_number ON public.quote_items(quote_id, line_number);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_quote_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_items_updated_at_trigger
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_items_updated_at();

-- RLS Policies for quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quote items"
  ON public.quote_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create quote items"
  ON public.quote_items FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update quote items"
  ON public.quote_items FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete quote items"
  ON public.quote_items FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role = 'Admin'
    )
  );

-- ============================================
-- 2. CREATE INVOICE_ITEMS TABLE
-- ============================================
DROP TABLE IF EXISTS public.invoice_items CASCADE;

CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  tax_rate NUMERIC(5, 2) DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount NUMERIC(12, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_invoice_line UNIQUE (invoice_id, line_number)
);

-- Indexes for performance
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_line_number ON public.invoice_items(invoice_id, line_number);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_invoice_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_items_updated_at_trigger
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_items_updated_at();

-- RLS Policies for invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and Accountants can create invoice items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins and Accountants can update invoice items"
  ON public.invoice_items FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('Admin', 'Accountant')
    )
  );

CREATE POLICY "Admins can delete invoice items"
  ON public.invoice_items FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role = 'Admin'
    )
  );

-- ============================================
-- 3. CREATE TRIGGERS TO AUTO-UPDATE TOTALS
-- ============================================

-- Function to update quote total when items change
CREATE OR REPLACE FUNCTION update_quote_total()
RETURNS TRIGGER AS $$
DECLARE
  quote_total NUMERIC(12, 2);
BEGIN
  -- Calculate total from all line items
  SELECT COALESCE(SUM(amount + tax_amount), 0)
  INTO quote_total
  FROM public.quote_items
  WHERE quote_id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Update the quote
  UPDATE public.quotes
  SET amount_usd = quote_total
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_total();

-- Function to update invoice total when items change
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  invoice_total NUMERIC(12, 2);
BEGIN
  -- Calculate total from all line items
  SELECT COALESCE(SUM(amount + tax_amount), 0)
  INTO invoice_total
  FROM public.invoice_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Update the invoice
  UPDATE public.invoices
  SET amount_usd = invoice_total
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- ============================================
-- 4. CREATE HELPER VIEWS FOR EASY QUERYING
-- ============================================

-- View for quotes with line items
CREATE OR REPLACE VIEW quote_details AS
SELECT 
  q.id as quote_id,
  q.quote_number,
  q.client_name,
  q.client_email,
  q.status,
  q.amount_usd as quote_total,
  q.valid_until,
  q.created_at,
  qi.id as line_id,
  qi.line_number,
  qi.description,
  qi.quantity,
  qi.unit_price,
  qi.amount,
  qi.tax_rate,
  qi.tax_amount,
  qi.notes
FROM public.quotes q
LEFT JOIN public.quote_items qi ON q.id = qi.quote_id
ORDER BY q.created_at DESC, qi.line_number ASC;

-- View for invoices with line items
CREATE OR REPLACE VIEW invoice_details AS
SELECT 
  i.id as invoice_id,
  i.invoice_number,
  i.client_name,
  i.client_email,
  i.status,
  i.amount_usd as invoice_total,
  i.due_date,
  i.created_at,
  ii.id as line_id,
  ii.line_number,
  ii.description,
  ii.quantity,
  ii.unit_price,
  ii.amount,
  ii.tax_rate,
  ii.tax_amount,
  ii.notes
FROM public.invoices i
LEFT JOIN public.invoice_items ii ON i.id = ii.invoice_id
ORDER BY i.created_at DESC, ii.line_number ASC;

-- ============================================
-- 5. CREATE SUMMARY FUNCTIONS
-- ============================================

-- Function to get quote summary with line count
CREATE OR REPLACE FUNCTION get_quote_summary(quote_uuid UUID)
RETURNS TABLE (
  quote_id UUID,
  quote_number TEXT,
  client_name TEXT,
  status TEXT,
  line_count BIGINT,
  subtotal NUMERIC,
  tax_total NUMERIC,
  grand_total NUMERIC,
  valid_until DATE,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.quote_number,
    q.client_name,
    q.status,
    COUNT(qi.id) as line_count,
    COALESCE(SUM(qi.amount), 0) as subtotal,
    COALESCE(SUM(qi.tax_amount), 0) as tax_total,
    COALESCE(SUM(qi.amount + qi.tax_amount), 0) as grand_total,
    q.valid_until,
    q.created_at
  FROM public.quotes q
  LEFT JOIN public.quote_items qi ON q.id = qi.quote_id
  WHERE q.id = quote_uuid
  GROUP BY q.id, q.quote_number, q.client_name, q.status, q.valid_until, q.created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get invoice summary with line count
CREATE OR REPLACE FUNCTION get_invoice_summary(invoice_uuid UUID)
RETURNS TABLE (
  invoice_id UUID,
  invoice_number TEXT,
  client_name TEXT,
  status TEXT,
  line_count BIGINT,
  subtotal NUMERIC,
  tax_total NUMERIC,
  grand_total NUMERIC,
  due_date DATE,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.invoice_number,
    i.client_name,
    i.status,
    COUNT(ii.id) as line_count,
    COALESCE(SUM(ii.amount), 0) as subtotal,
    COALESCE(SUM(ii.tax_amount), 0) as tax_total,
    COALESCE(SUM(ii.amount + ii.tax_amount), 0) as grand_total,
    i.due_date,
    i.created_at
  FROM public.invoices i
  LEFT JOIN public.invoice_items ii ON i.id = ii.invoice_id
  WHERE i.id = invoice_uuid
  GROUP BY i.id, i.invoice_number, i.client_name, i.status, i.due_date, i.created_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. MIGRATE EXISTING JSONB DATA (IF ANY)
-- ============================================

-- Migrate quote items from JSONB to dedicated table
DO $$
DECLARE
  quote_rec RECORD;
  item_rec RECORD;
  line_num INTEGER;
BEGIN
  FOR quote_rec IN SELECT id, items FROM public.quotes WHERE items IS NOT NULL AND items != 'null'::jsonb
  LOOP
    line_num := 1;
    FOR item_rec IN SELECT * FROM jsonb_to_recordset(quote_rec.items) AS x(
      description TEXT,
      quantity NUMERIC,
      unit_price NUMERIC,
      amount NUMERIC
    )
    LOOP
      INSERT INTO public.quote_items (
        quote_id,
        line_number,
        description,
        quantity,
        unit_price,
        amount
      ) VALUES (
        quote_rec.id,
        line_num,
        item_rec.description,
        COALESCE(item_rec.quantity, 1),
        COALESCE(item_rec.unit_price, item_rec.amount / NULLIF(item_rec.quantity, 0), 0),
        COALESCE(item_rec.amount, 0)
      )
      ON CONFLICT (quote_id, line_number) DO NOTHING;
      
      line_num := line_num + 1;
    END LOOP;
  END LOOP;
END $$;

-- Migrate invoice items from JSONB to dedicated table
DO $$
DECLARE
  invoice_rec RECORD;
  item_rec RECORD;
  line_num INTEGER;
BEGIN
  FOR invoice_rec IN SELECT id, items FROM public.invoices WHERE items IS NOT NULL AND items != 'null'::jsonb
  LOOP
    line_num := 1;
    FOR item_rec IN SELECT * FROM jsonb_to_recordset(invoice_rec.items) AS x(
      description TEXT,
      quantity NUMERIC,
      unit_price NUMERIC,
      amount NUMERIC
    )
    LOOP
      INSERT INTO public.invoice_items (
        invoice_id,
        line_number,
        description,
        quantity,
        unit_price,
        amount
      ) VALUES (
        invoice_rec.id,
        line_num,
        item_rec.description,
        COALESCE(item_rec.quantity, 1),
        COALESCE(item_rec.unit_price, item_rec.amount / NULLIF(item_rec.quantity, 0), 0),
        COALESCE(item_rec.amount, 0)
      )
      ON CONFLICT (invoice_id, line_number) DO NOTHING;
      
      line_num := line_num + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================

-- Check quote_items table
SELECT 'quote_items' as table_name, COUNT(*) as row_count FROM public.quote_items
UNION ALL
SELECT 'invoice_items', COUNT(*) FROM public.invoice_items;

-- Sample quote with items
SELECT * FROM quote_details LIMIT 10;

-- Sample invoice with items
SELECT * FROM invoice_details LIMIT 10;

-- Check totals match
SELECT 
  q.id,
  q.quote_number,
  q.amount_usd as stored_total,
  COALESCE(SUM(qi.amount + qi.tax_amount), 0) as calculated_total,
  q.amount_usd - COALESCE(SUM(qi.amount + qi.tax_amount), 0) as difference
FROM public.quotes q
LEFT JOIN public.quote_items qi ON q.id = qi.quote_id
GROUP BY q.id, q.quote_number, q.amount_usd
HAVING q.amount_usd - COALESCE(SUM(qi.amount + qi.tax_amount), 0) != 0;

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
-- Next steps:
-- 1. Update the application code to use quote_items and invoice_items tables
-- 2. Update the UI to support adding/editing/removing line items
-- 3. Consider deprecating the JSONB items column after migration is verified
-- 4. Test all CRUD operations with the new structure
