"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  steps: { label: string }[];
  currentStep: number; // 0-indexed
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-start justify-center w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;

        return (
          <div key={index} className="flex items-start">
            {/* Step indicator + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex items-center justify-center size-9 rounded-lg text-xs font-semibold transition-all duration-200",
                  isCompleted && "bg-green-500/10 text-green-600",
                  isCurrent && "bg-violet-500/10 text-violet-500",
                  isFuture && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
                  isCompleted && "text-green-600",
                  isCurrent && "text-foreground",
                  isFuture && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line (not after last step) */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-12 sm:w-20 mx-2 mt-[18px] flex-shrink-0 transition-colors duration-200",
                  index < currentStep ? "bg-green-500" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
