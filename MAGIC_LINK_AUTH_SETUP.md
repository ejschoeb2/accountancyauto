# Magic Link Authentication Setup

## What Changed

Successfully replaced QuickBooks OAuth with magic link authentication using Supabase Auth.

### Files Modified

1. **app/(auth)/login/page.tsx** - Replaced QuickBooks login with magic link email form
2. **app/(auth)/login/actions.ts** - Added `sendMagicLink()` server action
3. **app/(auth)/auth/callback/route.ts** - New callback handler for magic links
4. **lib/supabase/middleware.ts** - Updated public routes to include `/auth/callback`

### Files Fixed (Build Issues)

- **components/ui/alert-dialog.tsx** - Added missing shadcn component
- **app/(dashboard)/clients/components/csv-import-dialog.tsx** - Fixed TypeScript type error

## How It Works

1. User visits `/login`
2. User enters their email address
3. Supabase sends them a magic link email
4. User clicks link → redirected to `/auth/callback`
5. Callback exchanges code for session → redirects to `/` (root)
6. Root page checks onboarding status and routes appropriately

## Demo Mode

The demo login option is preserved:
- Email: `demo@peninsula-internal.local`
- Password: `demo-peninsula-2026-secure`

## Configuration Required

### 1. Supabase Email Settings

You need to configure email sending in Supabase:

**Option A: Use Supabase's built-in email (development)**
- Already works for testing
- Limited to a few emails per hour
- Sent from `noreply@mail.app.supabase.io`

**Option B: Use Custom SMTP (production)**
- Go to Supabase Dashboard → Authentication → Email Templates
- Click "Email Provider" and configure custom SMTP
- Use your existing Postmark credentials:
  - SMTP Server: `smtp.postmarkapp.com`
  - Port: `587`
  - Username: Your Postmark Server Token
  - Password: Your Postmark Server Token (same as username)
  - Sender Email: `reminders@peninsulaaccounting.co.uk`

### 2. Environment Variables

Already configured in `.env.local`:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production deployment, update this to your production URL.

### 3. Supabase Redirect URLs

Add the callback URL to your Supabase project's allowed redirect URLs:

1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add to "Redirect URLs":
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

## User Management

### Creating New Users

Users are automatically created when they first use a magic link.

### Revoking Access

To revoke a user's access:
1. Go to Supabase Dashboard → Authentication → Users
2. Find the user by email
3. Click "..." → "Delete user"

Or disable their account:
1. Click "..." → "Ban user"

## Testing

1. Start the dev server: `npm run dev`
2. Visit `http://localhost:3000/login`
3. Enter your email
4. Check your inbox for the magic link (or check Supabase logs if using built-in email)
5. Click the link → should redirect to dashboard

## Removed QuickBooks Code

All QuickBooks integration code has been removed:
- ✅ Deleted `lib/quickbooks/` directory
- ✅ Deleted `app/actions/quickbooks.ts`
- ✅ Deleted `app/(auth)/onboarding/callback/route.ts`
- ✅ Deleted `components/qbo-status-banner.tsx`
- ✅ Deleted QuickBooks type definitions
- ✅ Removed QuickBooks from settings page
- ✅ Removed `intuit-oauth` and `node-quickbooks` npm packages
- ✅ Removed QuickBooks environment variables

**Note:** The `quickbooks_id` field remains in the database schema for backwards compatibility with existing data, but is no longer used.

## Security Notes

- Magic links expire after a configurable time (default: 1 hour)
- Each link can only be used once
- Sessions are managed by Supabase with automatic refresh tokens
- Users must have access to their email to log in (no password to leak)
