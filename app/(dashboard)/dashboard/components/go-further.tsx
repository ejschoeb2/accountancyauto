'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Check, Globe, ShieldCheck, CalendarPlus, Upload, Zap } from 'lucide-react';
import type { GoFurtherProgress } from '@/lib/dashboard/onboarding';
import Link from 'next/link';

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

export function GoFurther({ progress }: GoFurtherProps) {
  const completedCount = steps.filter((s) => progress[s.key]).length;

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
      </CardContent>
    </Card>
  );
}
