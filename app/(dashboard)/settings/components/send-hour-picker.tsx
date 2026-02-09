"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSendHour } from "@/app/actions/settings";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6am to 9pm

function formatHour(hour: number): string {
  if (hour === 0) return "12:00 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12:00 PM";
  return `${hour - 12}:00 PM`;
}

export function SendHourPicker({ defaultHour }: { defaultHour: number }) {
  const [hour, setHour] = useState(String(defaultHour));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setHour(value);
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const result = await updateSendHour(parseInt(value, 10));
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center size-12 rounded-lg bg-primary/10">
            <Clock className="size-6 text-primary" />
          </div>
          <div className="space-y-2">
            <div>
              <h2 className="text-lg font-semibold">Reminder Schedule</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose when daily reminders are sent (UK time)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-status-success font-medium">Saved</span>
          )}
          {error && (
            <span className="text-sm text-status-danger font-medium">{error}</span>
          )}
          <Select value={hour} onValueChange={handleChange} disabled={isPending}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatHour(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
