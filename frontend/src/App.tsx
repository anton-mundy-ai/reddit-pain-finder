import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import OpportunityPage from './pages/OpportunityPage'
import TopicsPage from './pages/TopicsPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/opportunity/:id" element={<OpportunityPage />} />
        <Route path="/topics" element={<TopicsPage />} />
      </Routes>
    </Layout>
  )
}

export default App
