'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Globe, ShieldCheck, CalendarPlus, Upload, Zap } from 'lucide-react';
import type { GoFurtherProgress } from '@/lib/dashboard/onboarding';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface GoFurtherProps {
  progress: GoFurtherProgress;
}

const steps = [
  {
    key: 'hasPortalEnabled' as const,
    label: 'Enable the client portal',
    description: 'Let clients upload documents directly via a secure link — no email attachments needed',
    href: '/settings',
    icon: Upload,
    color: 'blue',
  },
  {
    key: 'hasCustomDomain' as const,
    label: 'Send from your own domain',
    description: 'Set up a custom sending domain so reminder emails come from your practice address',
    href: '/settings?tab=email',
    icon: Globe,
    color: 'violet',
  },
  {
    key: 'hasUploadChecks' as const,
    label: 'Turn on upload checks',
    description: 'Automatically verify and classify documents when clients upload them via the portal',
    href: '/settings',
    icon: ShieldCheck,
    color: 'emerald',
  },
  {
    key: 'hasCustomSchedule' as const,
    label: 'Create a custom schedule',
    description: 'Set up your own recurring deadline beyond the built-in UK filing types',
    href: '/deadlines',
    icon: CalendarPlus,
    color: 'amber',
  },
];

const STORAGE_KEY = 'go-further-progress';

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

export function GoFurther({ progress }: GoFurtherProps) {
  const router = useRouter();
  const hasShownToasts = useRef(false);
  const completedCount = steps.filter((s) => progress[s.key]).length;

  // Detect newly completed steps and show toast notifications
  useEffect(() => {
    if (hasShownToasts.current) return;
    hasShownToasts.current = true;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const prev: Record<string, boolean> = stored ? JSON.parse(stored) : {};

      const newlyCompleted = steps.filter(
        (s) => progress[s.key] && !prev[s.key]
      );

      // Save current state
      const current: Record<string, boolean> = {};
      for (const s of steps) current[s.key] = progress[s.key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

      for (const step of newlyCompleted) {
        const nowComplete = steps.every((s) => current[s.key]);

        if (nowComplete) {
          toast.success('All advanced features enabled!', {
            description: 'You\'ve unlocked everything Prompt has to offer.',
            duration: 6000,
          });
          break;
        }

        toast.success(`Enabled: ${step.label}`, {
          description: `${completedCount}/${steps.length} features activated`,
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
        <div className="flex items-start justify-between mb-7">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Go Further
            </p>
            <p className="text-sm font-medium text-muted-foreground mt-1.5">
              {completedCount}/{steps.length} enabled
            </p>
          </div>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Zap className="size-6 text-blue-500" />
          </div>
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
      </CardContent>
    </Card>
  );
}
