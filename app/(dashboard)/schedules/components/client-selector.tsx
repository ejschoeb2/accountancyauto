"use client"

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { CheckButton } from '@/components/ui/check-button'
import { usePageLoading } from '@/components/page-loading'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

interface Client {
  id: string
  company_name: string
  client_type: string | null
}

interface ClientSelectorProps {
  selectedIds: Set<string>
  onToggle: (clientId: string) => void
}

export function ClientSelector({ selectedIds, onToggle }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  usePageLoading('client-selector', loading)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/clients')
        if (res.ok) {
          const data = await res.json()
          setClients(
            (data.clients || data || []).map((c: Client) => ({
              id: c.id,
              company_name: c.company_name,
              client_type: c.client_type,
            }))
          )
        } else {
          toast.error('Failed to load clients')
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load clients')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const term = search.toLowerCase()
    return clients.filter(c =>
      c.company_name.toLowerCase().includes(term)
    )
  }, [clients, search])

  const selectedCount = selectedIds.size

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading clients...</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select which clients this schedule applies to.
          {selectedCount > 0 && (
            <> <span className="text-blue-600 font-medium">{selectedCount} client{selectedCount !== 1 ? 's' : ''} selected.</span></>
          )}
          {selectedCount === 0 && (
            <> <span className="text-amber-600 font-medium">No clients selected.</span></>
          )}
        </p>
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
            {search ? 'No clients match your search.' : 'No clients found. Add clients first.'}
          </p>
        ) : (
          filteredClients.map((client) => {
            const isSelected = selectedIds.has(client.id)
            return (
              <div
                key={client.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                onClick={() => onToggle(client.id)}
              >
                <CheckButton
                  checked={isSelected}
                  onCheckedChange={() => onToggle(client.id)}
                  aria-label={`${isSelected ? 'Remove' : 'Add'} ${client.company_name}`}
                />
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${!isSelected ? 'text-muted-foreground' : ''}`}>
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
