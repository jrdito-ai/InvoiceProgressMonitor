import { AuthProvider } from "./hooks/useAuthContext";
import LoginScreen from "./components/LoginScreen";
import InvoiceProgressMonitor from "./components/InvoiceProgressMonitor_v2";
import { useAuth } from "./hooks/useAuthContext";

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Loading...</div>;
  return isAuthenticated ? <InvoiceProgressMonitor /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
