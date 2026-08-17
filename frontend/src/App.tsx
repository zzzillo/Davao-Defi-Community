import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Blogs from './pages/officials/Blogs'
import Dashboard from './pages/officials/Dashboard'
import Events from './pages/officials/Events'
import Partners from './pages/officials/Partners'
import Activity from './pages/officials/Activity'
import Profile from './pages/officials/Profile'
import NewEvent from './pages/officials/NewEvent'
import NewBlog from './pages/officials/NewBlog'
import NewPartner from './pages/officials/NewPartner'
import Posts from './pages/officials/Posts'
import NewPost from './pages/officials/NewPost'
import SignUpPage from './pages/auth/SignUp'
import SignInPage from './pages/auth/SignIn'
import AuthTest from './components/AuthTest'

function App() {
  return (
    <Routes>

      {/* Officials pages - signed-in only, redirected to /sign-in otherwise */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />

        <Route path="events" element={<Events />} />
        <Route path="events/new" element={<NewEvent />} />
        <Route path="events/edit/:id" element={<NewEvent />} />

        <Route path="blogs" element={<Blogs />} />
        <Route path="blogs/new" element={<NewBlog />} />
        <Route path="blogs/edit/:id" element={<NewBlog />} />

        <Route path="posts" element={<Posts />} />
        <Route path="posts/new" element={<NewPost />} />
        <Route path="posts/edit/:id" element={<NewPost />} />

        <Route path="partners" element={<Partners />} />
        <Route path="partners/new" element={<NewPartner />} />
        <Route path="partners/edit/:id" element={<NewPartner />} />

        <Route path="activity" element={<Activity />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Authentication - NO Layout */}
      <Route path="sign-in" element={<SignInPage />} />
      <Route path="sign-up" element={<SignUpPage />} />

      <Route path="auth-test" element={<AuthTest />} />
    </Routes>
  )
}

export default App
