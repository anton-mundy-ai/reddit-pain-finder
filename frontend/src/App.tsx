// v18: App with Auth Provider
import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import OpportunityPage from './pages/OpportunityPage'
import TopicsPage from './pages/TopicsPage'
import CompetitorsPage from './pages/CompetitorsPage'
import TrendsPage from './pages/TrendsPage'

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/opportunity/:id" element={<OpportunityPage />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/competitors" element={<CompetitorsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}

export default App
