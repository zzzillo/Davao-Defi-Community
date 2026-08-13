import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Blogs from './pages/officials/Blogs'
import Dashboard from './pages/officials/Dashboard'
import Events from './pages/officials/Events'
import Partners from './pages/officials/Partners'
import Activity from './pages/officials/Activity'
import Profile from './pages/officials/Profile'
import NewEvent from './pages/officials/NewEvent'
import NewBlog from './pages/officials/NewBlog'
import NewPartner from './pages/officials/NewPartner'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="events" element={<Events />} />
        <Route path="events/new" element={<NewEvent />} />
        <Route path="blogs" element={<Blogs />} />
        <Route path="blogs/new" element={<NewBlog />} />
        <Route path="partners" element={<Partners />} />
        <Route path="partners/new" element={<NewPartner />} />
        <Route path="activity" element={<Activity />} />
        <Route path="profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

export default App
