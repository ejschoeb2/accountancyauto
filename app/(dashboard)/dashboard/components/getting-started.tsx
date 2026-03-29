'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ClipboardCheck, FileText, ListChecks, Send, Rocket, BookOpen } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/dashboard/onboarding';
import { markOnboardingComplete } from '@/app/actions/settings';
import Link from 'next/link';
import { toast } from 'sonner';


interface GettingStartedProps {
  progress: OnboardingProgress;
  onDismiss: () => void;
}

const steps = [
  {
    key: 'hasVisitedGuides' as const,
    label: 'Browse the guides',
    description: 'Explore tutorials, articles, and walkthroughs to learn how Prompt works.',
    href: '/guides',
    icon: BookOpen,
  },
  {
    key: 'hasReadGettingStarted' as const,
    label: 'Read the Getting Started guide',
    description: 'A step-by-step walkthrough of setting up your organisation, adding clients, and sending your first reminders.',
    href: '/guides/getting-started-with-prompt',
    icon: Rocket,
  },
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
        });
      }
    } catch {
      // localStorage unavailable — skip
    }
  }, [progress, completedCount, totalCount]);

  return (
    <Card className="py-5">
      <CardContent className="px-5 py-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Getting Started
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-1.5">
              {allComplete
                ? `${totalCount}/${totalCount} — all done!`
                : `Step ${Math.min(currentStepIndex + 1, totalCount)} of ${totalCount}`}
            </p>
          </div>
          {allComplete ? (
            <button
              onClick={handleDismiss}
              disabled={dismissing}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-600 px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            >
              <Check className="size-4" strokeWidth={2.5} />
              Complete setup
            </button>
          ) : (
            <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Rocket className="size-6 text-green-600" />
            </div>
          )}
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
                {/* Vertical line + indicator */}
                <div className="flex flex-col items-center">
                  {/* Step indicator */}
                  <div
                    className={`relative z-10 flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-all duration-300 ${
                      done
                        ? 'bg-green-500/10'
                        : isCurrent
                        ? 'bg-green-500/10'
                        : 'bg-muted'
                    }`}
                  >
                    {done ? (
                      <Check className="size-4 text-green-600" strokeWidth={2.5} />
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
                        done ? 'bg-green-500/30' : 'bg-muted-foreground/15'
                      }`}
                    />
                  )}
                </div>

                {/* Step content */}
                <div className={`pb-6 ${isLast ? 'pb-0' : ''} flex-1 min-w-0`}>
                  {isCurrent ? (
                    /* Expanded current step */
                    <Link href={step.href} className="block group">
                      <div className="rounded-lg border p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-sm">
                        <p className="text-sm font-semibold text-foreground">
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </Link>
                  ) : done ? (
                    /* Completed step — clickable but muted */
                    <Link href={step.href} className="block group">
                      <div className="h-9 flex items-center transition-colors">
                        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                          {step.label}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    /* Future locked step */
                    <div className="h-9 flex items-center">
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
