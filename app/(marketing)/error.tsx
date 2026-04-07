'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-gray-500">An unexpected error occurred. Our team has been notified.</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm border rounded hover:bg-gray-50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
