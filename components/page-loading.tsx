"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { LoadingScreen } from "./loading-screen";

type TrackLoadingFn = (key: string, isLoading: boolean) => void;

const PageLoadingContext = createContext<TrackLoadingFn | null>(null);

export function PageLoadingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  const trackLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingKeys((prev) => {
      const next = new Set(prev);
      if (isLoading) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const isLoading = loadingKeys.size > 0;

  return (
    <PageLoadingContext.Provider value={trackLoading}>
      {isLoading && <LoadingScreen />}
      <div className={isLoading ? "invisible" : "animate-fade-in"}>
        {children}
      </div>
    </PageLoadingContext.Provider>
  );
}

/**
 * Register a component's initial loading state with the page loading provider.
 * While any registered component is loading, the full-page LoadingScreen is shown.
 * Only tracks the first load — subsequent fetches (pagination, filtering) are not tracked.
 */
export function usePageLoading(key: string, isLoading: boolean) {
  const trackLoading = useContext(PageLoadingContext);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (!trackLoading) return;

    // Only track until the first load completes
    if (hasCompletedRef.current) return;

    if (!isLoading) {
      hasCompletedRef.current = true;
    }

    trackLoading(key, isLoading);

    return () => {
      trackLoading(key, false);
    };
  }, [trackLoading, key, isLoading]);
}
