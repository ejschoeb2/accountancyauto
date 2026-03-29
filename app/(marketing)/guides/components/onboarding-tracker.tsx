'use client';

import { useEffect, useRef } from 'react';
import { markGuidesVisited, markGettingStartedRead } from '@/app/actions/settings';

/**
 * Fire-and-forget onboarding step tracker for marketing guide pages.
 * Calls the server action once on mount; silently fails if unauthenticated.
 */
export function OnboardingTracker({ step }: { step: 'guides' | 'getting-started' }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const action = step === 'guides' ? markGuidesVisited : markGettingStartedRead;
    action().catch(() => {});
  }, [step]);

  return null;
}
