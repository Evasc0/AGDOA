import { useAdminGuard } from "../hooks/useAdminGuard";
import { useAuth } from "../components/AuthContext";
import { Navigate } from "react-router-dom";

const ADMIN_EMAIL = "agduwaadmin@gmail.com";

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { loading, user } = useAuth();
  useAdminGuard();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <div className="animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full"></div>
        <span className="ml-3">Checking access...</span>
      </div>
    );
  }

  // If no user or user is not admin, redirect to login or home
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return <Navigate to="/" replace />;
  }

  // User is admin, render children
  return <>{children}</>;
};

export default ProtectedAdminRoute;
