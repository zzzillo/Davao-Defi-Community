import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Blogs from './pages/Blogs'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Partners from './pages/Partners'
import Activity from './pages/Activity'
import NewEvent from './pages/NewEvent'
import NewBlog from './pages/NewBlog'
import NewPartner from './pages/NewPartner'

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
      </Route>
    </Routes>
  )
}

export default App
