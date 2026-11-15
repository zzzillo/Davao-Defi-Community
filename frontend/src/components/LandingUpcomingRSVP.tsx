import type { LandingSnapshot } from '../services/landingSnapshot'
import UpcomingEvent from './UpcomingEvent'

export default function LandingUpcomingRSVP({ event }: Pick<LandingSnapshot, 'event'>) {
  if (!event || event.kind !== 'upcoming') return null
  return <UpcomingEvent event={event} />
}
