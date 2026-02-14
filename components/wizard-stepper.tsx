"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardStepperProps {
  steps: { label: string }[];
  currentStep: number; // 0-indexed
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center justify-center w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isFuture = index > currentStep;

        return (
          <div key={index} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center size-9 rounded-full text-sm font-semibold transition-colors",
                  isCompleted && "bg-green-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isFuture && "border-2 border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 whitespace-nowrap",
                  isCompleted && "text-green-600 font-medium",
                  isCurrent && "text-foreground font-medium",
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
                  "h-0.5 w-12 sm:w-20 mx-2 mt-[-1.25rem] transition-colors",
                  index < currentStep ? "bg-green-500" : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
