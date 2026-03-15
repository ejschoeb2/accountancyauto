"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ButtonBase } from '@/components/ui/button-base'
import { IconButtonWithText } from '@/components/ui/icon-button-with-text'
import { ButtonWithText } from '@/components/ui/button-with-text'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Plus, Search, SlidersHorizontal, X, AlertTriangle, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { EmailTemplate } from '@/lib/types/database'

interface TemplatesViewProps {
  templates: EmailTemplate[]
  templateUsageMap: Record<string, string[]>
  portalIssueMap: Record<string, 'portal-disabled' | 'portal-missing'>
  hasPortalConflicts: boolean
}

type SortField = 'name' | 'subject' | 'created_at'
type SortDir = 'asc' | 'desc'

export function TemplatesView({
  templates,
  templateUsageMap,
  portalIssueMap,
  hasPortalConflicts,
}: TemplatesViewProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'default'>('all')
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const clearAllFilters = () => {
    setStatusFilter('all')
    setTypeFilter('all')
    setUsageFilter('all')
  }

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || usageFilter !== 'all'

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc'
      ? <ChevronUp className="size-3.5 inline ml-1" />
      : <ChevronDown className="size-3.5 inline ml-1" />
  }

  const handleDelete = async (template: EmailTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`)) {
      return
    }

    setDeletingId(template.id)
    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete template')
      }

      toast.success(`Deleted "${template.name}"`)
      router.refresh()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete template')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredTemplates = useMemo(() => {
    let result = templates.filter(t => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesName = t.name.toLowerCase().includes(q)
        const matchesSubject = t.subject?.toLowerCase().includes(q)
        if (!matchesName && !matchesSubject) return false
      }

      // Status filter
      if (statusFilter === 'active' && !t.is_active) return false
      if (statusFilter === 'inactive' && t.is_active) return false

      // Type filter
      if (typeFilter === 'custom' && !t.is_custom) return false
      if (typeFilter === 'default' && t.is_custom) return false

      // Usage filter
      const isUsed = (templateUsageMap[t.id] || []).length > 0
      if (usageFilter === 'used' && !isUsed) return false
      if (usageFilter === 'unused' && isUsed) return false

      return true
    })

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'subject':
          cmp = (a.subject ?? '').localeCompare(b.subject ?? '')
          break
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [templates, searchQuery, sortField, sortDir, statusFilter, typeFilter, usageFilter, templateUsageMap])

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="space-y-1">
        <h1>Email Templates</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage reusable templates for client communications.
        </p>
      </div>

      {/* Portal conflict banner */}
      {hasPortalConflicts && (
        <div className="flex items-start gap-3 rounded-xl p-4 bg-amber-500/10">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-600">
              Client portal is disabled but some templates contain portal links
            </p>
            <p className="text-sm text-amber-600/80">
              These templates will send emails with empty portal links. Edit the affected templates to remove the portal link placeholder, or{' '}
              <Link href="/settings" className="underline hover:no-underline">
                re-enable the client portal
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Search + Controls toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 hover:border-foreground/20"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery('')}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2 sm:ml-auto items-center">
          <Link href="/templates/new">
            <IconButtonWithText variant="green">
              <Plus className="h-5 w-5" />
              Create Template
            </IconButtonWithText>
          </Link>
          <IconButtonWithText
            type="button"
            variant={showFilters ? "amber" : "violet"}
            onClick={() => setShowFilters(v => !v)}
            title={showFilters ? "Close filters" : "Open filters"}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {showFilters ? "Close Filters" : "Filter"}
          </IconButtonWithText>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-4">
                {/* Status */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                  <div className="flex flex-wrap gap-2">
                    <ButtonWithText
                      onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
                      isSelected={statusFilter === 'active'}
                      variant="muted"
                    >
                      Active
                    </ButtonWithText>
                    <ButtonWithText
                      onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
                      isSelected={statusFilter === 'inactive'}
                      variant="muted"
                    >
                      Inactive
                    </ButtonWithText>
                  </div>
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</span>
                  <div className="flex flex-wrap gap-2">
                    <ButtonWithText
                      onClick={() => setTypeFilter(typeFilter === 'custom' ? 'all' : 'custom')}
                      isSelected={typeFilter === 'custom'}
                      variant="muted"
                    >
                      Custom
                    </ButtonWithText>
                    <ButtonWithText
                      onClick={() => setTypeFilter(typeFilter === 'default' ? 'all' : 'default')}
                      isSelected={typeFilter === 'default'}
                      variant="muted"
                    >
                      Default
                    </ButtonWithText>
                  </div>
                </div>

                {/* Usage */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usage</span>
                  <div className="flex flex-wrap gap-2">
                    <ButtonWithText
                      onClick={() => setUsageFilter(usageFilter === 'used' ? 'all' : 'used')}
                      isSelected={usageFilter === 'used'}
                      variant="muted"
                    >
                      Used in Schedule
                    </ButtonWithText>
                    <ButtonWithText
                      onClick={() => setUsageFilter(usageFilter === 'unused' ? 'all' : 'unused')}
                      isSelected={usageFilter === 'unused'}
                      variant="muted"
                    >
                      Not Used
                    </ButtonWithText>
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">Clear</span>
                  <IconButtonWithText
                    type="button"
                    variant="destructive"
                    onClick={clearAllFilters}
                    title="Clear all filters"
                  >
                    <X className="h-5 w-5" />
                    Clear all filters
                  </IconButtonWithText>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates table */}
      {filteredTemplates.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('name')}
                  >
                    Name <SortIcon field="name" />
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('subject')}
                  >
                    Subject <SortIcon field="subject" />
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Used in
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Status
                  </th>
                  <th
                    className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none"
                    onClick={() => handleSort('created_at')}
                  >
                    Created <SortIcon field="created_at" />
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12">
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => {
                  const usedIn = templateUsageMap[template.id] || []
                  const portalIssue = portalIssueMap[template.id]

                  return (
                    <tr
                      key={template.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/templates/${template.id}/edit`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {template.name}
                          </span>
                          {portalIssue === 'portal-disabled' && (
                            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground truncate max-w-[280px] block">
                          {template.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {usedIn.length > 0 ? (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {usedIn.join(', ')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {template.is_custom ? (
                          <div className="px-3 py-1.5 rounded-md inline-flex items-center bg-violet-500/10">
                            <span className="text-xs font-medium text-violet-500">Custom</span>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-md inline-flex items-center bg-blue-500/10">
                            <span className="text-xs font-medium text-blue-500">Default</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`px-3 py-1.5 rounded-md inline-flex items-center ${
                          template.is_active ? 'bg-green-500/10' : 'bg-status-neutral/10'
                        }`}>
                          <span className={`text-xs font-medium ${
                            template.is_active ? 'text-green-600' : 'text-status-neutral'
                          }`}>
                            {template.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(template.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ButtonBase
                          variant="destructive"
                          buttonType="icon-only"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(template)
                          }}
                          disabled={deletingId === template.id}
                        >
                          <Trash2 className="size-4" />
                        </ButtonBase>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">
            {templates.length === 0
              ? 'No templates yet. Create your first email template to get started.'
              : searchQuery
                ? 'No templates match your search.'
                : 'No templates match your filters.'}
          </p>
          {templates.length === 0 && (
            <Link href="/templates/new">
              <IconButtonWithText variant="green" className="mt-4">
                <Plus className="h-5 w-5" />
                Create Template
              </IconButtonWithText>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
