import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import './i18n'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#F5F0E8]">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Orders />} />
            <Route path="/supplier-tracking" element={<SupplierTracking />} />
            <Route path="/supplier-tracking/:soNumber" element={<SupplierOrderDetail />} />
            <Route path="/receiving-history" element={<ReceivingHistory />} />
            <Route path="/receiving-history/:soNumber" element={<ReceivingHistoryDetail />} />
            <Route path="/ready-to-dispatch" element={<ReadyToDispatch />} />
            <Route path="/shipment-movement" element={<ShipmentMovement />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}