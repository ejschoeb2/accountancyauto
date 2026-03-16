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
import { Plus, Search, SlidersHorizontal, X, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { TemplateEditorModal } from './template-editor-modal'
import type { EmailTemplate } from '@/lib/types/database'

// Generic template names — everything else that's not custom is "Dedicated"
const GENERIC_TEMPLATE_NAMES = new Set([
  'Friendly First Reminder',
  'Follow-Up Reminder',
  'Urgent Final Notice',
])

function getTemplateType(template: EmailTemplate): 'custom' | 'dedicated' | 'default' {
  if (template.is_custom) return 'custom'
  if (!GENERIC_TEMPLATE_NAMES.has(template.name)) return 'dedicated'
  return 'default'
}

const TYPE_CONFIG = {
  custom: { bg: 'bg-violet-500/10', text: 'text-violet-500', label: 'Custom' },
  dedicated: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Dedicated' },
  default: { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'Default' },
} as const

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
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('most-used')
  const [showFilters, setShowFilters] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'custom' | 'dedicated' | 'default'>('all')
  const [usageFilter, setUsageFilter] = useState<'all' | 'used' | 'unused'>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  const clearAllFilters = () => {
    setTypeFilter('all')
    setUsageFilter('all')
  }

  const hasActiveFilters = typeFilter !== 'all' || usageFilter !== 'all'

  const handleDelete = async (template: EmailTemplate, e: React.MouseEvent) => {
    e.stopPropagation()
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

      // Type filter
      if (typeFilter !== 'all' && getTemplateType(t) !== typeFilter) return false

      // Usage filter
      const isUsed = (templateUsageMap[t.id] || []).length > 0
      if (usageFilter === 'used' && !isUsed) return false
      if (usageFilter === 'unused' && isUsed) return false

      return true
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'most-used': {
          const aCount = (templateUsageMap[a.id] || []).length
          const bCount = (templateUsageMap[b.id] || []).length
          return bCount - aCount || a.name.localeCompare(b.name)
        }
        case 'name-asc':
          return a.name.localeCompare(b.name)
        case 'name-desc':
          return b.name.localeCompare(a.name)
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        default:
          return 0
      }
    })

    return result
  }, [templates, searchQuery, sortBy, typeFilter, usageFilter, templateUsageMap])

  return (
    <div className="space-y-8">
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
          <IconButtonWithText
            variant="green"
            onClick={() => {
              setEditingTemplateId(null)
              setModalOpen(true)
            }}
          >
            <Plus className="h-5 w-5" />
            Create Template
          </IconButtonWithText>
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
                <SelectItem value="most-used">Most Used</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
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
                      onClick={() => setTypeFilter(typeFilter === 'dedicated' ? 'all' : 'dedicated')}
                      isSelected={typeFilter === 'dedicated'}
                      variant="muted"
                    >
                      Dedicated
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
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-full">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Used in
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Type
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => {
                  const usedIn = templateUsageMap[template.id] || []
                  const portalIssue = portalIssueMap[template.id]
                  const templateType = getTemplateType(template)
                  const typeStyle = TYPE_CONFIG[templateType]

                  return (
                    <tr
                      key={template.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setEditingTemplateId(template.id)
                        setModalOpen(true)
                      }}
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
                        <span className="text-sm text-muted-foreground block">
                          {template.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {usedIn.length > 0 ? (
                          <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                            {usedIn.length} schedule{usedIn.length !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className={`px-3 py-2 rounded-md inline-flex items-center ${typeStyle.bg}`}>
                          <span className={`text-sm font-medium ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <ButtonBase
                          variant="destructive"
                          buttonType="icon-only"
                          onClick={(e) => handleDelete(template, e)}
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
            <IconButtonWithText
              variant="green"
              className="mt-4"
              onClick={() => {
                setEditingTemplateId(null)
                setModalOpen(true)
              }}
            >
              <Plus className="h-5 w-5" />
              Create Template
            </IconButtonWithText>
          )}
        </div>
      )}

      {/* Template editor modal */}
      <TemplateEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        templateId={editingTemplateId}
      />
    </div>
  )
}
