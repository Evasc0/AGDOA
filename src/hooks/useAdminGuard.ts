// src/hooks/useAdminGuard.ts
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export const useAdminGuard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();
      if (!user || !isAdmin) {
        navigate("/home"); // redirect non-admins
      }
    }
  }, [user, loading, navigate]);
};
