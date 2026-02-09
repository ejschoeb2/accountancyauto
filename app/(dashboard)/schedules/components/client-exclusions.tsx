"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckButton } from '@/components/ui/check-button'
import { usePageLoading } from '@/components/page-loading'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

interface Client {
  id: string
  company_name: string
  client_type: string | null
}

interface ClientExclusionsProps {
  scheduleId: string
}

export function ClientExclusions({ scheduleId }: ClientExclusionsProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  usePageLoading('client-exclusions', loading)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

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

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const term = search.toLowerCase()
    return clients.filter(c =>
      c.company_name.toLowerCase().includes(term)
    )
  }, [clients, search])

  const toggleExclusion = async (clientId: string) => {
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

  const excludedCount = excludedIds.size

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          This schedule applies to all clients by default.
          {excludedCount > 0 && (
            <> <span className="text-amber-600 font-medium">{excludedCount} client{excludedCount !== 1 ? 's' : ''} excluded.</span></>
          )}
        </p>
        {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
      </div>

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
        {filteredClients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {search ? 'No clients match your search.' : 'No clients found.'}
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
                  onCheckedChange={() => toggleExclusion(client.id)}
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
