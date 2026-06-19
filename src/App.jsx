import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import PaywallDemo from './pages/PaywallDemo.jsx'
import AgentDemo from './pages/AgentDemo.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/demo" element={<PaywallDemo />} />
      <Route path="/agent-demo" element={<AgentDemo />} />
    </Routes>
  )
}
