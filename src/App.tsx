import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
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
import { RideProvider } from "./components/RideContext";

// Unified admin email constant
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "agduwaadmin@gmail.com").trim().toLowerCase();

const App = () => {
  const [user, setUser ] = useState<any>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser ) => {
      if (firebaseUser ) {
        setUser (firebaseUser );

        const email = firebaseUser .email?.trim().toLowerCase() || "";
        console.log("ADMIN_EMAIL:", ADMIN_EMAIL);
        console.log("Logged in user email:", email);

        const isAdminUser  = email === ADMIN_EMAIL;
        console.log("Is admin user:", isAdminUser );

        if (isAdminUser ) {
          // Admin user: log access and mark verified
          try {
            await addDoc(collection(db, "adminAccessLogs"), {
              email: firebaseUser .email,
              uid: firebaseUser .uid,
              accessedAt: serverTimestamp(),
            });
            toast.success("✅ Welcome, Admin!");
          } catch (error) {
            console.error("Error logging admin access:", error);
          }
          setVerified(true); // Admins are always verified

          // Set localStorage for admin
          localStorage.setItem(
            "driver",
            JSON.stringify({
              id: firebaseUser .uid,
              email: firebaseUser .email,
              verified: true,
              // Add other admin fields if needed
            })
          );
        } else {
          // Non-admin user: check Firestore driver document for verification
          try {
            const driverDoc = await getDoc(doc(db, "drivers", firebaseUser .uid));
            if (driverDoc.exists()) {
              const data = driverDoc.data();
              if (data.verified) {
                setVerified(true);
                toast.success("✅ Logged in successfully!");

                // Set localStorage for driver
                localStorage.setItem(
                  "driver",
                  JSON.stringify({ id: firebaseUser .uid, email: firebaseUser .email, ...data })
                );
              } else {
                // Not verified: sign out and notify
                await auth.signOut();
                setUser (null);
                setVerified(false);
                toast.error(
                  "Your account is not verified by admin yet. Please wait for approval."
                );
                localStorage.removeItem("driver");
              }
            } else {
              // No driver doc found, sign out
              await auth.signOut();
              setUser (null);
              setVerified(false);
              toast.error("No profile found for this account.");
              localStorage.removeItem("driver");
            }
          } catch (error) {
            console.error("Error checking verification:", error);
            await auth.signOut();
            setUser (null);
            setVerified(false);
            toast.error("Error verifying account.");
            localStorage.removeItem("driver");
          }
        }
      } else {
        // No user logged in
        setUser (null);
        setVerified(false);
        localStorage.removeItem("driver");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <span className="ml-4">Loading...</span>
      </div>
    );
  }

  const isAuthenticated = !!user && verified === true;
  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL;

  return (
    <RideProvider>
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

        {/* Redirect unauthenticated or unverified users trying to access protected routes */}
        {!isAuthenticated && <Route path="*" element={<Navigate to="/" />} />}

        {/* Not Found fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </RideProvider>
  );
};

export default App;
