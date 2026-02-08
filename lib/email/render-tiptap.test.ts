/**
 * Tests for TipTap email rendering pipeline
 */

import { describe, it, expect } from 'vitest'
import { renderTipTapEmail } from './render-tiptap'

describe('renderTipTapEmail', () => {
  it('renders basic paragraph text to HTML', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello world' },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test Subject',
      context: {
        client_name: 'ABC Ltd',
        deadline: new Date('2026-01-31'),
        filing_type: 'Corporation Tax Payment',
      },
    })

    expect(result.html).toContain('Hello world')
    expect(result.html).toContain('style=') // Has inline styles
    expect(result.subject).toBe('Test Subject')
  })

  it('renders bold and italic formatting', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'important',
            },
            { type: 'text', text: ' and ' },
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'emphasis',
            },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {},
    })

    expect(result.html).toContain('<strong')
    expect(result.html).toContain('important')
    expect(result.html).toContain('<em')
    expect(result.html).toContain('emphasis')
  })

  it('substitutes placeholder variables with context data', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dear ' },
            {
              type: 'placeholder',
              attrs: { id: 'client_name', label: 'Client Name' },
            },
            { type: 'text', text: ', your ' },
            {
              type: 'placeholder',
              attrs: { id: 'filing_type', label: 'Filing Type' },
            },
            { type: 'text', text: ' is due.' },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {
        client_name: 'ABC Ltd',
        filing_type: 'Corporation Tax Payment',
      },
    })

    expect(result.html).toContain('ABC Ltd')
    expect(result.html).toContain('Corporation Tax Payment')
    expect(result.html).not.toContain('{{client_name}}')
    expect(result.html).not.toContain('{{filing_type}}')
  })

  it('uses fallback text for missing context data', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dear ' },
            {
              type: 'placeholder',
              attrs: { id: 'client_name', label: 'Client Name' },
            },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {}, // No client_name provided
    })

    expect(result.html).toContain('[Client Name]')
  })

  it('substitutes variables in subject line', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body content' }],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: '{{filing_type}} reminder for {{client_name}}',
      context: {
        client_name: 'ABC Ltd',
        filing_type: 'Corporation Tax Payment',
      },
    })

    expect(result.subject).toBe('Corporation Tax Payment reminder for ABC Ltd')
  })

  it('adds target="_blank" and rel="noopener noreferrer" to links', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://example.com' },
                },
              ],
              text: 'click here',
            },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {},
    })

    expect(result.html).toContain('target="_blank"')
    expect(result.html).toContain('rel="noopener noreferrer"')
    expect(result.html).toContain('https://example.com')
  })

  it('generates plain text fallback without HTML tags', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: 'Hello',
            },
            { type: 'text', text: ' world' },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {},
    })

    expect(result.text).toContain('Hello world')
    expect(result.text).not.toContain('<strong')
    expect(result.text).not.toContain('<p>')
  })

  it('throws error for malformed TipTap JSON', async () => {
    const invalidJson = {
      type: 'invalid-doc-type',
      content: [],
    }

    await expect(
      renderTipTapEmail({
        bodyJson: invalidJson,
        subject: 'Test',
        context: {},
      })
    ).rejects.toThrow('Invalid template content')
  })

  it('substitutes multiple placeholders correctly', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dear ' },
            {
              type: 'placeholder',
              attrs: { id: 'client_name', label: 'Client Name' },
            },
            { type: 'text', text: ', your deadline is ' },
            {
              type: 'placeholder',
              attrs: { id: 'deadline', label: 'Deadline' },
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {
        client_name: 'ABC Ltd',
        deadline: new Date('2026-01-31'),
      },
    })

    expect(result.html).toContain('ABC Ltd')
    expect(result.html).toContain('31 January 2026')
  })

  it('renders bullet lists with <ul> and <li> tags', async () => {
    const bodyJson = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'First item' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Second item' }],
                },
              ],
            },
          ],
        },
      ],
    }

    const result = await renderTipTapEmail({
      bodyJson,
      subject: 'Test',
      context: {},
    })

    expect(result.html).toContain('<ul')
    expect(result.html).toContain('<li')
    expect(result.html).toContain('First item')
    expect(result.html).toContain('Second item')
  })
})
