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
import { Search, Plus, Loader2 } from 'lucide-react'
import type { FilingType } from '@/lib/types/database'

interface Client {
  id: string
  company_name: string
  client_type: string | null
}

interface DocSetting {
  document_type_id: string
  is_enabled: boolean
}

interface ActivateDeadlineModalProps {
  filingType: FilingType | null
  onClose: () => void
  onActivate: (excludedClientIds: string[]) => Promise<void>
}

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

  const isOpen = filingType !== null
  const docs = filingType?.document_requirements ?? []
  const mandatoryDocs = docs.filter(d => d.is_mandatory)
  const optionalDocs = docs.filter(d => !d.is_mandatory)
  const hasDocs = docs.length > 0

  const isDocEnabled = (docTypeId: string): boolean => {
    return docSettingsMap[docTypeId] ?? true
  }

  const toggleDoc = (docTypeId: string) => {
    setDocSettingsMap(prev => ({ ...prev, [docTypeId]: !(prev[docTypeId] ?? true) }))
  }

  // Fetch clients when modal opens
  useEffect(() => {
    if (!filingType) return
    setExcludedIds(new Set())
    setSearch('')
    setDocSettingsMap({})
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

  const handleActivate = async () => {
    setActivating(true)
    try {
      // Save document settings if any docs exist
      if (filingType && hasDocs) {
        const settings = docs.map(d => ({
          document_type_id: d.document_type_id,
          is_enabled: isDocEnabled(d.document_type_id),
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !activating) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Activate {filingType?.name}</DialogTitle>
          <DialogDescription>
            Configure required documents and client assignments for this deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Required Documents Section */}
          {hasDocs && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required Documents</p>
              <p className="text-sm text-muted-foreground">
                Select which documents clients need to provide.
              </p>
              <div className="space-y-1.5">
                {mandatoryDocs.map(d => {
                  const enabled = isDocEnabled(d.document_type_id)
                  return (
                    <div
                      key={d.document_type_id}
                      className="flex items-center gap-3 rounded-md px-3 py-2 border hover:bg-muted/50 cursor-pointer border-l-2 border-l-amber-400"
                      onClick={() => toggleDoc(d.document_type_id)}
                    >
                      <CheckButton
                        checked={enabled}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} ${d.label}`}
                      />
                      <span className={`text-sm font-medium flex-1 ${!enabled ? 'text-muted-foreground line-through' : ''}`}>
                        {d.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 shrink-0">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Required
                      </span>
                    </div>
                  )
                })}
                {optionalDocs.map(d => {
                  const enabled = isDocEnabled(d.document_type_id)
                  return (
                    <div
                      key={d.document_type_id}
                      className="flex items-center gap-3 rounded-md px-3 py-2 border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleDoc(d.document_type_id)}
                    >
                      <CheckButton
                        checked={enabled}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} ${d.label}`}
                      />
                      <span className={`text-sm font-medium flex-1 ${!enabled ? 'text-muted-foreground line-through' : ''}`}>
                        {d.label}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">Optional</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Client Assignments Section */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Assignments</p>
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
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">Loading clients...</p>
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
        </div>

        <DialogFooter>
          <ButtonBase
            variant="amber"
            buttonType="text-only"
            onClick={onClose}
            disabled={activating}
          >
            Cancel
          </ButtonBase>
          <ButtonBase
            variant="green"
            buttonType="icon-text"
            onClick={handleActivate}
            disabled={activating || loading}
          >
            <Plus className="size-4" />
            {activating ? 'Activating...' : 'Activate'}
          </ButtonBase>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
