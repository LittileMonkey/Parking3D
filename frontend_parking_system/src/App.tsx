import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { lazy, Suspense } from "react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import EmailVerified from "./pages/EmailVerified";

const Booking = lazy(() => import("./pages/Booking"));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/booking" element={<Suspense fallback={<p role="status">Đang tải trang đặt chỗ 3D…</p>}><Booking /></Suspense>} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/email-verified" element={<EmailVerified />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
