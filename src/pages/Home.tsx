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

const AVG_WAIT_MINUTES = 5;

const Home = () => {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [manualOffline, setManualOffline] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [rideStart, setRideStart] = useState<any>(null);
  const [countdown, setCountdown] = useState<string>("--:--");

  const { coords, insideParadahan, error } = useDriverLocation();

  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) setDriver(JSON.parse(stored));
  }, []);

  // Auto-join queue if inside paradahan
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

  // Remove from queue + start ride log if outside
  useEffect(() => {
    const handleExitParadahan = async () => {
      if (driver && hasJoined && !insideParadahan) {
        await deleteDoc(doc(db, "queues", driver.id));
        setHasJoined(false);
        setPosition(null);
        setQueue([]);
        setToastMsg("⛔ You left the paradahan. Removed from the queue.");
        setTimeout(() => setToastMsg(""), 4000);

        // Start ride log
        setRideStart({
          startedAt: Timestamp.now(),
          departure: coords,
        });
      }
    };
    handleExitParadahan();
  }, [insideParadahan, driver, hasJoined]);

  // End ride log when re-entering
  useEffect(() => {
    const endRide = async () => {
      if (rideStart && insideParadahan) {
        const endedAt = Timestamp.now();
        const travelTimeMin =
          (endedAt.toMillis() - rideStart.startedAt.toMillis()) / 60000;

        await addDoc(collection(db, "rideLogs"), {
          driverId: driver?.id,
          plateNumber: driver?.plate,
          startedAt: rideStart.startedAt,
          endedAt,
          travelTimeMin,
          departure: rideStart.departure,
          returnLocation: coords,
        });

        setRideStart(null);
        setToastMsg("✅ Ride completed and logged.");
        setTimeout(() => setToastMsg(""), 3000);
      }
    };
    endRide();
  }, [insideParadahan, coords]);

  // Real-time queue listener
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

  // Countdown timer
  useEffect(() => {
    let interval: any;
    if (position) {
      interval = setInterval(() => {
        const totalSec = position * AVG_WAIT_MINUTES * 60;
        const now = Date.now();
        const estimatedTime = totalSec - Math.floor((now / 1000) % totalSec);
        const mins = Math.floor(estimatedTime / 60);
        const secs = estimatedTime % 60;
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

        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-1">
            📍 <span className="font-semibold">Location Status:</span>
          </p>
          <p className={`${insideParadahan ? "text-green-400" : "text-red-400"} text-sm`}>
            {error || (insideParadahan ? "Inside Paradahan" : "Outside Paradahan")}
          </p>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg mb-4">
          <p className="text-sm font-semibold mb-1">Vehicle Information</p>
          <p><strong>Plate Number:</strong> {driver?.plate}</p>
          <p><strong>Vehicle:</strong> {driver?.vehicle}</p>
        </div>

        {hasJoined && (
          <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm font-bold mb-2">🚕 Queue Status</p>
            <p className="text-sm mb-2">
              Your position:{" "}
              <span className="font-semibold text-yellow-300">
                {position ?? "N/A"}
              </span>
            </p>

            <p className="text-sm mb-2">
              ⏳ Estimated Wait:{" "}
              <span className="font-semibold text-blue-300">
                {countdown}
              </span>
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
      </div>

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
