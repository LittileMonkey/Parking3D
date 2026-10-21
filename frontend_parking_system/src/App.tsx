import { Route, Routes, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import EmailVerified from "./pages/EmailVerified";
import SearchPage from "./pages/SearchPage";
import BookingStatusPage from "./pages/BookingStatusPage";
import FaqPage from "./pages/FaqPage";

// Staff Operations Portal Components
import StaffLayout from "./components/staff/StaffLayout";
import StaffDashboard from "./pages/staff/StaffDashboard";
import VehicleOperations from "./pages/staff/VehicleOperations";
import LiveParkingView from "./pages/staff/LiveParkingView";
import IncidentsExceptions from "./pages/staff/IncidentsExceptions";
import ShiftManagement from "./pages/staff/ShiftManagement";

// Manager Operations Dashboard Components
import ManagerLayout from "./components/manager/ManagerLayout";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import PricingPolicyPage from "./pages/manager/PricingPolicyPage";
import FacilityLayoutPage from "./pages/manager/FacilityLayoutPage";
import StaffShiftsPage from "./pages/manager/StaffShiftsPage";
import IncidentsApprovalsPage from "./pages/manager/IncidentsApprovalsPage";
import ReportsAuditPage from "./pages/manager/ReportsAuditPage";

const Booking = lazy(() => import("./pages/Booking"));

export default function App() {
  return (
    <Routes>
      {/* Customer / Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/booking" element={<Suspense fallback={<p role="status">Đang tải trang đặt chỗ 3D…</p>}><Booking /></Suspense>} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/bookings/:bookingId" element={<BookingStatusPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/email-verified" element={<EmailVerified />} />

      {/* Staff Operations Portal Routes */}
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="operations" element={<VehicleOperations />} />
        <Route path="parking" element={<LiveParkingView />} />
        <Route path="incidents" element={<IncidentsExceptions />} />
        <Route path="shifts" element={<ShiftManagement />} />
      </Route>

      {/* Manager Operations Portal Routes */}
      <Route path="/manager" element={<ManagerLayout />}>
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route path="pricing" element={<PricingPolicyPage />} />
        <Route path="facility-layout" element={<FacilityLayoutPage />} />
        <Route path="staff-shifts" element={<StaffShiftsPage />} />
        <Route path="incidents-approvals" element={<IncidentsApprovalsPage />} />
        <Route path="reports-audit" element={<ReportsAuditPage />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
