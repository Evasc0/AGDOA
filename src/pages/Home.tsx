import { X } from "lucide-react";
import { db, auth } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fareMatrix } from "../utils/fareMatrix";
import { useRide } from "../components/RideContext";

const AVERAGE_WAIT_TIME_PER_DRIVER = 20; // in minutes

const Home = () => {
  const navigate = useNavigate();
  const {
    driver,
    isOnline,
    hasJoined,
    queue,
    position,
    rideStarted,
    countdown,
    rideStatus,
    selectedDestination,
    setSelectedDestination,
    handleGoOffline,
    handleGoOnlineAgain,
    handleStartRide,
    setToastMsg,
    coords,
    insideParadahan,
    gpsError,
    toastMsg,
  } = useRide();

  // Logout: Set status to offline, remove from queue, sign out, navigate to login
  const handleLogout = async () => {
    if (!driver) return;
    try {
      // Remove from queue if present
      const queueRef = doc(db, "queues", driver.id);
      try {
        await deleteDoc(queueRef);
      } catch (error) {
        // Ignore if not in queue
      }
      // Set status to offline
      const driverRef = doc(db, "drivers", driver.id);
      await setDoc(driverRef, { status: "offline" }, { merge: true });

      await signOut(auth);
      localStorage.removeItem("driver");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      setToastMsg("⚠️ Logout failed. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-start min-h-screen relative">
          <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-lg animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold animate-slide-down">Welcome, {driver?.name ?? "Driver"}</h2>
              {isOnline ? (
                <button
                  onClick={handleGoOffline}
                  className="px-4 py-2 text-sm rounded-full font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Go Offline
                </button>
              ) : (
                <button
                  onClick={handleGoOnlineAgain}
                  className="px-4 py-2 text-sm rounded-full font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Go Online
                </button>
              )}
            </div>

            <hr className="border-gray-300 mb-6" />

            {/* Status Cards */}
            <div className="grid grid-cols-1 gap-4 mb-6">
              {/* Live Ride Status */}
              <div className="bg-white p-4 rounded-xl shadow-lg animate-slide-up">
                <p className="text-sm font-bold mb-2">🚦 Ride Status:</p>
                <p
                  className={`text-lg font-semibold ${
                    rideStatus === "In Ride"
                      ? "text-blue-600"
                      : rideStatus === "Waiting"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {rideStatus}
                </p>
              </div>

              {/* Location Status */}
              <div className="bg-white p-4 rounded-xl shadow-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <p className="text-sm font-bold mb-2">
                  📍 <span className="font-semibold">Location Status:</span>
                </p>
                <p
                  className={`text-lg font-semibold ${
                    insideParadahan ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {gpsError
                    ? `⚠️ ${gpsError}`
                    : insideParadahan
                    ? "Inside Paradahan"
                    : "Outside Paradahan"}
                </p>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="bg-white p-4 rounded-xl shadow-lg mb-6 animate-fade-in-left">
              <p className="text-lg font-semibold mb-3">Vehicle Information</p>
              <div className="space-y-2">
                <p className="flex justify-between">
                  <span className="font-medium">Plate Number:</span>
                  <span className="text-gray-700">{driver?.plate}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-medium">Vehicle:</span>
                  <span className="text-gray-700">{driver?.vehicle}</span>
                </p>
              </div>
            </div>

            {/* Destination Selection */}
            <div className="bg-white p-4 rounded-xl shadow-lg mb-6 animate-fade-in-right">
              <p className="text-lg font-semibold mb-3">📍 Destination:</p>
              <select
                className="w-full p-3 rounded-lg bg-gray-50 text-gray-900 border border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                value={selectedDestination || ""}
                onChange={(e) => setSelectedDestination(e.target.value)}
              >
                <option value="">Select Destination</option>
                {Object.keys(fareMatrix).map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            {/* Queue Info - ONLY show if in queue and NOT in ride */}
            {hasJoined && !rideStarted && (
              <div className="bg-white p-4 rounded-xl shadow-lg mb-6 animate-fade-in-up">
                <p className="text-lg font-semibold mb-4">🚕 Queue Status</p>
                <div className="space-y-3">
                  <p className="flex justify-between items-center">
                    <span className="font-medium">Your position:</span>
                    <span className="text-xl font-bold text-yellow-600">
                      {position ?? "N/A"}
                    </span>
                  </p>
                  <p className="flex justify-between items-center">
                    <span className="font-medium">⏳ Estimated Wait:</span>
                    <span className="text-xl font-bold text-blue-600">{countdown}</span>
                  </p>

                  {position === 1 && (
                    <div className="text-green-600 font-bold text-center p-3 bg-green-50 rounded-lg animate-pulse">
                      ✅ It’s your turn! Get ready for a ride.
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-sm font-semibold mb-2 text-gray-700">
                      Current Queue:
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      <AnimatePresence>
                        {queue.map((item, index) => (
                          <motion.div
                            key={item.driverId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className={`text-sm px-3 py-2 rounded-lg shadow-sm ${
                              item.driverId === driver?.id
                                ? "bg-yellow-100 text-gray-900 border border-yellow-300"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            {index + 1}. {item.plateNumber}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Start Ride Button */}
            {position === 1 && !rideStarted && (
              <button
                onClick={handleStartRide}
                disabled={!selectedDestination}
                className="w-full py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Start Ride
              </button>
            )}
          </div>

          {/* Toast */}
          {toastMsg && (
            <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in text-sm z-50">
              {toastMsg}
              <button onClick={() => setToastMsg("")} className="hover:bg-blue-700 rounded-full p-1 transition-colors">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
