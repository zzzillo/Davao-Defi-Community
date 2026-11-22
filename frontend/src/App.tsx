import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import ProtectedRoute, { RequireAdminModule } from './components/ProtectedRoute'
import PageMeta from './components/PageMeta'
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
import NotFound from './pages/public/NotFound'
import { ToastProvider } from './components/Toast'
import LoadingScreen from './components/LoadingScreen'

// Officials and auth screens are split out of the public bundle. A visitor
// reading the site never downloads the admin pages, the editor, or Clerk's UI.
const Layout = lazy(() => import('./components/Layout'))
const Blogs = lazy(() => import('./pages/officials/Blogs'))
const Dashboard = lazy(() => import('./pages/officials/Dashboard'))
const Events = lazy(() => import('./pages/officials/Events'))
const Partners = lazy(() => import('./pages/officials/Partners'))
const Activity = lazy(() => import('./pages/officials/Activity'))
const Users = lazy(() => import('./pages/officials/Users'))
const Profile = lazy(() => import('./pages/officials/Profile'))
const NewEvent = lazy(() => import('./pages/officials/NewEvent'))
const NewBlog = lazy(() => import('./pages/officials/NewBlog'))
const NewPartner = lazy(() => import('./pages/officials/NewPartner'))
const Posts = lazy(() => import('./pages/officials/Posts'))
const NewPost = lazy(() => import('./pages/officials/NewPost'))
const SignUpPage = lazy(() => import('./pages/auth/SignUp'))
const SignInPage = lazy(() => import('./pages/auth/SignIn'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPassword'))

function App() {
  return (
    <ToastProvider>
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="events/:id/:slug?" element={<PostDetails />} />
        <Route path="rsvp/:id/:slug?" element={<EventDetails />} />
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

        <Route path="*" element={<NotFound />} />
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
      <Route path="sign-in/*" element={<><PageMeta title="Sign in" noindex /><SignInPage /></>} />
      <Route path="sign-up/*" element={<><PageMeta title="Sign up" noindex /><SignUpPage /></>} />
      <Route path="reset-password" element={<><PageMeta title="Reset password" noindex /><ResetPasswordPage /></>} />
    </Routes>
    </Suspense>
    </ToastProvider>
  )
}

/** Shown while a split-out route's code loads; public routes never suspend. */
function RouteFallback() {
  const { pathname } = useLocation()
  return pathname.startsWith('/admin') ? <LoadingScreen /> : null
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
