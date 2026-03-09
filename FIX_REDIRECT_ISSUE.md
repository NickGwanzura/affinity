# Quick Fix: Supabase Email Redirect Issue

## The Problem
Email confirmation links sent before updating the Site URL still redirect to the old URL.

## Solution

### Step 1: Update Supabase Settings
1. Go to: https://bujvjyucylvdwgdkcxvj.supabase.co
2. Navigate to: **Authentication > URL Configuration**
3. Set **Site URL** to: `http://localhost:3000`
4. Add to **Redirect URLs**: `http://localhost:3000/**`

### Step 2: Disable Email Confirmation (Recommended for Development)
1. Go to: **Authentication > Providers > Email**
2. Toggle OFF: **"Confirm email"**
3. Click **Save**

### Step 3: Manually Confirm Existing User
1. Go to: **Authentication > Users**
2. Find user: `gwanzuranicholas@gmail.com`
3. Click the ⋮ menu button
4. Select: **"Confirm user"** or edit and check "Email Confirmed"
5. Save

### Step 4: Login
Now you can login at `http://localhost:3000` with:
- Email: gwanzuranicholas@gmail.com
- Password: asdf_1234

No email confirmation needed!
