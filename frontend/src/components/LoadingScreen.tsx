import { ProtectedRouteSkeleton } from './PageSkeleton'

/** Admin shell skeleton while authentication context is starting up. */
export default function LoadingScreen() {
  return <ProtectedRouteSkeleton />
}
