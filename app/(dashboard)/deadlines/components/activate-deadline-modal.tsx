"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { CheckButton } from '@/components/ui/check-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Search, Plus } from 'lucide-react'
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

  const isOpen = filingType !== null

  // Fetch clients when modal opens
  useEffect(() => {
    if (!filingType) return
    setExcludedIds(new Set())
    setSearch('')
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
      await onActivate(Array.from(excludedIds))
    } finally {
      setActivating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !activating) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Activate {filingType?.name}</DialogTitle>
          <DialogDescription>
            This deadline will apply to all matching clients by default. Untick any clients to exclude them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Applies to + excluded count */}
          <p className="text-sm text-muted-foreground">
            Applies to{' '}
            <span className="font-medium text-foreground">
              {filingType?.applicable_client_types?.join(', ')}
            </span>{' '}
            clients.
            {excludedCount > 0 && (
              <> <span className="text-amber-600 font-medium">
                {excludedCount} client{excludedCount !== 1 ? 's' : ''} will be excluded.
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
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border p-2">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={activating}>
            Cancel
          </Button>
          <Button
            onClick={handleActivate}
            disabled={activating || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="size-4 mr-1.5" />
            {activating ? 'Activating...' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
