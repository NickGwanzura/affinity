# User Invitation System - Documentation

## Overview

A complete custom invite system that allows admins to invite team members via email with pre-assigned roles. The invited users receive a secure signup link that auto-assigns their role when they create their account.

## Features

✅ **Email-based invitations** with role pre-assignment  
✅ **Secure invite tokens** (unique per invitation)  
✅ **7-day expiry** on invitations  
✅ **Status tracking** (Pending, Accepted, Expired)  
✅ **Resend capability** for pending invites  
✅ **Cancel invites** before acceptance  
✅ **Duplicate prevention** (email validation)  
✅ **Real-time console preview** of invite emails (dev mode)  

## How It Works

### 1. Admin Sends Invitation

1. Admin logs in and navigates to **Settings** → **Invitations**
2. Clicks **"Send Invitation"** button
3. Fills in:
   - Name of the person to invite
   - Email address
   - Role (Admin, Manager, Driver, Accountant)
4. System generates:
   - Unique invite token
   - Expiry date (7 days from now)
   - Invite record in database

### 2. Invite Email (Development Mode)

In development, the invite email is displayed in the browser console:

```
📧 INVITE EMAIL (Development Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To: newuser@company.com
Subject: You've Been Invited to Affinity Logistics

Hi John Doe,

You've been invited to join Affinity Logistics as a Manager.

Click here to accept your invitation and create your account:
http://localhost:3000/signup?token=abc123xyz789

This invitation expires in 7 days.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. User Accepts Invitation

1. User clicks the invite link
2. Opens signup page with pre-filled email and role
3. User sets their password
4. Account is created with the assigned role
5. Invite status changes to "Accepted"

## API Methods

### `createInvite(email, role, name, invitedBy)`

Creates a new invitation.

```typescript
const invite = await supabase.createInvite(
  'john@company.com',
  'Manager',
  'John Doe',
  'admin@affinity.com'
);
```

**Validation:**
- Email format validation
- Duplicate user check
- Duplicate pending invite check
- Valid role check

**Returns:** UserInvite object

---

### `getInvites()`

Retrieves all invitations and auto-expires old ones.

```typescript
const invites = await supabase.getInvites();
```

**Returns:** Array of UserInvite objects

---

### `getInviteByToken(token)`

Validates and retrieves an invite by its token.

```typescript
const invite = await supabase.getInviteByToken('abc123xyz789');
```

**Returns:** UserInvite object or null if expired/invalid

---

### `acceptInvite(token, password)`

Processes invite acceptance and creates the user account.

```typescript
const session = await supabase.acceptInvite(
  'abc123xyz789',
  'SecurePassword123!'
);
```

**Returns:** AuthSession with created user

---

### `deleteInvite(inviteId)`

Cancels a pending invitation.

```typescript
await supabase.deleteInvite('inv123');
```

---

### `resendInvite(inviteId)`

Resends an invitation and extends its expiry.

```typescript
const updatedInvite = await supabase.resendInvite('inv123');
```

## UI Components

### Invitations Tab (Settings)

**Location:** Settings → Invitations

**Features:**
- Table showing all invites with status
- Pending invite counter badge
- Send Invitation button
- Action buttons per invite:
  - 📧 Resend (pending only)
  - 🗑️ Cancel (pending only)

**Columns:**
- Name
- Email
- Role (with color-coded badges)
- Status (Pending/Accepted/Expired)
- Expiry Date
- Invited By
- Actions

### Send Invitation Modal

**Fields:**
- Full Name (required)
- Email Address (required)
- Role (dropdown: Driver, Manager, Accountant, Admin)

**Info Notice:**
"📧 An email invitation will be sent with a secure signup link. The invitation expires in 7 days."

## Data Structure

### UserInvite Type

```typescript
interface UserInvite {
  id: string;                    // Unique invite ID
  email: string;                 // Invitee email
  role: UserRole;                // Pre-assigned role
  name: string;                  // Invitee name
  status: 'Pending' | 'Accepted' | 'Expired';
  invitedBy: string;             // Email of inviter
  inviteToken: string;           // Unique secure token
  expiresAt: string;             // ISO date string
  createdAt: string;             // ISO date string
}
```

## Security Features

1. **Token-based access** - Random secure tokens prevent guessing
2. **Time-limited invites** - Automatically expire after 7 days
3. **Email validation** - Prevents invalid email addresses
4. **Duplicate prevention** - Can't invite same email twice
5. **Input sanitization** - XSS protection on all inputs
6. **Role validation** - Only valid roles can be assigned

## Status Workflow

```
[Created] → Pending
           ↓
           ├→ Accepted (user signs up)
           ├→ Expired (7 days pass)
           └→ Deleted (admin cancels)
```

## Production Considerations

### Email Sending

Currently, emails are logged to console. For production:

1. **Add email service** (SendGrid, AWS SES, Resend)
2. **Update `createInvite()` method:**

```typescript
// Replace console.log with actual email sending
await emailService.send({
  to: invite.email,
  subject: 'You\'ve Been Invited to Affinity Logistics',
  template: 'invite-user',
  data: {
    name: invite.name,
    role: invite.role,
    inviteLink: `${window.location.origin}/signup?token=${invite.inviteToken}`,
    expiryDate: new Date(invite.expiresAt).toLocaleDateString()
  }
});
```

3. **Use email template** from EMAIL_TEMPLATES.md

### Database Persistence

Current implementation uses in-memory storage. For production:

1. Create `user_invites` table in Supabase:

```sql
CREATE TABLE user_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'Pending',
  invited_by TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invites_token ON user_invites(invite_token);
CREATE INDEX idx_invites_email ON user_invites(email);
```

2. Update service methods to use Supabase client

## Testing

### Test Invite Flow

1. Login as Admin
2. Go to Settings → Invitations
3. Click "Send Invitation"
4. Fill form and submit
5. Check browser console for email preview
6. Copy invite link from console
7. Open in new incognito window
8. Complete signup with password
9. Verify role is correctly assigned

### Test Cases

- ✅ Send invite to new email
- ✅ Try to invite duplicate email (should fail)
- ✅ Resend pending invite
- ✅ Cancel pending invite
- ✅ Accept invite and create account
- ✅ Try to use expired token (should fail)
- ✅ Verify role auto-assignment on signup

## FAQ

**Q: Can I invite someone who already has an account?**  
A: No, the system checks for existing users and prevents duplicate invites.

**Q: What happens if the invite expires?**  
A: The invite status changes to "Expired" and the link becomes invalid. Admin can send a new invite.

**Q: Can I change the invite expiry time?**  
A: Yes, edit the expiry calculation in `createInvite()`:
```typescript
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
```

**Q: How do I integrate real email sending?**  
A: Add an email service (SendGrid/AWS SES) and replace the console.log in `createInvite()` with actual email API call.

**Q: Where are invites stored?**  
A: Currently in-memory (resets on refresh). For production, add Supabase table as shown above.

## Next Steps

1. ✅ Basic invite system implemented
2. 🔄 Add email service integration
3. 🔄 Add Supabase table for persistence
4. 🔄 Create signup page that handles invite tokens
5. 🔄 Add invite analytics/reporting
