import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import OpportunityPage from './pages/OpportunityPage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/opportunity/:id" element={<OpportunityPage />} />
      </Routes>
    </Layout>
  )
}

export default App
