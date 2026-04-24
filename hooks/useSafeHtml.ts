import { useEffect, useState } from 'react'

/**
 * Sanitizes HTML using DOMPurify, deferred to the client via useEffect.
 *
 * Why useEffect:
 *   dompurify (unlike isomorphic-dompurify) has no jsdom dependency and
 *   uses the browser's native DOM. On the server there is no DOM, so we
 *   skip sanitization there — the hook returns '' until the client mounts,
 *   at which point DOMPurify runs and the real content appears.
 *
 *   This is safe because all feed HTML is loaded via useEffect fetches
 *   anyway — the server never has post content to render.
 */

const ALLOWED_TAGS = ['b','i','em','strong','a','p','ul','ol','li','br','h1','h2','h3','span','div']
const ALLOWED_ATTR = ['href','style','target']

export function useSafeHtml(rawHtml: string): string {
  const [safe, setSafe] = useState('')

  useEffect(() => {
    let cancelled = false
    import('dompurify').then(mod => {
      if (cancelled) return
      setSafe(
        mod.default.sanitize(rawHtml, { ALLOWED_TAGS, ALLOWED_ATTR })
      )
    })
    return () => { cancelled = true }
  }, [rawHtml])

  return safe
}
