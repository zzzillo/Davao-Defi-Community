import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import PublicEvents from './pages/public/Events'
import EventDetails from './pages/public/EventDetails'
import PublicPosts from './pages/public/Posts'
import PostDetails from './pages/public/PostDetails'
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

      {/*
        The public site. No sign-in, no permission: GET /events serves published
        events to anonymous callers, so every page in here works signed out.

        Root forwards to /events until there is a home page to put there.
      */}
      <Route element={<PublicLayout />}>
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="events" element={<PublicEvents />} />
        <Route path="events/:id" element={<EventDetails />} />

        <Route path="posts" element={<PublicPosts />} />
        <Route path="posts/:id" element={<PostDetails />} />
      </Route>

      {/*
        The officials' admin app - signed-in only, redirected to /sign-in
        otherwise.

        Nested under /admin so the public site can have the plain URLs. An
        event's shareable address is /events/<id>; /admin/events is the table
        officials manage it from.
      */}
      <Route path="admin" element={<ProtectedRoute />}>
        <Route element={<Layout />}>
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
      </Route>

      {/* Authentication - NO Layout */}
      <Route path="sign-in" element={<SignInPage />} />
      <Route path="sign-up" element={<SignUpPage />} />

      <Route path="auth-test" element={<AuthTest />} />
    </Routes>
  )
}

export default App
