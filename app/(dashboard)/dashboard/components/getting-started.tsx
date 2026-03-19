'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ClipboardCheck, FileText, ListChecks, Send, Rocket, ArrowRight } from 'lucide-react';
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
    key: 'hasReviewedProgress' as const,
    label: 'Review client progress',
    description: 'Check each client\'s deadline status and mark any documents already received.',
    href: '/clients?view=deadlines&editProgress=true',
    icon: ClipboardCheck,
  },
  {
    key: 'hasCheckedTemplates' as const,
    label: 'Check reminder schedules & email templates',
    description: 'Review the default reminder schedules and email templates — customise them to match your practice.',
    href: '/templates',
    icon: FileText,
  },
  {
    key: 'hasCheckedQueue' as const,
    label: 'Check queued emails',
    description: 'See which reminder emails are queued for your clients before they go out.',
    href: '/activity',
    icon: ListChecks,
  },
  {
    key: 'hasEmailSent' as const,
    label: 'Send your first reminder',
    description: 'Send a deadline reminder email to one of your clients from the queue.',
    href: '/activity?view=queued',
    icon: Send,
  },
];

type StepKey = (typeof steps)[number]['key'];

const STORAGE_KEY = 'onboarding-progress';

export function GettingStarted({ progress, onDismiss }: GettingStartedProps) {
  const router = useRouter();
  const hasShownToasts = useRef(false);
  const [dismissing, setDismissing] = useState(false);

  const completedCount = steps.filter((s) => progress[s.key]).length;
  const totalCount = steps.length;
  const allComplete = completedCount === totalCount;

  // Find the current (first incomplete) step index
  const currentStepIndex = steps.findIndex((s) => !progress[s.key]);

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

      const current: Record<string, boolean> = {};
      for (const s of steps) current[s.key] = progress[s.key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

      for (const step of newlyCompleted) {
        const nowComplete = steps.every((s) => current[s.key]);

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

  return (
    <Card className="py-5">
      <CardContent className="px-5 py-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Rocket className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Getting Started
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Step {allComplete ? totalCount : Math.min(currentStepIndex + 1, totalCount)} of {totalCount}
                {allComplete && ' — all done!'}
              </p>
            </div>
          </div>
          {allComplete && (
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="size-4" strokeWidth={2.5} />
              Complete setup
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted mb-6 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Vertical stepper */}
        <div className="relative">
          {steps.map((step, index) => {
            const done = progress[step.key];
            const isCurrent = index === currentStepIndex;
            const isFuture = !done && !isCurrent;
            const isLast = index === steps.length - 1;
            const Icon = step.icon;

            return (
              <div key={step.key} className="relative flex gap-4">
                {/* Vertical line + circle */}
                <div className="flex flex-col items-center">
                  {/* Step circle */}
                  <div
                    className={`relative z-10 flex items-center justify-center size-8 rounded-full border-2 shrink-0 transition-all duration-300 ${
                      done
                        ? 'bg-green-500 border-green-500'
                        : isCurrent
                        ? 'bg-background border-green-500'
                        : 'bg-background border-muted-foreground/20'
                    }`}
                  >
                    {done ? (
                      <Check className="size-4 text-white" strokeWidth={2.5} />
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent ? 'text-green-600' : 'text-muted-foreground/40'
                        }`}
                      >
                        {index + 1}
                      </span>
                    )}
                  </div>
                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-4 transition-colors duration-300 ${
                        done ? 'bg-green-500' : 'bg-muted-foreground/15'
                      }`}
                    />
                  )}
                </div>

                {/* Step content */}
                <div className={`pb-6 ${isLast ? 'pb-0' : ''} flex-1 min-w-0`}>
                  {isCurrent ? (
                    /* Expanded current step */
                    <Link href={step.href} className="block group">
                      <div className="rounded-lg border border-green-500/30 bg-green-500/[0.04] p-4 transition-all duration-200 hover:bg-green-500/[0.08] hover:border-green-500/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {step.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                              {step.description}
                            </p>
                          </div>
                          <div className="size-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 group-hover:bg-green-500/20 transition-colors">
                            <ArrowRight className="size-4 text-green-600" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ) : done ? (
                    /* Completed step — clickable but muted */
                    <Link href={step.href} className="block group">
                      <div className="py-1.5 transition-colors">
                        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          {step.label}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    /* Future locked step */
                    <div className="py-1.5">
                      <p className="text-sm font-medium text-muted-foreground/40">
                        {step.label}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
