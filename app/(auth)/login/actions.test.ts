/**
 * Auth flow tests (AUDIT-041)
 *
 * The signIn / signUp server actions call Supabase auth and Next.js redirect(),
 * which throws a special NEXT_REDIRECT error in the framework. We mock both
 * `@/lib/supabase/server` and `next/navigation` so we can test the happy-path
 * and error-path branches without a real Supabase instance or HTTP stack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before any dynamic imports
// ---------------------------------------------------------------------------

// next/cache and next/headers are used by the actions but don't affect logic
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Capture redirect calls rather than throwing
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));

// Supabase client mock — we'll customise per test via mockSupabase
const mockSignInWithPassword = vi.fn();
const mockGetSession = vi.fn();
const mockSignUp = vi.fn();
const mockUpdateUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      getSession: mockGetSession,
      signUp: mockSignUp,
      updateUser: mockUpdateUser,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
    from: mockFrom,
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    auth: { admin: { createUser: vi.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }) } },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal Supabase session object with org_id in app_metadata. */
function makeSession(orgId: string) {
  return {
    data: {
      session: {
        user: {
          id: 'user-1',
          app_metadata: { org_id: orgId },
        },
      },
    },
  };
}

/** A chainable Supabase query builder stub. */
function makeQueryStub(resolvedValue: unknown) {
  const stub = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    update: vi.fn().mockReturnThis(),
  };
  return stub;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Actions (AUDIT-041)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://prompt.accountants';
    process.env.NODE_ENV = 'test';
  });

  // Import actions lazily so mocks are in place first
  async function getActions() {
    const mod = await import('./actions');
    return mod;
  }

  describe('signIn', () => {
    it('returns an error object when credentials are invalid', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Invalid login credentials' },
      });

      const { signIn } = await getActions();
      const result = await signIn('bad@example.com', 'wrongpassword');

      expect(result).toEqual({ error: 'Incorrect email or password.' });
    });

    it('returns a generic error for non-credential Supabase errors', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: 'Network error' },
      });

      const { signIn } = await getActions();
      const result = await signIn('user@example.com', 'password');

      expect(result).toEqual({ error: 'Failed to sign in. Please try again.' });
    });

    it('redirects to /setup/wizard when org setup is incomplete', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue(makeSession('org-123'));

      const orgQueryStub = makeQueryStub({ data: { slug: 'acme', setup_complete: false }, error: null });
      mockFrom.mockReturnValue(orgQueryStub);

      const { signIn } = await getActions();
      await signIn('user@example.com', 'password');

      expect(mockRedirect).toHaveBeenCalledWith('/setup/wizard');
    });

    it('redirects to /dashboard with org slug in dev mode when setup is complete', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      mockGetSession.mockResolvedValue(makeSession('org-456'));

      const orgQueryStub = makeQueryStub({ data: { slug: 'acme', setup_complete: true }, error: null });
      mockFrom.mockReturnValue(orgQueryStub);

      // Force dev mode redirect branch
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string>).NODE_ENV = 'development';

      const { signIn } = await getActions();
      await signIn('user@example.com', 'password');

      expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('/dashboard'));

      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    });

    it('redirects to /setup/wizard when no org is found for the user', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      // No org_id in JWT
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: 'user-1', app_metadata: {} } } },
      });
      // Fallback query also returns nothing
      const emptyStub = makeQueryStub({ data: null, error: null });
      mockFrom.mockReturnValue(emptyStub);

      const { signIn } = await getActions();
      await signIn('newuser@example.com', 'password');

      expect(mockRedirect).toHaveBeenCalledWith('/setup/wizard');
    });

    it('redirects to the invite accept page when inviteToken is provided and sign-in succeeds', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });
      // With an inviteToken we redirect immediately without touching session
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { signIn } = await getActions();
      await signIn('user@example.com', 'password', 'my-invite-token');

      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining('/invite/accept?token=')
      );
    });
  });

  describe('signUp', () => {
    it('returns success: true when sign-up triggers email confirmation', async () => {
      mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

      const { signUp } = await getActions();
      const result = await signUp('new@example.com', 'Password123!');

      expect(result).toEqual({ success: true });
    });

    it('returns an error when email is already registered', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'User already registered', status: 400 },
      });

      const { signUp } = await getActions();
      const result = await signUp('existing@example.com', 'Password123!');

      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toMatch(/already exists/i);
    });

    it('returns an error for rate limiting (429)', async () => {
      mockSignUp.mockResolvedValue({
        data: {},
        error: { message: 'rate limit exceeded', status: 429 },
      });

      const { signUp } = await getActions();
      const result = await signUp('user@example.com', 'Password123!');

      expect((result as { error: string }).error).toMatch(/too many/i);
    });
  });

  describe('forgotPassword', () => {
    it('returns success: true when the reset email is sent', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const { forgotPassword } = await getActions();
      const result = await forgotPassword('user@example.com');

      expect(result).toEqual({ success: true });
    });

    it('returns an error when Supabase fails to send the reset email', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'SMTP error' } });

      const { forgotPassword } = await getActions();
      const result = await forgotPassword('user@example.com');

      expect(result).toHaveProperty('error');
    });
  });
});
