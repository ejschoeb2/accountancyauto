"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, X, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  { value: "Individual", label: "Individual (Personal Tax)" },
];

const VAT_SCHEME_OPTIONS = [
  { value: "Standard", label: "Standard" },
  { value: "Flat Rate", label: "Flat Rate" },
  { value: "Cash Accounting", label: "Cash Accounting" },
  { value: "Annual Accounting", label: "Annual Accounting" },
];

const VAT_REGISTERED_OPTIONS = [
  { value: "no", label: "Not Registered" },
  { value: "yes", label: "Registered" },
];

const VAT_STAGGER_GROUP_OPTIONS = [
  { value: "1", label: "1 (Mar/Jun/Sep/Dec)" },
  { value: "2", label: "2 (Jan/Apr/Jul/Oct)" },
  { value: "3", label: "3 (Feb/May/Aug/Nov)" },
];

const labelClass = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

export function CreateClientDialog({ open, onOpenChange, onCreated, onLimitReached }: CreateClientDialogProps) {
  const [companyName, setCompanyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [clientType, setClientType] = useState("");
  const [yearEndDate, setYearEndDate] = useState("");
  const [vatRegistered, setVatRegistered] = useState("");
  const [vatStaggerGroup, setVatStaggerGroup] = useState("");
  const [vatScheme, setVatScheme] = useState("");
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
      setVatRegistered("");
      setVatStaggerGroup("");
      setVatScheme("");
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
        vat_registered: vatRegistered === "yes",
      };

      if (displayName.trim()) {
        body.display_name = displayName.trim();
      }

      if (yearEndDate) {
        body.year_end_date = yearEndDate;
      }

      if (vatRegistered === "yes" && vatStaggerGroup) {
        body.vat_stagger_group = parseInt(vatStaggerGroup, 10);
      }

      if (vatRegistered === "yes" && vatScheme) {
        body.vat_scheme = vatScheme;
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
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription>
            Add a new client to your practice.
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
          <div className="space-y-1.5">
            <label htmlFor="company-name" className={labelClass}>
              Company Name *
            </label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Ltd"
              required
            />
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="display-name" className={labelClass}>
              Display Name
            </label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Optional - shown in table if set"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className={labelClass}>
              Email *
            </label>
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
          <div className="space-y-1.5">
            <label className={labelClass}>Client Type *</label>
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

          {/* Year End Date — not applicable for Individual clients */}
          {clientType !== "Individual" && (
            <div className="space-y-1.5">
              <label htmlFor="year-end-date" className={labelClass}>
                Year End Date
              </label>
              <Input
                id="year-end-date"
                type="date"
                value={yearEndDate}
                onChange={(e) => setYearEndDate(e.target.value)}
              />
            </div>
          )}

          {/* VAT fields — not applicable for Individual clients */}
          {clientType !== "Individual" && (
            <div className="space-y-1.5">
              <label className={labelClass}>VAT Registered</label>
              <Select value={vatRegistered} onValueChange={setVatRegistered}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select VAT status..." />
                </SelectTrigger>
                <SelectContent>
                  {VAT_REGISTERED_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* VAT sub-fields - only shown when VAT registered and not Individual */}
          {clientType !== "Individual" && vatRegistered === "yes" && (
            <>
              {/* VAT Stagger Group */}
              <div className="space-y-1.5">
                <label className={labelClass}>VAT Stagger Group</label>
                <Select value={vatStaggerGroup} onValueChange={setVatStaggerGroup}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stagger group..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_STAGGER_GROUP_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* VAT Scheme */}
              <div className="space-y-1.5">
                <label className={labelClass}>VAT Scheme</label>
                <Select value={vatScheme} onValueChange={setVatScheme}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select VAT scheme..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VAT_SCHEME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter>
            <ButtonBase
              type="button"
              onClick={() => onOpenChange(false)}
              buttonType="icon-text"
              variant="destructive"
            >
              <X className="size-4" />
              Cancel
            </ButtonBase>
            <ButtonBase
              type="submit"
              buttonType="icon-text"
              variant="green"
              disabled={isLoading || atLimit || !companyName.trim() || !email.trim() || !clientType}
            >
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </ButtonBase>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
