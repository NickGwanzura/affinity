-- Add New User: maxmosmagede@gmail.com
-- Role: Accountant

INSERT INTO user_profiles (email, name, role, status, password_hash, password_salt, created_at, updated_at)
VALUES (
  'maxmosmagede@gmail.com',
  'Max Maged',
  'Accountant',
  'Active',
  '65cd7946a4ea45791c7416074a06dcef83797092976fc860dc8d68e73a1ee502',
  '5f3fc6926507bbe2bcc2ece8752e207c',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = 'Max Maged',
  role = 'Accountant',
  status = 'Active',
  password_hash = '65cd7946a4ea45791c7416074a06dcef83797092976fc860dc8d68e73a1ee502',
  password_salt = '5f3fc6926507bbe2bcc2ece8752e207c',
  updated_at = NOW();
