import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
import { fareMatrix } from "../utils/fareMatrix";

const AVERAGE_WAIT_TIME_PER_DRIVER = 5; // in minutes

const Home = () => {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [manualOffline, setManualOffline] = useState(false);
  const [hasJoined, setHasJoined] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hasJoinedQueue") === "true";
    }
    return false;
  });
  const [queue, setQueue] = useState<any[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  // driverJoinedAt records the time driver joined the queue
  const [driverJoinedAt, setDriverJoinedAt] = useState<Timestamp | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [rideStarted, setRideStarted] = useState(false);
  // rideStartTime records the time driver started the ride (and left the queue)
  const [rideStartTime, setRideStartTime] = useState<Date | null>(null);
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [countdown, setCountdown] = useState("--:--");
  const [rideStatus, setRideStatus] = useState<
    "Offline" | "Waiting" | "In Ride"
  >("Offline");
  const [selectedDestination, setSelectedDestination] = useState<string | null>(
    null
  );
  const [hasExitedParadahan, setHasExitedParadahan] = useState(false);

  // New state to store the time driver returned to paradahan after ride end
  const [lastReturnTime, setLastReturnTime] = useState<Date | null>(null);
  // New state to store the current wait time before ride start
  const [currentWaitTimeMinutes, setCurrentWaitTimeMinutes] = useState<number>(0);

  const { coords, insideParadahan, error: gpsError } = useDriverLocation();

  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) setDriver(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem("hasJoinedQueue", hasJoined ? "true" : "false");
  }, [hasJoined]);

  useEffect(() => {
    const unsynced = localStorage.getItem("unsyncedRide");
    if (unsynced && insideParadahan) {
      const ride = JSON.parse(unsynced);
      addDoc(collection(db, "ride_logs"), ride)
        .then(() => localStorage.removeItem("unsyncedRide"))
        .catch((err) => console.error("Sync failed:", err));
    }
  }, [insideParadahan]);

  useEffect(() => {
    if (insideParadahan && !manualOffline) {
      setIsOnline(true);
    } else if (!insideParadahan && !rideStarted) {
      setIsOnline(false);
    }
  }, [insideParadahan, manualOffline, rideStarted]);

  useEffect(() => {
    if (!isOnline) {
      setRideStatus("Offline");
    } else if (rideStarted) {
      setRideStatus("In Ride");
    } else {
      setRideStatus("Waiting");
    }
  }, [isOnline, rideStarted]);

  // When driver joins the queue, record 'joinedAt' timestamp both in Firestore and local state
  useEffect(() => {
    const joinIfInside = async () => {
      if (
        driver &&
        isOnline &&
        insideParadahan &&
        !hasJoined &&
        !manualOffline
      ) {
        const driverRef = doc(db, "queues", driver.id);
        try {
          const joinedAt = Timestamp.now(); // Current time when joining queue
          await setDoc(driverRef, {
            driverId: driver.id,
            plateNumber: driver.plate,
            joinedAt,
          });
          setDriverJoinedAt(joinedAt); // Save locally for later wait time calculation
          setHasJoined(true);
        } catch (err) {
          console.error("Failed to join queue:", err);
          setToastMsg("⚠️ Failed to join queue. Retrying...");
          setTimeout(() => setToastMsg(""), 3000);
        }
      }
    };
    joinIfInside();
  }, [insideParadahan, coords, driver, hasJoined, manualOffline, isOnline]);

  useEffect(() => {
    const handleExitParadahan = async () => {
      // If user leaves the paradahan but had joined queue,
      // remove from queue and mark as exited for ride start process
      if (driver && hasJoined && !insideParadahan && coords) {
        try {
          await deleteDoc(doc(db, "queues", driver.id));
          setHasJoined(false);
          setPosition(null);
          setQueue([]);
          setDriverJoinedAt(null);
          setToastMsg("⛔ You left the paradahan. Ride starting...");
          setTimeout(() => setToastMsg(""), 4000);

          setHasExitedParadahan(true);
          setPickupLocation({ lat: coords.latitude, lng: coords.longitude });

          // On exiting paradahan without a ride, calculate and set wait time if lastReturnTime available
          if (lastReturnTime) {
            const exitTime = new Date();
            const waitMins = Math.round(
              (exitTime.getTime() - lastReturnTime.getTime()) / 60000
            );
            setCurrentWaitTimeMinutes(waitMins > 0 ? waitMins : 0);
          }
        } catch (err) {
          console.error("Failed to remove from queue:", err);
          setToastMsg(
            "⚠️ Failed to update queue on exit. Please check connection."
          );
          setTimeout(() => setToastMsg(""), 4000);
        }
      }
    };
    handleExitParadahan();
  }, [insideParadahan, driver, hasJoined, coords, lastReturnTime]);

  // Record ride completion and log wait time and travel time in ride_logs collection
  useEffect(() => {
    const handleReturn = async () => {
      if (
        rideStarted &&
        insideParadahan &&
        coords &&
        rideStartTime &&
        hasExitedParadahan
      ) {
        const endedAt = new Date();
        const travelTime = Math.round(
          (endedAt.getTime() - rideStartTime.getTime()) / 60000
        ); // minutes of actual trip time

        const dropoffLocation = { lat: coords.latitude, lng: coords.longitude };
        const fare = selectedDestination ? fareMatrix[selectedDestination] : 0;

        // Use the currentWaitTimeMinutes state as wait time in queue stored here
        const waitTimeMinutes = currentWaitTimeMinutes;

        const rideLog = {
          driverId: driver?.id,
          plateNumber: driver?.plate,
          startedAt: rideStartTime,
          endedAt,
          travelTimeMinutes: travelTime,
          pickupLocation,
          dropoffLocation,
          dropoffName: selectedDestination,
          waitTimeMinutes, // wait time in queue stored here
          estimatedEarnings: fare,
          timestamp: Timestamp.now(),
          queuePosition: position ?? null,
        };

        // Log the ride log and wait time
        console.log("Ride Log:", rideLog);
        console.log("Wait Time Minutes:", waitTimeMinutes);

        try {
          await addDoc(collection(db, "ride_logs"), rideLog);
          // Save endedAt as lastReturnTime for next wait time calculation
          setLastReturnTime(endedAt);
        } catch (err) {
          console.error("Failed to log ride, saving locally.", err);
          localStorage.setItem("unsyncedRide", JSON.stringify(rideLog));
        }

        // Reset ride-related states
        setRideStarted(false);
        setRideStartTime(null);
        setPickupLocation(null);
        setSelectedDestination(null);
        setHasExitedParadahan(false);
        setDriverJoinedAt(null); // reset joinedAt for next queue
        setCurrentWaitTimeMinutes(0);
        setToastMsg(`✅ Ride completed at ${selectedDestination} — ₱${fare}`);
        setTimeout(() => setToastMsg(""), 5000);
      }
    };
    handleReturn();
  }, [
    insideParadahan,
    coords,
    rideStartTime,
    selectedDestination,
    hasExitedParadahan,
    position,
    driver,
    currentWaitTimeMinutes,
    pickupLocation,
  ]);

  // Listen for real-time queue updates and maintain position and driverJoinedAt timestamp
  useEffect(() => {
    const q = query(collection(db, "queues"), orderBy("joinedAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setQueue(data);
      const pos = data.findIndex((d) => d.driverId === driver?.id);
      if (rideStarted || !hasJoined) {
        setPosition(null);
        setDriverJoinedAt(null);
      } else {
        if (pos >= 0) {
          setPosition(pos + 1);
          const driverEntry = data[pos];
          if (driverEntry.joinedAt) {
            setDriverJoinedAt(driverEntry.joinedAt);
          } else {
            setDriverJoinedAt(null);
          }
        } else {
          setPosition(null);
          setDriverJoinedAt(null);
        }
      }
    });
    return () => unsub();
  }, [driver, rideStarted, hasJoined]);

  // Real-time countdown for Estimated Wait based on position using an interval that ticks every second
  useEffect(() => {
    let interval: any = null;
    let remainingSeconds = position ? position * AVERAGE_WAIT_TIME_PER_DRIVER * 60 : 0;

    const updateCountdown = () => {
      if (remainingSeconds > 0) {
        const mins = Math.floor(remainingSeconds / 60);
        const secs = remainingSeconds % 60;
        setCountdown(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        remainingSeconds -= 1;
      } else {
        setCountdown("00:00");
        if (interval) clearInterval(interval);
      }
    };

    if (position && !rideStarted) {
      updateCountdown();
      interval = setInterval(updateCountdown, 1000);
    } else {
      setCountdown("--:--");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [position, rideStarted]);

  // Manual offline: Remove driver from queue and update states
  const handleGoOffline = async () => {
    if (!driver) return;
    try {
      await deleteDoc(doc(db, "queues", driver.id));
      setHasJoined(false);
      setPosition(null);
      setQueue([]);
      setDriverJoinedAt(null);
      setManualOffline(true);
      setIsOnline(false);
      setToastMsg("🔴 You are now offline.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err) {
      console.error("Failed to go offline:", err);
      setToastMsg("⚠️ Failed to go offline. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
    }
  };

  // Manual online: Join queue and set driverJoinedAt timestamp
  const handleGoOnlineAgain = async () => {
    if (!driver || !coords) return;
    setManualOffline(false);
    setIsOnline(true);

    if (!insideParadahan) {
      setToastMsg("📍 To join the queue, you must be inside the paradahan.");
      setTimeout(() => setToastMsg(""), 4000);
    } else {
      const driverRef = doc(db, "queues", driver.id);
      try {
        const joinedAt = Timestamp.now();
        await setDoc(driverRef, {
          driverId: driver.id,
          plateNumber: driver.plate,
          joinedAt,
        });
        setDriverJoinedAt(joinedAt); // Maintain the join timestamp for wait time
        setHasJoined(true);
      } catch (err) {
        console.error("Failed to join queue:", err);
        setToastMsg("⚠️ Failed to join queue. Please try again.");
        setTimeout(() => setToastMsg(""), 3000);
      }
    }
  };

  // Start ride: Remove from queue, update ride status and rideStartTime
  const handleStartRide = async () => {
    if (!selectedDestination) {
      setToastMsg("⚠️ Please select a destination first.");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }
    if (!coords) {
      setToastMsg("⚠️ Location not available. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    try {
      if (driver) {
        await deleteDoc(doc(db, "queues", driver.id));
      }
      const newRideStartTime = new Date();
      setHasJoined(false);
      setRideStarted(true);
      setRideStartTime(newRideStartTime); // Mark ride start (queue exit time)

      // Calculate wait time as difference between ride start and driver joined time
      if (driverJoinedAt) {
        const waitMins = Math.round(
          (newRideStartTime.getTime() - driverJoinedAt.toMillis()) / 60000
        );
        setCurrentWaitTimeMinutes(waitMins > 0 ? waitMins : 0);
      } else {
        setCurrentWaitTimeMinutes(0);
      }

      setToastMsg("🚕 Ride started! Please exit paradahan to begin trip.");
      setTimeout(() => setToastMsg(""), 3000);
    } catch (err) {
      console.error("Failed to start ride:", err);
      setToastMsg("⚠️ Failed to start ride. Please try again.");
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
