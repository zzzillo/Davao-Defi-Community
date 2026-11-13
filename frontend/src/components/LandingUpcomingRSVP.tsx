import { useEvents } from '../hooks/useEvents'
import type { LandingSnapshot } from '../services/landingSnapshot'
import UpcomingEvent from './UpcomingEvent'

export default function LandingUpcomingRSVP({ event }: Pick<LandingSnapshot, 'event'>) {
  const { events: upcomingRSVPs, loading: loadingRSVPs, error: rsvpError } = useEvents({ upcoming: true, limit: 1 })
  const liveRSVP = upcomingRSVPs[0]
  const snapshotRSVP = event?.kind === 'upcoming' ? event : null
  const upcomingRSVP = liveRSVP
    ? {
        id: liveRSVP.id,
        title: liveRSVP.title,
        description: liveRSVP.description ?? '',
        location: liveRSVP.location,
        start_datetime: liveRSVP.start_datetime,
        end_datetime: liveRSVP.end_datetime,
        image: liveRSVP.banner_image_url ? { src: liveRSVP.banner_image_url, variants: [] } : null,
        kind: 'upcoming' as const,
      }
    : loadingRSVPs || rsvpError ? snapshotRSVP : null

  if (!upcomingRSVP) return null

  return <UpcomingEvent event={upcomingRSVP} />
}
