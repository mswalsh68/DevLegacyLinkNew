import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  // Text formatting
  'b', 'i', 'u', 's', 'del', 'strong', 'em', 'small', 'code', 'pre', 'mark', 'sub', 'sup',
  // Structure
  'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'hr',
  // Headings
  'h1', 'h2', 'h3', 'h4',
  // Links
  'a',
]

const ALLOWED_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'target', 'rel'],
}

const ALLOWED_SCHEMES = ['http', 'https', 'mailto']

export function sanitizePostHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags:       ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes:    ALLOWED_SCHEMES,
    // Force safe defaults on all links
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}
