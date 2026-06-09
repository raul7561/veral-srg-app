import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Orders from './pages/Orders'
import SupplierTracking from './pages/SupplierTracking'
import SupplierOrderDetail from './pages/SupplierOrderDetail'
import ReceivingHistory from './pages/ReceivingHistory'
import ReceivingHistoryDetail from './pages/ReceivingHistoryDetail'
import ReadyToDispatch from './pages/ReadyToDispatch'
import ShipmentMovement from './pages/ShipmentMovement'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Login from './pages/Login'
import './i18n'

function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleNavigation = () => {
    setCollapsed(current => !current)
    setMobileOpen(current => !current)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header onToggle={toggleNavigation} />
      <div className="flex flex-1">
        <Navbar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <main className="flex-1 bg-srg-cream">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout><Orders /></AppLayout></ProtectedRoute>} />
          <Route path="/supplier-tracking" element={<ProtectedRoute><AppLayout><SupplierTracking /></AppLayout></ProtectedRoute>} />
          <Route path="/supplier-tracking/:soNumber" element={<ProtectedRoute><AppLayout><SupplierOrderDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/receiving-history" element={<ProtectedRoute><AppLayout><ReceivingHistory /></AppLayout></ProtectedRoute>} />
          <Route path="/receiving-history/:soNumber" element={<ProtectedRoute><AppLayout><ReceivingHistoryDetail /></AppLayout></ProtectedRoute>} />
          <Route path="/ready-to-dispatch" element={<ProtectedRoute><AppLayout><ReadyToDispatch /></AppLayout></ProtectedRoute>} />
          <Route path="/shipment-movement" element={<ProtectedRoute><AppLayout><ShipmentMovement /></AppLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><AppLayout><CustomerDetail /></AppLayout></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
