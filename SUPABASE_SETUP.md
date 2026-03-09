# Affinity Logistics Management - Supabase Setup

## Supabase Auth Setup Instructions

Your app is now provisioned to use Supabase Auth! Follow these steps to complete the setup:

### 1. Create Auth Users in Supabase Dashboard

Go to your Supabase project dashboard at:
https://bujvjyucylvdwgdkcxvj.supabase.co

Navigate to **Authentication > Users** and create test users:

#### Admin User
- Email: `admin@affinity.com`
- Password: (set your password)
- User Metadata (click "Edit User" after creation):
  ```json
  {
    "name": "James Wilson",
    "role": "Admin"
  }
  ```

#### Manager User
- Email: `manager@affinity.com`
- Password: (set your password)
- User Metadata:
  ```json
  {
    "name": "Sarah Namibia",
    "role": "Manager"
  }
  ```

#### Driver User
- Email: `driver@affinity.com`
- Password: (set your password)
- User Metadata:
  ```json
  {
    "name": "David Driver",
    "role": "Driver"
  }
  ```

#### Accountant User
- Email: `accountant@affinity.com`
- Password: (set your password)
- User Metadata:
  ```json
  {
    "name": "Emily Accountant",
    "role": "Accountant"
  }
  ```

### 2. Configure Email Settings (Optional)

For production use, configure email settings in:
**Authentication > Email Templates**

This enables:
- Password reset emails
- Email verification
- Magic link authentication

### 3. Environment Variables

Already configured in `.env`:
```
VITE_SUPABASE_URL=https://bujvjyucylvdwgdkcxvj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_BdlikUNCRQvOc_qN_j481Q_kBAzeXl5
```

### 4. Authentication Features

Your app now supports:
- ✅ Secure password authentication via Supabase
- ✅ Session management
- ✅ Role-based access control (Admin, Manager, Driver, Accountant)
- ✅ Password reset functionality
- ✅ Automatic session persistence

### 5. User Roles & Dashboards

| Role | Email | Dashboard Access |
|------|-------|-----------------|
| Admin | admin@affinity.com | All dashboards + Settings |
| Manager | manager@affinity.com | Admin Dashboard + Financials |
| Driver | driver@affinity.com | Driver Portal + Documents |
| Accountant | accountant@affinity.com | Accountant Dashboard |

### 6. Testing

1. Start the dev server: `npm run dev`
2. Navigate to the login page
3. Sign in with one of the created users
4. Verify role-based routing works correctly

### Security Notes

- Passwords are securely hashed by Supabase
- Session tokens are stored in httpOnly cookies
- ANON_KEY is safe for client-side use
- Never expose the SERVICE_ROLE_KEY in client code
