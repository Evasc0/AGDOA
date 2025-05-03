// src/App.tsx
import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth } from "./firebase";

import Home from "./pages/Home";
import Login from "./pages/Login";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Layout from "./components/Layout";
import DriverPublicProfile from "./pages/DriverPublicProfile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Toaster, toast } from "react-hot-toast";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Firebase User:", firebaseUser); // Debug log

      if (firebaseUser) {
        setUser(firebaseUser);
        const isAdminUser =
          firebaseUser.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();

        if (isAdminUser) {
          try {
            await addDoc(collection(db, "adminAccessLogs"), {
              email: firebaseUser.email,
              uid: firebaseUser.uid,
              accessedAt: serverTimestamp(),
            });
            toast.success("✅ Welcome, Admin!");
          } catch (error) {
            console.error("Error logging admin access:", error);
          }
        } else {
          toast.success("✅ Logged in successfully!");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <span className="ml-4">Loading...</span>
      </div>
    );
  }

  const isAuthenticated = !!user;
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();

  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        {/* Root route */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              isAdmin ? (
                <Navigate to="/admin" replace />
              ) : (
                <Navigate to="/home" replace />
              )
            ) : (
              <Login />
            )
          }
        />

        {/* Public route for viewing driver profiles (accessible without login) */}
        <Route path="/driver/:id" element={<DriverPublicProfile />} />

        {/* Protected routes, accessible only if authenticated */}
        {isAuthenticated && (
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        )}

        {/* Admin route with protection */}
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <Admin />
            </ProtectedAdminRoute>
          }
        />

        {/* Redirect unauthenticated users trying to access protected routes */}
        {!isAuthenticated && <Route path="*" element={<Navigate to="/" />} />}

        {/* Not Found fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;