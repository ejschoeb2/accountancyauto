"use client"

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Plus, Search, SlidersHorizontal, X, AlertTriangle } from 'lucide-react'
import { TemplateCard } from './template-card'
import type { EmailTemplate } from '@/lib/types/database'

interface TemplatesViewProps {
  templates: EmailTemplate[]
  templateUsageMap: Record<string, string[]>
  portalIssueMap: Record<string, 'portal-disabled' | 'portal-missing'>
  hasPortalConflicts: boolean
}

export function TemplatesView({
  templates,
  templateUsageMap,
  portalIssueMap,
  hasPortalConflicts,
}: TemplatesViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'default'>('all')
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all')

  const clearAllFilters = () => {
    setStatusFilter('all')
    setTypeFilter('all')
    setUsageFilter('all')
  }

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || usageFilter !== 'all'

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
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return result
  }, [templates, searchQuery, sortBy, statusFilter, typeFilter, usageFilter, templateUsageMap])

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
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 min-w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      {/* Template grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              usedInSchedules={templateUsageMap[template.id] || []}
              portalIssue={portalIssueMap[template.id]}
            />
          ))}
        </div>
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
