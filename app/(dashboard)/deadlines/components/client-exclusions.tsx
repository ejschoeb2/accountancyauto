"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { usePageLoading } from '@/components/page-loading'
import { toast } from 'sonner'
import { Search } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CLIENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Limited Company', label: 'Limited Company' },
  { value: 'Partnership', label: 'Partnership' },
  { value: 'LLP', label: 'LLP' },
  { value: 'Individual', label: 'Individual' },
]

interface Client {
  id: string
  company_name: string
  client_type: string | null
}

interface ClientExclusionsProps {
  scheduleId: string
  applicableClientTypes?: string[]
}

export function ClientExclusions({ scheduleId, applicableClientTypes }: ClientExclusionsProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  usePageLoading('client-exclusions', loading)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  // Load clients and exclusions
  useEffect(() => {
    const load = async () => {
      try {
        const [clientsRes, exclusionsRes] = await Promise.all([
          fetch('/api/clients'),
          fetch(`/api/schedules/${scheduleId}/exclusions`),
        ])

        if (clientsRes.ok) {
          const clientsData = await clientsRes.json()
          setClients(
            (clientsData.clients || clientsData || []).map((c: Client) => ({
              id: c.id,
              company_name: c.company_name,
              client_type: c.client_type,
            }))
          )
        } else {
          toast.error('Failed to load clients')
        }

        if (exclusionsRes.ok) {
          const exclusionsData: string[] = await exclusionsRes.json()
          setExcludedIds(new Set(exclusionsData))
        } else {
          toast.error('Failed to load exclusions')
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [scheduleId])

  // Filter by applicable client types first (for filing-type schedules)
  const eligibleClients = useMemo(() => {
    if (!applicableClientTypes || applicableClientTypes.length === 0) return clients
    return clients.filter(c =>
      c.client_type && applicableClientTypes.includes(c.client_type)
    )
  }, [clients, applicableClientTypes])

  const filteredClients = useMemo(() => {
    let result = eligibleClients
    if (typeFilter !== 'all') {
      result = result.filter(c => c.client_type === typeFilter)
    }
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter(c => c.company_name.toLowerCase().includes(term))
    }
    return result
  }, [eligibleClients, search, typeFilter])

  const toggleExclusion = async (clientId: string) => {
    // Prevent multiple simultaneous updates
    if (saving) return

    const newExcluded = new Set(excludedIds)
    if (newExcluded.has(clientId)) {
      newExcluded.delete(clientId)
    } else {
      newExcluded.add(clientId)
    }

    // Optimistic update
    const previousExcluded = excludedIds
    setExcludedIds(newExcluded)
    setSaving(true)

    try {
      const res = await fetch(`/api/schedules/${scheduleId}/exclusions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded_client_ids: Array.from(newExcluded) }),
      })

      if (!res.ok) throw new Error('Failed to update exclusions')
    } catch (error) {
      // Revert on error
      setExcludedIds(previousExcluded)
      toast.error(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const excludedCount = Array.from(excludedIds).filter(id =>
    eligibleClients.some(c => c.id === id)
  ).length

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          This deadline applies to all clients by default.
          {excludedCount > 0 && (
            <> <span className="text-amber-600 font-medium">{excludedCount} client{excludedCount !== 1 ? 's' : ''} excluded.</span></>
          )}
        </p>
        {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
      </div>

      {/* Search + Type Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-9 hover:border-foreground/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 min-w-[180px] w-auto">
            <SelectValue />
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

      {/* Client list */}
      <div className="max-h-64 overflow-y-auto space-y-1 rounded-md border p-2">
        {filteredClients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {search || typeFilter !== 'all' ? 'No clients match your filters.' : 'No clients found.'}
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
  )
}
