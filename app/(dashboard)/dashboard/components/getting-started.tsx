'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, UserPlus, FileText, Send, ExternalLink } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/dashboard/onboarding';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface GettingStartedProps {
  progress: OnboardingProgress;
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

const STORAGE_KEY = 'onboarding-progress';

const colorMap: Record<string, { bg: string; bgHover: string; text: string }> = {
  blue: {
    bg: 'bg-blue-500/10',
    bgHover: 'group-hover/step:bg-blue-500/20',
    text: 'text-blue-500',
  },
  violet: {
    bg: 'bg-violet-500/10',
    bgHover: 'group-hover/step:bg-violet-500/20',
    text: 'text-violet-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    bgHover: 'group-hover/step:bg-emerald-500/20',
    text: 'text-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    bgHover: 'group-hover/step:bg-amber-500/20',
    text: 'text-amber-500',
  },
};

export function GettingStarted({ progress }: GettingStartedProps) {
  const router = useRouter();
  const hasShownToasts = useRef(false);
  const completedCount = steps.filter((s) => progress[s.key]).length;
  const allComplete = completedCount === steps.length;

  // Detect newly completed steps and show toast notifications
  useEffect(() => {
    if (hasShownToasts.current) return;
    hasShownToasts.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const prev: Record<string, boolean> = stored ? JSON.parse(stored) : {};

      // Find steps that are now complete but weren't before
      const newlyCompleted = steps.filter(
        (s) => progress[s.key] && !prev[s.key]
      );

      // Save current state
      const current: Record<string, boolean> = {};
      for (const s of steps) current[s.key] = progress[s.key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

      // Show toasts for newly completed steps
      for (const step of newlyCompleted) {
        const nowComplete = steps.every((s) => current[s.key]);

        if (nowComplete) {
          toast.success('All steps complete!', {
            description: 'You\'ve finished setting up Prompt. You\'re ready to go!',
            duration: 6000,
          });
          break; // Don't show individual toasts if all complete
        }

        toast.success(`Step complete: ${step.label}`, {
          description: `${completedCount}/${steps.length} steps done`,
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
  }, [progress, completedCount, router]);

  return (
    <Card className="py-5">
      <CardContent className="px-5 py-0">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Getting Started
          </p>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{steps.length} complete
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step) => {
            const done = progress[step.key];
            const colors = colorMap[step.color];
            const Icon = step.icon;

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
                    <div
                      className={`size-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                        done
                          ? 'bg-green-500/10'
                          : `${colors.bg} ${colors.bgHover}`
                      }`}
                    >
                      {done ? (
                        <Check className="size-5 text-green-600" strokeWidth={2.5} />
                      ) : (
                        <Icon className={`size-5 ${colors.text}`} />
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {allComplete && (
          <p className="text-sm text-muted-foreground text-center pt-4">
            You&apos;re all set! You can dismiss this section.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
