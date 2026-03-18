'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, UserPlus, FileText, Send, ExternalLink, Rocket, ClipboardCheck, AlertTriangle } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/dashboard/onboarding';
import { markOnboardingComplete } from '@/app/actions/settings';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface GettingStartedProps {
  progress: OnboardingProgress;
  onDismiss: () => void;
}

const steps = [
  {
    key: 'hasClient' as const,
    label: 'Add your first client',
    description: 'Import a CSV or manually create your first client record to start tracking their deadlines',
    href: '/clients',
    icon: UserPlus,
    color: 'blue',
  },
  {
    key: 'hasEmailTemplate' as const,
    label: 'Create an email template',
    description: 'Build a custom reminder template with your practice branding and preferred wording',
    href: '/templates',
    icon: FileText,
    color: 'violet',
  },
  {
    key: 'hasEmailSent' as const,
    label: 'Send your first reminder',
    description: 'Send a deadline reminder email to one of your clients via the reminders queue',
    href: '/clients',
    icon: Send,
    color: 'emerald',
  },
  {
    key: 'hasPortalLink' as const,
    label: 'Share a client portal link',
    description: 'Generate a secure document upload link and share it with a client to collect records',
    href: '/clients',
    icon: ExternalLink,
    color: 'amber',
  },
];

const allStepKeys = ['hasReviewedProgress', ...steps.map((s) => s.key)] as const;

const STORAGE_KEY = 'onboarding-progress';

export function GettingStarted({ progress, onDismiss }: GettingStartedProps) {
  const router = useRouter();
  const hasShownToasts = useRef(false);
  const [dismissing, setDismissing] = useState(false);
  const completedCount =
    steps.filter((s) => progress[s.key]).length + (progress.hasReviewedProgress ? 1 : 0);
  const totalCount = steps.length + 1;
  const allComplete = completedCount === totalCount;

  async function handleDismiss() {
    setDismissing(true);
    const result = await markOnboardingComplete();
    if (result.error) {
      toast.error('Failed to dismiss');
      setDismissing(false);
      return;
    }
    onDismiss();
  }

  useEffect(() => {
    if (hasShownToasts.current) return;
    hasShownToasts.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const prev: Record<string, boolean> = stored ? JSON.parse(stored) : {};

      const newlyCompleted = steps.filter(
        (s) => progress[s.key] && !prev[s.key]
      );

      // Check if progress review was newly completed
      const progressReviewNewlyComplete =
        progress.hasReviewedProgress && !prev.hasReviewedProgress;

      const current: Record<string, boolean> = {
        hasReviewedProgress: progress.hasReviewedProgress,
      };
      for (const s of steps) current[s.key] = progress[s.key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

      const allNewlyCompleted = [
        ...(progressReviewNewlyComplete
          ? [{ label: 'Review client progress' }]
          : []),
        ...newlyCompleted,
      ];

      for (const step of allNewlyCompleted) {
        const nowComplete = allStepKeys.every(
          (k) => current[k]
        );

        if (nowComplete) {
          toast.success('All steps complete!', {
            description: 'You\'ve finished setting up Prompt. You\'re ready to go!',
            duration: 6000,
          });
          break;
        }

        toast.success(`Step complete: ${step.label}`, {
          description: `${completedCount}/${totalCount} steps done`,
          duration: 5000,
          action: {
            label: 'Back to dashboard',
            onClick: () => router.push('/dashboard'),
          },
        });
      }
    } catch {
      // localStorage unavailable — skip
    }
  }, [progress, completedCount, totalCount, router]);

  const progressReviewDone = progress.hasReviewedProgress;

  return (
    <Card className="py-5">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Getting Started
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-1.5">
              {completedCount}/{totalCount} complete
            </p>
          </div>
          {allComplete ? (
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="size-4" strokeWidth={2.5} />
              Complete getting started
            </button>
          ) : (
            <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Rocket className="size-6 text-green-600" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Review client progress — full width */}
          <Link href="/clients?view=deadlines&editProgress=true">
            <div
              className={`group/step rounded-lg border p-4 transition-all duration-200 cursor-pointer ${
                progressReviewDone
                  ? 'bg-muted/30 hover:bg-muted/50'
                  : 'hover:bg-muted/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 pr-3">
                  <p
                    className={`text-sm font-semibold leading-tight ${
                      progressReviewDone ? 'text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    Review client progress
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Check each client&apos;s deadline status and mark any documents already received before sending reminders
                  </p>
                  {!progressReviewDone && (
                    <div className="flex items-center gap-2 mt-3 text-amber-600">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <p className="text-xs font-medium">
                        Review client progress before sending reminders to avoid incorrect notifications
                      </p>
                    </div>
                  )}
                </div>
                {progressReviewDone ? (
                  <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-green-500/10">
                    <Check className="size-5 text-green-600" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/10">
                    <ClipboardCheck className="size-5 text-amber-600" />
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Other steps — 2x2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((step) => {
              const done = progress[step.key];

              return (
                <Link key={step.key} href={step.href}>
                  <div
                    className={`group/step rounded-lg border p-4 transition-all duration-200 cursor-pointer h-full ${
                      done
                        ? 'bg-muted/30 hover:bg-muted/50'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <p
                          className={`text-sm font-semibold leading-tight ${
                            done ? 'text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      {done && (
                        <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-green-500/10">
                          <Check className="size-5 text-green-600" strokeWidth={2.5} />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
