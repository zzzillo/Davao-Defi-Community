import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute, { RequireAdminModule } from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import Landing from './pages/public/Landing'
import PublicEvents from './pages/public/Posts'
import PublicContributors from './pages/public/Contributors'
import ContributorDetails from './pages/public/ContributorDetails'
import JoinUs from './pages/public/JoinUs'
import EventDetails from './pages/public/EventDetails'
import PublicBlogs from './pages/public/Blogs'
import BlogDetails from './pages/public/BlogDetails'
import PublicPartners from './pages/public/Partners'
import PostDetails from './pages/public/PostDetails'
import Blogs from './pages/officials/Blogs'
import Dashboard from './pages/officials/Dashboard'
import Events from './pages/officials/Events'
import Partners from './pages/officials/Partners'
import Activity from './pages/officials/Activity'
import Users from './pages/officials/Users'
import Profile from './pages/officials/Profile'
import NewEvent from './pages/officials/NewEvent'
import NewBlog from './pages/officials/NewBlog'
import NewPartner from './pages/officials/NewPartner'
import Posts from './pages/officials/Posts'
import NewPost from './pages/officials/NewPost'
import SignUpPage from './pages/auth/SignUp'
import SignInPage from './pages/auth/SignIn'
import { ToastProvider } from './components/Toast'

function App() {
  return (
    <ToastProvider>
    <Routes>

      {/*
        Published public content is available without sign-in.

        Keeping the landing page in this shell lets the same navbar remain
        mounted as visitors move between public pages.
      */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="landing.html" element={<Landing />} />
        <Route path="events" element={<PublicEvents />} />
        <Route path="events/:id" element={<PostDetails />} />
        <Route path="rsvp/:id" element={<EventDetails />} />
        <Route path="contributors" element={<PublicContributors />} />
        <Route path="contributors/:slug" element={<ContributorDetails />} />
        <Route path="join-us" element={<JoinUs />} />

        <Route path="recaps" element={<Navigate to="/events" replace />} />
        <Route path="recaps/:id" element={<LegacyEventRedirect />} />
        <Route path="posts" element={<Navigate to="/events" replace />} />
        <Route path="posts/:id" element={<LegacyEventRedirect />} />

        {/*
          An article is addressed by slug rather than by id, and a slug is a
          word somebody typed. Under /blogs/:slug, an article titled "New"
          would sit at /blogs/new - indistinguishable from a route. Splitting
          the index from the article makes that collision impossible rather
          than merely unlikely, which is worth one irregular URL.
        */}
        <Route path="blogs" element={<PublicBlogs />} />
        <Route path="blog/:slug" element={<BlogDetails />} />

        {/*
          One route, not two. Every other module here has a list and a detail
          page; a partner has nothing a card does not already show, so there is
          nowhere for a detail page to go.
        */}
        <Route path="partners" element={<PublicPartners />} />
      </Route>

      {/*
        The officials' admin app - signed-in only, redirected to /sign-in
        otherwise.

        Nested under /admin so the public site can have plain URLs. RSVP details
        live at /rsvp/<id>, and photo galleries use /events/<id>.
      */}
      <Route path="admin" element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />

          <Route path="events" element={<RequireAdminModule module="posts"><Posts /></RequireAdminModule>} />
          <Route path="events/new" element={<RequireAdminModule module="posts"><NewPost /></RequireAdminModule>} />
          <Route path="events/edit/:id" element={<RequireAdminModule module="posts"><NewPost /></RequireAdminModule>} />

          <Route path="rsvp" element={<RequireAdminModule module="events"><Events /></RequireAdminModule>} />
          <Route path="rsvp/new" element={<RequireAdminModule module="events"><NewEvent /></RequireAdminModule>} />
          <Route path="rsvp/edit/:id" element={<RequireAdminModule module="events"><NewEvent /></RequireAdminModule>} />

          <Route path="posts" element={<Navigate to="/admin/events" replace />} />
          <Route path="posts/new" element={<Navigate to="/admin/events/new" replace />} />
          <Route path="posts/edit/:id" element={<LegacyAdminEventRedirect />} />

          <Route path="blogs" element={<Blogs />} />
          <Route path="blogs/new" element={<NewBlog />} />
          <Route path="blogs/edit/:id" element={<NewBlog />} />

          <Route path="partners" element={<RequireAdminModule module="partners"><Partners /></RequireAdminModule>} />
          <Route path="partners/new" element={<RequireAdminModule module="partners"><NewPartner /></RequireAdminModule>} />
          <Route path="partners/edit/:id" element={<RequireAdminModule module="partners"><NewPartner /></RequireAdminModule>} />

          <Route path="activity" element={<RequireAdminModule module="activity"><Activity /></RequireAdminModule>} />
          <Route path="users" element={<RequireAdminModule module="users"><Users /></RequireAdminModule>} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Authentication - NO Layout */}
      <Route path="sign-in/*" element={<SignInPage />} />
      <Route path="sign-up/*" element={<SignUpPage />} />
    </Routes>
    </ToastProvider>
  )
}

function LegacyEventRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/events/${encodeURIComponent(id)}` : '/events'} replace />
}

function LegacyAdminEventRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/admin/events/edit/${encodeURIComponent(id)}` : '/admin/events'} replace />
}

export default App
