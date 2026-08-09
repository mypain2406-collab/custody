import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, roleHome } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Inmates from "@/pages/Inmates";
import Activities from "@/pages/Activities";
import Approvals from "@/pages/Approvals";
import Locations from "@/pages/Locations";
import Users from "@/pages/Users";
import AuditLog from "@/pages/AuditLog";
import Settings from "@/pages/Settings";
import BarcodeCenter from "@/pages/BarcodeCenter";
import ScanPage from "@/pages/ScanPage";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-screen">
        <div className="h-1 w-40 bg-muted overflow-hidden">
          <div className="h-full w-1/2 bg-primary animate-pulse" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  return <Login />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/scan" element={<Protected roles={["operator", "admin", "supervisor"]}><ScanPage /></Protected>} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inmates" element={<Inmates />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/approvals" element={<Protected roles={["admin", "supervisor"]}><Approvals /></Protected>} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/barcodes" element={<Protected roles={["admin", "supervisor"]}><BarcodeCenter /></Protected>} />
            <Route path="/users" element={<Protected roles={["admin"]}><Users /></Protected>} />
            <Route path="/audit" element={<Protected roles={["admin"]}><AuditLog /></Protected>} />
            <Route path="/settings" element={<Protected roles={["admin"]}><Settings /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
