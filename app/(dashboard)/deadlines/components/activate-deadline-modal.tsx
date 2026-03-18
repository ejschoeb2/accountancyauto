"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { CheckButton } from '@/components/ui/check-button'
import { ButtonBase } from '@/components/ui/button-base'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Search, Plus, Loader2, ArrowRight, ArrowLeft, X } from 'lucide-react'
import type { FilingType } from '@/lib/types/database'

interface Client {
  id: string
  company_name: string
  client_type: string | null
}

interface ActivateDeadlineModalProps {
  filingType: FilingType | null
  onClose: () => void
  onActivate: (excludedClientIds: string[]) => Promise<void>
}

type Step = 'clients' | 'documents' | 'confirm'

export function ActivateDeadlineModal({
  filingType,
  onClose,
  onActivate,
}: ActivateDeadlineModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [activating, setActivating] = useState(false)
  const [docSettingsMap, setDocSettingsMap] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState<Step>('clients')

  const isOpen = filingType !== null
  const docs = filingType?.document_requirements ?? []
  const mandatoryDocs = docs.filter(d => d.is_mandatory)
  const optionalDocs = docs.filter(d => !d.is_mandatory)
  const hasDocs = docs.length > 0

  const isDocEnabled = (docTypeId: string, isMandatory: boolean): boolean => {
    return docSettingsMap[docTypeId] ?? isMandatory
  }

  const toggleDoc = (docTypeId: string, isMandatory: boolean) => {
    setDocSettingsMap(prev => ({ ...prev, [docTypeId]: !(prev[docTypeId] ?? isMandatory) }))
  }

  // Fetch clients when modal opens
  useEffect(() => {
    if (!filingType) return
    setExcludedIds(new Set())
    setSearch('')
    setDocSettingsMap({})
    setStep('clients')
    setLoading(true)
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        setClients((data.clients || data || []) as Client[])
      })
      .catch(() => {/* silently fail — empty list shown */})
      .finally(() => setLoading(false))
  }, [filingType?.id])

  const eligibleClients = useMemo(() => {
    if (!filingType?.applicable_client_types?.length) return clients
    return clients.filter(c =>
      c.client_type && (filingType.applicable_client_types as string[]).includes(c.client_type)
    )
  }, [clients, filingType])

  const filteredClients = useMemo(() => {
    if (!search.trim()) return eligibleClients
    const term = search.toLowerCase()
    return eligibleClients.filter(c => c.company_name.toLowerCase().includes(term))
  }, [eligibleClients, search])

  const toggleExclusion = (clientId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })
  }

  const excludedCount = Array.from(excludedIds).filter(id =>
    eligibleClients.some(c => c.id === id)
  ).length

  const includedCount = eligibleClients.length - excludedCount

  const handleActivate = async () => {
    setActivating(true)
    try {
      // Save document settings if any docs exist
      if (filingType && hasDocs) {
        const settings = docs.map(d => ({
          document_type_id: d.document_type_id,
          is_enabled: isDocEnabled(d.document_type_id, d.is_mandatory),
        }))
        await fetch(`/api/filing-types/${filingType.id}/document-settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings }),
        })
      }
      await onActivate(Array.from(excludedIds))
    } finally {
      setActivating(false)
    }
  }

  const handleNext = () => {
    if (step === 'clients') {
      setStep(hasDocs ? 'documents' : 'confirm')
    } else if (step === 'documents') {
      setStep('confirm')
    }
  }

  const handleBack = () => {
    if (step === 'documents') {
      setStep('clients')
    } else if (step === 'confirm') {
      setStep(hasDocs ? 'documents' : 'clients')
    }
  }

  const stepNumber = step === 'clients' ? 1 : step === 'documents' ? 2 : hasDocs ? 3 : 2
  const totalSteps = hasDocs ? 3 : 2

  const enabledDocCount = docs.filter(d => isDocEnabled(d.document_type_id, d.is_mandatory)).length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !activating) onClose() }}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Activate {filingType?.name}</DialogTitle>
          <DialogDescription>
            Step {stepNumber} of {totalSteps} &mdash;{' '}
            {step === 'clients' && 'Choose which clients this deadline applies to.'}
            {step === 'documents' && 'Select which documents to collect from clients.'}
            {step === 'confirm' && 'Review and activate this deadline.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Client Assignments */}
        {step === 'clients' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Applies to{' '}
              <span className="font-medium text-foreground">
                {filingType?.applicable_client_types?.join(', ')}
              </span>{' '}
              clients. Untick any to exclude.
              {excludedCount > 0 && (
                <> <span className="text-amber-600 font-medium">
                  {' '}{excludedCount} client{excludedCount !== 1 ? 's' : ''} will be excluded.
                </span></>
              )}
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                className="pl-9 hover:border-foreground/20"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Client list */}
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border bg-background p-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" />
                  Loading clients...
                </div>
              ) : filteredClients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {search ? 'No clients match your search.' : 'No matching clients found.'}
                </p>
              ) : (
                filteredClients.map((client) => {
                  const isExcluded = excludedIds.has(client.id)
                  return (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleExclusion(client.id)}
                    >
                      <CheckButton
                        checked={!isExcluded}
                        aria-label={`${isExcluded ? 'Include' : 'Exclude'} ${client.company_name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className={`text-sm ${isExcluded ? 'text-muted-foreground line-through' : ''}`}>
                          {client.company_name}
                        </span>
                        {client.client_type && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {client.client_type}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Step 2: Documents */}
        {step === 'documents' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select which documents clients need to provide for this filing type.
            </p>
            <div className="space-y-1">
              {[...mandatoryDocs, ...optionalDocs].map(d => {
                const enabled = isDocEnabled(d.document_type_id, d.is_mandatory)
                return (
                  <div
                    key={d.document_type_id}
                    className="flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleDoc(d.document_type_id, d.is_mandatory)}
                  >
                    <CheckButton
                      checked={enabled}
                      aria-label={`${enabled ? 'Disable' : 'Enable'} ${d.label}`}
                    />
                    <span className={`text-sm font-medium ${!enabled ? 'text-muted-foreground line-through' : ''}`}>
                      {d.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Clients included</span>
                <span className="text-sm font-medium">{includedCount} of {eligibleClients.length}</span>
              </div>
              {hasDocs && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Documents to collect</span>
                  <span className="text-sm font-medium">{enabledDocCount} of {docs.length}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              This will create client assignments and start sending reminders based on the configured schedule.
            </p>
          </div>
        )}

        <DialogFooter>
          {step !== 'clients' ? (
            <ButtonBase
              variant="amber"
              buttonType="icon-text"
              onClick={handleBack}
              disabled={activating}
            >
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
          ) : (
            <ButtonBase
              variant="amber"
              buttonType="icon-text"
              onClick={onClose}
              disabled={activating}
            >
              <X className="size-4" />
              Cancel
            </ButtonBase>
          )}
          {step === 'confirm' ? (
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleActivate}
              disabled={activating || loading}
            >
              <Plus className="size-4" />
              {activating ? 'Activating...' : 'Activate'}
            </ButtonBase>
          ) : (
            <ButtonBase
              variant="blue"
              buttonType="icon-text"
              onClick={handleNext}
              disabled={loading}
            >
              Next
              <ArrowRight className="size-4" />
            </ButtonBase>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
