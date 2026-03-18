"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  steps: { label: string }[];
  currentStep: number; // 0-indexed
  onStepClick?: (index: number) => void; // called when a completed step is clicked
}

export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start justify-center min-w-0 px-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;
          const isClickable = isCompleted && !!onStepClick;

          return (
            <div key={index} className="flex items-start">
              {/* Step indicator + label */}
              <div
                className={cn(
                  "flex flex-col items-center gap-1 sm:gap-1.5",
                  isClickable && "cursor-pointer group"
                )}
                onClick={() => isClickable && onStepClick(index)}
              >
                <div
                  className={cn(
                    "flex items-center justify-center size-7 sm:size-9 rounded-lg text-xs font-semibold transition-all duration-200",
                    isCompleted && "bg-green-500/10 text-green-600",
                    isCompleted && isClickable && "group-hover:bg-green-500/20",
                    isCurrent && "bg-violet-500/10 text-violet-500",
                    isFuture && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="size-3 sm:size-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    "text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
                    isCompleted && "text-green-600",
                    isCompleted && isClickable && "group-hover:underline",
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
                    "h-px w-4 sm:w-8 md:w-12 mx-0.5 sm:mx-1 mt-3.5 sm:mt-[18px] flex-shrink-0 transition-colors duration-200",
                    index < currentStep ? "bg-green-500" : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
