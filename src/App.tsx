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
    const loaderCSS = `
      .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      .car {
        animation: speeder 0.4s linear infinite;
        width: 900px;
        height: 900px;
      }
      @media (max-width: 768px) {
        .car {
          width: 300px;
          height: 300px;
        }
      }
      .longfazers {
        position: absolute;
        width: 100%;
        height: 100%;
        z-index: 1;
      }
      .longfazers span {
        position: absolute;
        height: 2px;
        width: 20%;
        background: #000;
      }
      .longfazers span:nth-child(1) {
        top: 20%;
        animation: lf 0.6s linear infinite;
        animation-delay: -5s;
      }
      .longfazers span:nth-child(2) {
        top: 40%;
        animation: lf2 0.8s linear infinite;
        animation-delay: -1s;
      }
      .longfazers span:nth-child(3) {
        top: 60%;
        animation: lf3 0.6s linear infinite;
      }
      .longfazers span:nth-child(4) {
        top: 80%;
        animation: lf4 0.5s linear infinite;
        animation-delay: -3s;
      }
      @keyframes lf {
        0% {
          left: 50%;
          transform: translateY(0px);
        }
        25% {
          transform: translateY(-10px);
        }
        50% {
          transform: translateY(0px);
        }
        75% {
          transform: translateY(10px);
        }
        100% {
          left: -200%;
          opacity: 0;
          transform: translateY(0px);
        }
      }
      @keyframes lf2 {
        0% {
          left: 50%;
          transform: translateY(0px);
        }
        25% {
          transform: translateY(10px);
        }
        50% {
          transform: translateY(0px);
        }
        75% {
          transform: translateY(-10px);
        }
        100% {
          left: -200%;
          opacity: 0;
          transform: translateY(0px);
        }
      }
      @keyframes lf3 {
        0% {
          left: 50%;
          transform: translateY(0px);
        }
        25% {
          transform: translateY(-10px);
        }
        50% {
          transform: translateY(0px);
        }
        75% {
          transform: translateY(10px);
        }
        100% {
          left: -200%;
          opacity: 0;
          transform: translateY(0px);
        }
      }
      @keyframes lf4 {
        0% {
          left: 50%;
          transform: translateY(0px);
        }
        25% {
          transform: translateY(10px);
        }
        50% {
          transform: translateY(0px);
        }
        75% {
          transform: translateY(-10px);
        }
        100% {
          left: -200%;
          opacity: 0;
          transform: translateY(0px);
        }
      }
      @keyframes speeder {
        0% {
          transform: translate(2px, 1px) rotate(0deg);
        }
        10% {
          transform: translate(-1px, -3px) rotate(-1deg);
        }
        20% {
          transform: translate(-2px, 0px) rotate(1deg);
        }
        30% {
          transform: translate(1px, 2px) rotate(0deg);
        }
        40% {
          transform: translate(1px, -1px) rotate(1deg);
        }
        50% {
          transform: translate(-1px, 3px) rotate(-1deg);
        }
        60% {
          transform: translate(-1px, 1px) rotate(0deg);
        }
        70% {
          transform: translate(3px, 1px) rotate(-1deg);
        }
        80% {
          transform: translate(-2px, -1px) rotate(1deg);
        }
        90% {
          transform: translate(2px, 1px) rotate(0deg);
        }
        100% {
          transform: translate(1px, -2px) rotate(-1deg);
        }
      }
    `;
    return (
      <div className="h-screen bg-white relative">
        <style dangerouslySetInnerHTML={{ __html: loaderCSS }} />
        <div className="loader">
          <img src="/img/vecteezy_sports-car-logo-icon-motor-vehicle-silhouette-emblems-auto_.jpg" alt="car" className="car" />
        </div>
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
        <Route path="/driver/:driverId" element={<DriverPublicProfile />} />

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
