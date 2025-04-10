import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
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

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminRedirected, setAdminRedirected] = useState(false); // ✅ Prevent double redirects
  const db = getFirestore();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const isAdminUser = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();

        if (isAdminUser && !adminRedirected) {
          try {
            await addDoc(collection(db, "adminAccessLogs"), {
              email: firebaseUser.email,
              uid: firebaseUser.uid,
              accessedAt: serverTimestamp(),
            });
          } catch (error) {
            console.error("Error logging admin access:", error);
          }

          // ✅ Alert + Redirect
          alert("✅ Logged in as Admin");
          navigate("/admin");
          setAdminRedirected(true);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [adminRedirected, navigate]);

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
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/home" /> : <Login />} />

      {isAuthenticated && (
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/driver/:id" element={<DriverPublicProfile />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
        </Route>
      )}

      {!isAuthenticated && <Route path="*" element={<Navigate to="/" />} />}
      {isAuthenticated && !isAdmin && <Route path="/admin" element={<Navigate to="/home" />} />}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;
