import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  orderBy,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { useDriverLocation } from "../hooks/useDriverLocation";
import { motion, AnimatePresence } from "framer-motion";
import { reverseGeocode } from "../utils/reverseGeocode";
import { haversineDistance } from "../utils/haversine";

const AVG_WAIT_MINUTES = 5;
const RATE_PER_5KM = 60;

const Home = () => {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [manualOffline, setManualOffline] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [rideStarted, setRideStarted] = useState(false);
  const [rideStartTime, setRideStartTime] = useState<Date | null>(null);
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [countdown, setCountdown] = useState("--:--");

  const { coords, insideParadahan, error: gpsError } = useDriverLocation();

  // Load driver
  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) setDriver(JSON.parse(stored));
  }, []);

  // Re-try pending ride sync from localStorage
  useEffect(() => {
    const unsynced = localStorage.getItem("unsyncedRide");
    if (unsynced && insideParadahan) {
      const ride = JSON.parse(unsynced);
      addDoc(collection(db, "ride_logs"), ride)
        .then(() => localStorage.removeItem("unsyncedRide"))
        .catch((err) => console.error("Sync failed:", err));
    }
  }, [insideParadahan]);

  // Auto join queue if inside
  useEffect(() => {
    const joinIfInside = async () => {
      if (driver && isOnline && insideParadahan && !hasJoined && !manualOffline) {
        const driverRef = doc(db, "queues", driver.id);
        await setDoc(driverRef, {
          driverId: driver.id,
          plateNumber: driver.plate,
          joinedAt: Timestamp.now(),
        });
        setHasJoined(true);
      }
    };
    joinIfInside();
  }, [insideParadahan, coords, driver, hasJoined, manualOffline, isOnline]);

  // Auto exit on geofence leave
  useEffect(() => {
    const handleExitParadahan = async () => {
      if (driver && hasJoined && !insideParadahan && coords) {
        await deleteDoc(doc(db, "queues", driver.id));
        setHasJoined(false);
        setPosition(null);
        setQueue([]);
        setToastMsg("⛔ You left the paradahan. Removed from the queue.");
        setTimeout(() => setToastMsg(""), 4000);

        setRideStarted(true);
        setRideStartTime(new Date());
        setPickupLocation({ lat: coords.latitude, lng: coords.longitude });
      }
    };
    handleExitParadahan();
  }, [insideParadahan, driver, hasJoined, coords]);

  // Return to paradahan = ride completed
  useEffect(() => {
    const handleReturn = async () => {
      if (rideStarted && insideParadahan && coords && rideStartTime) {
        const endedAt = new Date();
        const travelTime = Math.round((endedAt.getTime() - rideStartTime.getTime()) / 60000);
        const dropoffLocation = { lat: coords.latitude, lng: coords.longitude };
        const locationName = await reverseGeocode(dropoffLocation.lat, dropoffLocation.lng);

        const distance = pickupLocation
          ? haversineDistance(pickupLocation, dropoffLocation)
          : 0;
        const earnings = Math.round((distance / 5) * RATE_PER_5KM);

        const rideLog = {
          driverId: driver?.id,
          plateNumber: driver?.plate,
          startedAt: rideStartTime,
          endedAt,
          travelTimeMinutes: travelTime,
          pickupLocation,
          dropoffLocation,
          dropoffName: locationName,
          waitTimeMinutes: position ? (position - 1) * AVG_WAIT_MINUTES : null,
          distanceKM: Number(distance.toFixed(2)),
          estimatedEarnings: earnings,
          timestamp: Timestamp.now(),
        };

        try {
          await addDoc(collection(db, "ride_logs"), rideLog);
        } catch (err) {
          console.error("Failed to log ride, saving locally.", err);
          localStorage.setItem("unsyncedRide", JSON.stringify(rideLog));
        }

        setRideStarted(false);
        setRideStartTime(null);
        setPickupLocation(null);
        setToastMsg(`✅ Ride completed at ${locationName} — ₱${earnings}`);
        setTimeout(() => setToastMsg(""), 5000);
      }
    };
    handleReturn();
  }, [insideParadahan, coords]);

  // Queue listener
  useEffect(() => {
    const q = query(collection(db, "queues"), orderBy("joinedAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setQueue(data);
      const pos = data.findIndex((d) => d.driverId === driver?.id);
      setPosition(pos >= 0 ? pos + 1 : null);
    });
    return () => unsub();
  }, [driver]);

  // Wait countdown
  useEffect(() => {
    let interval: any;
    if (position) {
      let timeLeft = position * AVG_WAIT_MINUTES * 60;
      interval = setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 1);
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        setCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      }, 1000);
    } else {
      setCountdown("--:--");
    }
    return () => clearInterval(interval);
  }, [position]);

  const handleGoOffline = async () => {
    if (!driver) return;
    await deleteDoc(doc(db, "queues", driver.id));
    setHasJoined(false);
    setPosition(null);
    setQueue([]);
    setManualOffline(true);
    setIsOnline(false);
    setToastMsg("🔴 You are now offline.");
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleGoOnlineAgain = async () => {
    if (!driver || !coords) return;
    setManualOffline(false);
    setIsOnline(true);

    if (!insideParadahan) {
      setToastMsg("📍 To join the queue, you must be inside the paradahan.");
      setTimeout(() => setToastMsg(""), 4000);
    } else {
      const driverRef = doc(db, "queues", driver.id);
      await setDoc(driverRef, {
        driverId: driver.id,
        plateNumber: driver.plate,
        joinedAt: Timestamp.now(),
      });
      setHasJoined(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-4 relative">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Welcome, {driver?.name ?? "Driver"}</h2>
          {isOnline ? (
            <button onClick={handleGoOffline} className="px-4 py-1 text-sm rounded font-semibold bg-red-600 hover:bg-red-700 transition">
              Go Offline
            </button>
          ) : (
            <button onClick={handleGoOnlineAgain} className="px-4 py-1 text-sm rounded font-semibold bg-green-600 hover:bg-green-700 transition">
              Go Online
            </button>
          )}
        </div>

        <hr className="border-gray-700 mb-4" />

        {/* Location Status */}
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-1">📍 <span className="font-semibold">Location Status:</span></p>
          <p className={`${insideParadahan ? "text-green-400" : "text-red-400"} text-sm`}>
            {gpsError ? `⚠️ ${gpsError}` : insideParadahan ? "Inside Paradahan" : "Outside Paradahan"}
          </p>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg mb-4">
          <p className="text-sm font-semibold mb-1">Vehicle Information</p>
          <p><strong>Plate Number:</strong> {driver?.plate}</p>
          <p><strong>Vehicle:</strong> {driver?.vehicle}</p>
        </div>

        {/* Queue Info */}
        {hasJoined && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm font-bold mb-2">🚕 Queue Status</p>
            <p className="text-sm mb-2">
              Your position: <span className="font-semibold text-yellow-300">{position ?? "N/A"}</span>
            </p>
            <p className="text-sm mb-2">
              ⏳ Estimated Wait: <span className="font-semibold text-blue-300">{countdown}</span>
            </p>

            {position === 1 && (
              <div className="text-green-400 font-bold mb-2 animate-pulse">
                ✅ It’s your turn! Get ready for a ride.
              </div>
            )}

            <div className="mt-2">
              <p className="text-sm font-semibold mb-1 text-gray-300">Current Queue:</p>
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
                        item.driverId === driver?.id ? "bg-yellow-700 text-white" : "bg-gray-600 text-gray-100"
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
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-md flex items-center gap-2 animate-fadeIn text-sm z-50">
          {toastMsg}
          <button onClick={() => setToastMsg("")}><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default Home;
