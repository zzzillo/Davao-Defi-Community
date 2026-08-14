import { useAuth } from '@clerk/react'

function AuthTest() {
  const { getToken, isSignedIn } = useAuth()

  const testBackend = async () => {
    if (!isSignedIn) {
      console.log('You are not signed in')
      return
    }

    const token = await getToken()

    const response = await fetch(
      'http://127.0.0.1:8000/auth_test',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error(`Backend rejected the token (${response.status})`, data.detail)
      return
    }

    console.log(data)
  }

  return (
    <button onClick={testBackend}>
      Test Backend Authentication
    </button>
  )
}

export default AuthTest
