import { X } from "lucide-react";
import { db, auth } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fareMatrix } from "../utils/fareMatrix";
import { useRide } from "../components/RideContext";

const AVERAGE_WAIT_TIME_PER_DRIVER = 5; // in minutes

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
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-4 relative">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Welcome, {driver?.name ?? "Driver"}</h2>
          {isOnline ? (
            <button
              onClick={handleGoOffline}
              className="px-4 py-1 text-sm rounded font-semibold bg-red-600 hover:bg-red-700 transition"
            >
              Go Offline
            </button>
          ) : (
            <button
              onClick={handleGoOnlineAgain}
              className="px-4 py-1 text-sm rounded font-semibold bg-green-600 hover:bg-green-700 transition"
            >
              Go Online
            </button>
          )}
        </div>

        <hr className="border-gray-700 mb-4" />

        {/* Live Ride Status */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-1">🚦 Ride Status:</p>
          <p
            className={`text-sm ${
              rideStatus === "In Ride"
                ? "text-blue-400"
                : rideStatus === "Waiting"
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {rideStatus}
          </p>
        </div>

        {/* Location Status */}
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-1">
            📍 <span className="font-semibold">Location Status:</span>
          </p>
          <p
            className={`${
              insideParadahan ? "text-green-400" : "text-red-400"
            } text-sm`}
          >
            {gpsError
              ? `⚠️ ${gpsError}`
              : insideParadahan
              ? "Inside Paradahan"
              : "Outside Paradahan"}
          </p>
        </div>

        {/* Vehicle Info */}
        <div className="bg-gray-700 p-3 rounded-lg mb-4">
          <p className="text-sm font-semibold mb-1">Vehicle Information</p>
          <p>
            <strong>Plate Number:</strong> {driver?.plate}
          </p>
          <p>
            <strong>Vehicle:</strong> {driver?.vehicle}
          </p>
        </div>

        {/* Destination Selection */}
        <div className="mb-4">
          <p className="text-sm font-bold mb-1">📍 Destination:</p>
          <select
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
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
          <div className="bg-gray-700 p-4 rounded-lg mb-4">
            <p className="text-sm font-bold mb-2">🚕 Queue Status</p>
            <p className="text-sm mb-2">
              Your position:{" "}
              <span className="font-semibold text-yellow-300">
                {position ?? "N/A"}
              </span>
            </p>
            <p className="text-sm mb-2">
              ⏳ Estimated Wait:{" "}
              <span className="font-semibold text-blue-300">{countdown}</span>
            </p>

            {position === 1 && (
              <div className="text-green-400 font-bold mb-2 animate-pulse">
                ✅ It’s your turn! Get ready for a ride.
              </div>
            )}

            <div className="mt-2">
              <p className="text-sm font-semibold mb-1 text-gray-300">
                Current Queue:
              </p>
              <div className="space-y-1">
                <AnimatePresence>
                  {queue.map((item, index) => (
                    <motion.div
                      key={item.driverId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className={`text-sm px-3 py-1 rounded ${
                        item.driverId === driver?.id
                          ? "bg-yellow-700 text-white"
                          : "bg-gray-600 text-gray-100"
                      }`}
                    >
                      {index + 1}. {item.plateNumber}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Start Ride Button */}
        {position === 1 && !rideStarted && (
          <button
            onClick={handleStartRide}
            disabled={!selectedDestination}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Ride
          </button>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-md flex items-center gap-2 animate-fadeIn text-sm z-50">
          {toastMsg}
          <button onClick={() => setToastMsg("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;
