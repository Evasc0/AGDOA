// src/hooks/useAdminGuard.ts
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { isAdminEmail } from "../utils/admin";

export const useAdminGuard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      const isAdmin = isAdminEmail(user?.email);
      if (!user || !isAdmin) {
        navigate("/home"); // redirect non-admins
      }
    }
  }, [user, loading, navigate]);
};
