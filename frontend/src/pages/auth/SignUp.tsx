import { Navigate } from 'react-router-dom'

/** Account creation is represented by the same local sample account in demo mode. */
export default function SignUpPage() {
  return <Navigate to="/sign-in" replace />
}
