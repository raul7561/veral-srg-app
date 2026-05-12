import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Orders from './pages/Orders'
import SupplierTracking from './pages/SupplierTracking'
import ReceivingHistory from './pages/ReceivingHistory'
import ReadyToDispatch from './pages/ReadyToDispatch'
import ShipmentMovement from './pages/ShipmentMovement'
import Customers from './pages/Customers'
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
            <Route path="/receiving-history" element={<ReceivingHistory />} />
            <Route path="/ready-to-dispatch" element={<ReadyToDispatch />} />
            <Route path="/shipment-movement" element={<ShipmentMovement />} />
            <Route path="/customers" element={<Customers />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}