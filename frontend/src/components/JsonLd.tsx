import { serializeJsonLd } from '../utils/structuredData'

/**
 * schema.org structured data for search engines.
 *
 * Rendered in the page body, which is valid for JSON-LD: the prerendered
 * landing page ships it in its HTML, and client-rendered pages expose it to
 * crawlers that run JavaScript. A data block is never executed, so the CSP's
 * script hash does not apply to it.
 */
export default function JsonLd({ data }: { data: Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Safe: serializeJsonLd escapes "<", so the content cannot close the tag.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
