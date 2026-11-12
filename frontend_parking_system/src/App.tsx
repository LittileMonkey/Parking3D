import MyAccount from "./pages/MyAccount";
import PaymentReturn from "./pages/PaymentReturn";
import GuestLogin from "./pages/GuestLogin";
import SecurityPage from "./pages/SecurityPage";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import { lazy, Suspense, type ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import VerifyEmail from "./pages/VerifyEmail";
import EmailVerified from "./pages/EmailVerified";
import BookingStatusPage from "./pages/BookingStatusPage";
import FaqPage from "./pages/FaqPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";

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

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, isAuthenticated, getRedirectPath } = useAuth();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  const actualRoles = [...(user.roles ?? []), user.role ?? ""].map(role => role.trim().toUpperCase());
  return actualRoles.some(role => roles.includes(role)) ? children : <Navigate to={getRedirectPath()} replace />;
}

function SearchRedirect() {
  const location = useLocation();
  return <Navigate to={`/booking${location.search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/account" element={<MyAccount />} />
      <Route path="/payment-return" element={<PaymentReturn />} />
      <Route path="/guest-login" element={<GuestLogin />} />
      <Route path="/security" element={<SecurityPage />} />
      {/* Customer / Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/booking" element={<Suspense fallback={<p role="status">Đang tải tìm kiếm và đặt chỗ…</p>}><Booking /></Suspense>} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/search" element={<SearchRedirect />} />
      <Route path="/bookings/:bookingId" element={<BookingStatusPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/email-verified" element={<EmailVerified />} />

      {/* Staff Operations Portal Routes */}
      <Route path="/staff" element={<RequireRole roles={["PARKING_STAFF", "PARKING_MANAGER", "ADMIN"]}><StaffLayout /></RequireRole>}>
        <Route index element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboard />} />
        <Route path="operations" element={<VehicleOperations />} />
        <Route path="parking" element={<LiveParkingView />} />
        <Route path="incidents" element={<IncidentsExceptions />} />
        <Route path="shifts" element={<ShiftManagement />} />
      </Route>

      {/* Manager & Admin Operations Portal Routes */}
      <Route path="/manager" element={<RequireRole roles={["PARKING_MANAGER", "ADMIN"]}><ManagerLayout /></RequireRole>}>
        <Route index element={<Navigate to="/manager/dashboard" replace />} />
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route path="pricing" element={<PricingPolicyPage />} />
        <Route path="facility-layout" element={<FacilityLayoutPage />} />
        <Route path="staff-shifts" element={<StaffShiftsPage />} />
        <Route path="incidents-approvals" element={<IncidentsApprovalsPage />} />
        <Route path="reports-audit" element={<ReportsAuditPage />} />
      </Route>

      {/* Admin Portal Route Aliases */}
      <Route path="/admin" element={<Navigate to="/manager/dashboard" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/manager/dashboard" replace />} />
      <Route path="/admin/*" element={<Navigate to="/manager/dashboard" replace />} />

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
