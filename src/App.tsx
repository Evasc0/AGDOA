import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Queue from "./pages/Queue";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import Layout from "./components/Layout";
import DriverPublicProfile from "./pages/DriverPublicProfile";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const driver = localStorage.getItem("driver");
    setIsAuthenticated(!!driver);
  }, []);


  return (
    <Routes>
      {/* Public route */}
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/home" /> : <Login setIsAuthenticated={setIsAuthenticated} />
        }
      />

      {/* Protected routes */}
      {isAuthenticated && (
        <Route element={<Layout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/driver/:id" element={<DriverPublicProfile />} />
        </Route>
      )}

      {/* Catch-all: redirect unauth users */}
      {!isAuthenticated && <Route path="*" element={<Navigate to="/" />} />}
    </Routes>
  );
};

export default App;
