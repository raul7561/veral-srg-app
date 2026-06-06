import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Navbar from './components/Navbar'
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
        <main className="flex-1 bg-[#F5F0E8]">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout><Orders /></AppLayout>} />
        <Route path="/supplier-tracking" element={<AppLayout><SupplierTracking /></AppLayout>} />
        <Route path="/supplier-tracking/:soNumber" element={<AppLayout><SupplierOrderDetail /></AppLayout>} />
        <Route path="/receiving-history" element={<AppLayout><ReceivingHistory /></AppLayout>} />
        <Route path="/receiving-history/:soNumber" element={<AppLayout><ReceivingHistoryDetail /></AppLayout>} />
        <Route path="/ready-to-dispatch" element={<AppLayout><ReadyToDispatch /></AppLayout>} />
        <Route path="/shipment-movement" element={<AppLayout><ShipmentMovement /></AppLayout>} />
        <Route path="/customers" element={<AppLayout><Customers /></AppLayout>} />
        <Route path="/customers/:id" element={<AppLayout><CustomerDetail /></AppLayout>} />
      </Routes>
    </BrowserRouter>
  )
}
