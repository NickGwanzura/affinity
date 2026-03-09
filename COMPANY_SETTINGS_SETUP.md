# Company Settings - Supabase Setup

## Overview
Company details are now persisted in Supabase database, so they won't reset between sessions.

## Setup Instructions

### 1. Create the Database Table

**IMPORTANT:** If you already have the `vehicles` and `expenses` tables, use the SQL below (company_details only).

1. Go to your Supabase dashboard: https://bujvjyucylvdwgdkcxvj.supabase.co
2. Navigate to **SQL Editor**
3. Run this SQL (company_details table only):

```sql
-- Company Details Table
CREATE TABLE company_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE company_details ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read company details
CREATE POLICY "Allow authenticated read access" ON company_details
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update company details
CREATE POLICY "Allow authenticated update access" ON company_details
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to insert company details
CREATE POLICY "Allow authenticated insert access" ON company_details
  FOR INSERT TO authenticated WITH CHECK (true);
```

### 2. Test the Setup

1. Log in to your app
2. Go to Settings → Company tab
3. Fill in your company details
4. Click "Save Company Details"
5. Refresh the page - your details should persist!

## Features

✅ **Automatic Persistence** - Company details save to database automatically
✅ **Session Recovery** - Details remain after logout/login
✅ **Fallback Support** - If table doesn't exist, app uses local storage
✅ **Validation** - All inputs validated before saving
✅ **Security** - Row-level security policies protect data

## How It Works

### On Load
1. App fetches company details from `company_details` table
2. If table doesn't exist, uses default values
3. If no data in table, uses default values

### On Save
1. Validates all inputs (name, email, etc.)
2. Checks if record exists in database
3. Updates existing record OR inserts new one
4. Updates local cache for faster access

### Error Handling
- If Supabase table doesn't exist, app falls back to local storage
- Graceful degradation ensures app continues working
- Console warnings help diagnose setup issues

## Troubleshooting

### Company details not persisting?
1. Check if `company_details` table exists in Supabase
2. Run the SQL schema in your Supabase SQL Editor
3. Verify RLS policies are enabled
4. Check browser console for error messages

### Getting "table does not exist" error?
- This is expected if you haven't created the table yet
- Run the SQL schema provided above
- The app will continue working with local storage until table is created

### Can't update company details?
1. Verify you're logged in as an authenticated user
2. Check RLS policies allow your user to update
3. Verify `contact_email` is a valid email format

## Migration from Local Storage

If you were using the app before this update:
1. Note down your current company details
2. Create the database table using SQL above
3. Re-enter your company details and save
4. They will now persist in the database

---

**Setup Date:** January 17, 2026  
**Status:** ✅ Production Ready
