"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ButtonBase } from "@/components/ui/button-base";
import { createClient } from "@/lib/supabase/client";

import type { Client } from "@/app/actions/clients";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: Client) => void;
  onLimitReached?: (data: { currentCount: number; limit: number }) => void;
}

const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Sole Trader", label: "Sole Trader" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
];

export function CreateClientDialog({ open, onOpenChange, onCreated, onLimitReached }: CreateClientDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [clientType, setClientType] = useState("");
  const [yearEndDate, setYearEndDate] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Client limit state
  const [clientLimit, setClientLimit] = useState<number | null>(null);
  const [currentClientCount, setCurrentClientCount] = useState(0);
  const [limitLoaded, setLimitLoaded] = useState(false);

  const atLimit = clientLimit !== null && currentClientCount >= clientLimit;
  const nearLimit = clientLimit !== null && !atLimit && currentClientCount >= clientLimit - 3;

  // Fetch client limit when dialog opens
  useEffect(() => {
    if (!open) {
      setCompanyName("");
      setDisplayName("");
      setEmail("");
      setClientType("");
      setYearEndDate("");
      setVatRegistered(false);
      setLimitLoaded(false);
      return;
    }

    async function fetchLimit() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const orgId = user?.app_metadata?.org_id;
        if (!orgId) return;

        const { data: org } = await supabase
          .from("organisations")
          .select("client_count_limit")
          .eq("id", orgId)
          .single();

        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);

        setClientLimit(org?.client_count_limit ?? null);
        setCurrentClientCount(count ?? 0);
      } catch {
        // Non-blocking
      } finally {
        setLimitLoaded(true);
      }
    }

    fetchLimit();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        company_name: companyName,
        primary_email: email,
        client_type: clientType,
        vat_registered: vatRegistered,
      };

      if (displayName.trim()) {
        body.display_name = displayName.trim();
      }

      if (yearEndDate) {
        body.year_end_date = yearEndDate;
      }

      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if the error is a client limit being reached
        if (
          data.code === "CLIENT_LIMIT_REACHED" &&
          onLimitReached &&
          typeof data.currentCount === "number" &&
          typeof data.limit === "number"
        ) {
          onOpenChange(false);
          onLimitReached({ currentCount: data.currentCount, limit: data.limit });
          return;
        }
        toast.error(data.error || "Failed to create client");
        return;
      }

      onCreated(data);
      toast.success("Client created");
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create client";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription>
            Create a new client for testing the email sending pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client limit warnings */}
          {limitLoaded && atLimit && (
            <div className="flex items-start gap-2 text-sm p-3 bg-red-500/10 border border-red-200 text-red-800 rounded-lg">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                You&apos;ve reached your plan limit of <strong>{clientLimit}</strong> clients
                ({currentClientCount}/{clientLimit} used). Upgrade your plan to add more.
              </span>
            </div>
          )}
          {limitLoaded && nearLimit && (
            <div className="flex items-start gap-2 text-sm p-3 bg-amber-500/10 border border-amber-200 text-amber-800 rounded-lg">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                You&apos;re close to your plan limit ({currentClientCount}/{clientLimit} clients used).
              </span>
            </div>
          )}

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Ltd"
              required
            />
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional - shown in table if set"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. client@example.com"
              required
            />
          </div>

          {/* Client Type */}
          <div className="space-y-2">
            <Label>Client Type *</Label>
            <Select value={clientType} onValueChange={setClientType} required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select client type..." />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year End Date */}
          <div className="space-y-2">
            <Label htmlFor="year-end-date">Year End Date</Label>
            <Input
              id="year-end-date"
              type="date"
              value={yearEndDate}
              onChange={(e) => setYearEndDate(e.target.value)}
            />
          </div>

          {/* VAT Registered */}
          <div className="flex items-center gap-2">
            <input
              id="vat-registered"
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => setVatRegistered(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="vat-registered">VAT Registered</Label>
          </div>

          <DialogFooter>
            <ButtonBase
              type="button"
              onClick={() => onOpenChange(false)}
              buttonType="text-only"
            >
              Cancel
            </ButtonBase>
            <ButtonBase
              type="submit"
              buttonType="text-only"
              variant="green"
              disabled={isLoading || atLimit || !companyName.trim() || !email.trim() || !clientType}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create
            </ButtonBase>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
