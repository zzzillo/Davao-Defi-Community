import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { applyPageMeta, type PageMeta as PageMetaValues } from '../utils/pageMeta'

type Props = Omit<PageMetaValues, 'path'> & {
  /** Defaults to the current pathname; pass one when the page has a preferred address. */
  path?: string
}

/** Sets the document's title, description, canonical URL and share tags. Renders nothing. */
export default function PageMeta({ title, description, path, image, type, noindex }: Props) {
  const { pathname } = useLocation()
  const canonicalPath = path ?? pathname

  useEffect(() => {
    applyPageMeta({ title, description, path: canonicalPath, image, type, noindex })
  }, [title, description, canonicalPath, image, type, noindex])

  return null
}
