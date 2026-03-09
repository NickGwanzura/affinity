# Email Templates for Affinity Logistics

Copy these templates into your Supabase Dashboard → Authentication → Email Templates

---

## 1. Confirm Signup (Email Verification)

**Subject:** Welcome to Affinity Logistics - Verify Your Email

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #2563EB; }
    .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚚 Affinity Logistics</h1>
    </div>
    <div class="content">
      <h2>Welcome to Affinity Logistics!</h2>
      <p>Thank you for signing up. We're excited to have you on board.</p>
      <p>To get started with our logistics management platform, please verify your email address by clicking the button below:</p>
      <p style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Verify Email Address</a>
      </p>
      <p style="color: #6B7280; font-size: 14px;">
        Or copy and paste this link into your browser:<br>
        <code style="background: #F3F4F6; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px;">{{ .ConfirmationURL }}</code>
      </p>
      <p style="margin-top: 30px;">
        <strong>What's next?</strong><br>
        Once verified, you'll have access to:
      </p>
      <ul>
        <li>Vehicle tracking and management</li>
        <li>Expense logging across currencies</li>
        <li>Professional quotes & invoices</li>
        <li>AI-powered fleet insights</li>
      </ul>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© 2026 Affinity Logistics Ltd. All rights reserved.</p>
      <p>12 Logistics Way, Southampton, UK | +44 20 7946 0958</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Invite User (Team Member Invitation)

**Subject:** You've Been Invited to Affinity Logistics

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #10B981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #059669; }
    .badge { background: #DBEAFE; color: #1E40AF; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Join Our Team!</h1>
    </div>
    <div class="content">
      <h2>Welcome to Affinity Logistics</h2>
      <p>You've been invited to join the Affinity Logistics team as a member of our logistics management platform.</p>
      
      <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Your Account Details:</strong></p>
        <p style="margin: 10px 0 0 0;">Email: <strong>{{ .Email }}</strong></p>
      </div>

      <p>Click the button below to set your password and access the platform:</p>
      <p style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Accept Invitation & Set Password</a>
      </p>
      
      <p style="color: #6B7280; font-size: 14px;">
        Or copy and paste this link:<br>
        <code style="background: #F3F4F6; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">{{ .ConfirmationURL }}</code>
      </p>

      <p style="margin-top: 30px;">
        <strong>Platform Features:</strong>
      </p>
      <ul>
        <li>Real-time vehicle tracking</li>
        <li>Multi-currency expense management</li>
        <li>Automated quotes & invoices</li>
        <li>Comprehensive financial reporting</li>
        <li>Team collaboration tools</li>
      </ul>

      <p style="color: #DC2626; font-size: 14px; background: #FEE2E2; padding: 12px; border-radius: 6px; margin-top: 20px;">
        ⚠️ <strong>Important:</strong> This invitation link expires in 24 hours. If it expires, please contact your administrator for a new invitation.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Affinity Logistics Ltd. All rights reserved.</p>
      <p>Questions? Contact us at hq@affinity-logistics.com</p>
    </div>
  </div>
</body>
</html>
```

---

## 3. Magic Link (Passwordless Login)

**Subject:** Your Affinity Logistics Login Link

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #8B5CF6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #7C3AED; }
    .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Secure Login</h1>
    </div>
    <div class="content">
      <h2>Your Login Link is Ready</h2>
      <p>Hello,</p>
      <p>You requested a magic link to sign in to Affinity Logistics. Click the button below to log in instantly:</p>
      <p style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Sign In to Affinity Logistics</a>
      </p>
      
      <p style="color: #6B7280; font-size: 14px;">
        Or use this link:<br>
        <code style="background: #F3F4F6; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">{{ .ConfirmationURL }}</code>
      </p>

      <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #F59E0B;">
        <p style="margin: 0; color: #92400E;">
          <strong>⏱️ Security Notice:</strong><br>
          This link expires in 60 minutes for your security. If you didn't request this login, please ignore this email.
        </p>
      </div>

      <p style="font-size: 14px; color: #6B7280;">
        Logging in from: <strong>{{ .Email }}</strong>
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Affinity Logistics Ltd. All rights reserved.</p>
      <p>Secure logistics management platform</p>
    </div>
  </div>
</body>
</html>
```

---

## 4. Reset Password

**Subject:** Reset Your Affinity Logistics Password

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #EF4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #DC2626; }
    .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Password Reset</h1>
    </div>
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>Hello,</p>
      <p>We received a request to reset the password for your Affinity Logistics account.</p>
      <p>Click the button below to choose a new password:</p>
      <p style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Reset My Password</a>
      </p>
      
      <p style="color: #6B7280; font-size: 14px;">
        Or copy and paste this link:<br>
        <code style="background: #F3F4F6; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">{{ .ConfirmationURL }}</code>
      </p>

      <div style="background: #FEE2E2; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #EF4444;">
        <p style="margin: 0; color: #991B1B;">
          <strong>⚠️ Security Alert:</strong><br>
          This link expires in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned about account security.
        </p>
      </div>

      <p style="font-size: 14px; color: #6B7280;">
        <strong>Password Security Tips:</strong>
      </p>
      <ul style="font-size: 14px; color: #6B7280;">
        <li>Use at least 8 characters</li>
        <li>Include uppercase and lowercase letters</li>
        <li>Add numbers and special characters</li>
        <li>Don't reuse passwords from other accounts</li>
      </ul>

      <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
        Account: <strong>{{ .Email }}</strong>
      </p>
    </div>
    <div class="footer">
      <p>© 2026 Affinity Logistics Ltd. All rights reserved.</p>
      <p>Need help? Contact support at hq@affinity-logistics.com</p>
    </div>
  </div>
</body>
</html>
```

---

## 5. Change Email Address

**Subject:** Confirm Your New Email Address - Affinity Logistics

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { background: white; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #F59E0B; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .button:hover { background: #D97706; }
    .footer { text-align: center; color: #6B7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Email Change Request</h1>
    </div>
    <div class="content">
      <h2>Confirm Your New Email Address</h2>
      <p>Hello,</p>
      <p>You've requested to change the email address associated with your Affinity Logistics account.</p>
      
      <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>New Email Address:</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #3B82F6;"><strong>{{ .Email }}</strong></p>
      </div>

      <p>To complete this change, please confirm your new email address by clicking the button below:</p>
      <p style="text-align: center;">
        <a href="{{ .ConfirmationURL }}" class="button">Confirm Email Change</a>
      </p>
      
      <p style="color: #6B7280; font-size: 14px;">
        Or use this link:<br>
        <code style="background: #F3F4F6; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">{{ .ConfirmationURL }}</code>
      </p>

      <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #F59E0B;">
        <p style="margin: 0; color: #92400E;">
          <strong>⚠️ Important:</strong><br>
          If you didn't request this email change, please contact our support team immediately. Someone may be trying to access your account.
        </p>
      </div>

      <p style="font-size: 14px; color: #6B7280;">
        <strong>What happens after confirmation:</strong>
      </p>
      <ul style="font-size: 14px; color: #6B7280;">
        <li>Your new email will be used for login</li>
        <li>All notifications will be sent to this address</li>
        <li>Your account settings will be updated</li>
      </ul>
    </div>
    <div class="footer">
      <p>© 2026 Affinity Logistics Ltd. All rights reserved.</p>
      <p>Contact support: hq@affinity-logistics.com | +44 20 7946 0958</p>
    </div>
  </div>
</body>
</html>
```

---

## How to Apply These Templates

1. Go to: https://bujvjyucylvdwgdkcxvj.supabase.co
2. Navigate to: **Authentication** → **Email Templates**
3. Select each template type
4. Copy the corresponding HTML from above
5. Paste into the template editor
6. Update the subject line
7. Click **Save**
8. Test by creating a test user

## Customization Tips

- Replace company details in footers with your actual information
- Add your company logo URL in the header section
- Adjust colors to match your brand (search for hex codes like `#3B82F6`)
- Modify expiration times based on your security requirements
- Add additional links to your website, support, or knowledge base

## Color Scheme Used

- **Blue** (#3B82F6) - Signup/Verification
- **Green** (#10B981) - Invitations
- **Purple** (#8B5CF6) - Magic Link
- **Red** (#EF4444) - Password Reset
- **Orange** (#F59E0B) - Email Change
