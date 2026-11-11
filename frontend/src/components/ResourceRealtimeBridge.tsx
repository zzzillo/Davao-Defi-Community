import { useEffect, useRef } from 'react'
import { useAppAuth } from '../auth/useAppAuth'
import {
  clearManagementResourceCache,
  invalidateResource,
  invalidateResources,
  managementResourceScope,
  RESOURCE_NAMES,
} from '../services/resourceCache'
import { runResourceEventStream } from '../services/realtime'

const RECOVERY_RESOURCES = RESOURCE_NAMES

/** Keeps process-independent response caches fresh while this tab is open. */
export default function ResourceRealtimeBridge() {
  const { appUser, getToken, isLoaded, isSignedIn, refreshUser } = useAppAuth()
  const identity = managementResourceScope(appUser, isSignedIn)
  const previousIdentity = useRef<string | null>(null)

  useEffect(() => {
    if (previousIdentity.current !== identity) clearManagementResourceCache()
    previousIdentity.current = identity
  }, [identity])

  useEffect(() => {
    const recover = () => {
      if (document.visibilityState === 'hidden') return
      invalidateResources(RECOVERY_RESOURCES)
    }
    window.addEventListener('focus', recover)
    document.addEventListener('visibilitychange', recover)
    return () => {
      window.removeEventListener('focus', recover)
      document.removeEventListener('visibilitychange', recover)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !appUser) return

    const controller = new AbortController()
    void runResourceEventStream({
      getToken,
      signal: controller.signal,
      onResource: (resource) => {
        invalidateResource(resource)
        // Dashboard totals include every resource monitored by the stream.
        invalidateResource('dashboard')
        if (resource === 'users') void refreshUser({ background: true })
      },
      onReconnect: () => invalidateResources(RECOVERY_RESOURCES),
    })

    return () => controller.abort()
  }, [appUser, getToken, isLoaded, isSignedIn, refreshUser])

  return null
}
