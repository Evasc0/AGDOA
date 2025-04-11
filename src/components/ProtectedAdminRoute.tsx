// src/components/ProtectedAdminRoute.tsx
import { useAdminGuard } from "../hooks/useAdminGuard";
import { useAuth } from "../components/AuthContext";

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

  return <>{user && children}</>;
};

export default ProtectedAdminRoute;
