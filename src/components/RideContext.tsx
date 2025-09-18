import React, { createContext, useContext, useEffect, useState } from "react";
import { db, auth } from "../firebase";
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
import { fareMatrix } from "../utils/fareMatrix";

const AVERAGE_WAIT_TIME_PER_DRIVER = 5; // in minutes

interface RideContextType {
  driver: any;
  isOnline: boolean;
  manualOffline: boolean;
  hasJoined: boolean;
  queue: any[];
  position: number | null;
  driverJoinedAt: Timestamp | null;
  rideStarted: boolean;
  rideStartTime: Date | null;
  pickupLocation: any;
  countdown: string;
  rideStatus: "Offline" | "Waiting" | "In Ride";
  selectedDestination: string | null;
  hasExitedParadahan: boolean;
  lastReturnTime: Date | null;
  currentWaitTimeMinutes: number;
  pendingRideLog: any;
  coords: { latitude: number; longitude: number } | null;
  insideParadahan: boolean;
  gpsError: string | null;
  toastMsg: string;
  setSelectedDestination: (dest: string | null) => void;
  handleGoOffline: () => Promise<void>;
  handleGoOnlineAgain: () => Promise<void>;
  handleStartRide: () => Promise<void>;
  setToastMsg: (msg: string) => void;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) {
    throw new Error("useRide must be used within a RideProvider");
  }
  return context;
};

export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  const [driverJoinedAt, setDriverJoinedAt] = useState<Timestamp | null>(null);
  const [rideStarted, setRideStarted] = useState(false);
  const [rideStartTime, setRideStartTime] = useState<Date | null>(null);
  const [pickupLocation, setPickupLocation] = useState<any>(null);
  const [countdown, setCountdown] = useState("--:--");
  const [rideStatus, setRideStatus] = useState<"Offline" | "Waiting" | "In Ride">("Offline");
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [hasExitedParadahan, setHasExitedParadahan] = useState(false);
  const [lastReturnTime, setLastReturnTime] = useState<Date | null>(null);
  const [currentWaitTimeMinutes, setCurrentWaitTimeMinutes] = useState<number>(0);
  const [pendingRideLog, setPendingRideLog] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState("");

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
        const driverStatusRef = doc(db, "drivers", driver.id);
        try {
          const joinedAt = Timestamp.now(); // Current time when joining queue
          await setDoc(driverRef, {
            driverId: driver.id,
            plateNumber: driver.plate,
            joinedAt,
          });
          // Update driver status to "waiting" in drivers collection
          await setDoc(driverStatusRef, { status: "waiting" }, { merge: true });

          setDriverJoinedAt(joinedAt); // Save locally for later wait time calculation
          setHasJoined(true);

          // If there's a pending ride log, calculate duration and log it
          if (pendingRideLog) {
            const duration = Math.round(
              (joinedAt.toMillis() - pendingRideLog.startedAt.getTime()) / 60000
            );
            const updatedLog = { ...pendingRideLog, travelTimeMinutes: duration };
            try {
              await addDoc(collection(db, "ride_logs"), updatedLog);
              setPendingRideLog(null);
            } catch (logErr) {
              console.error("Failed to log ride:", logErr);
              localStorage.setItem("unsyncedRide", JSON.stringify(updatedLog));
              setPendingRideLog(null);
            }
          }
        } catch (err) {
          console.error("Failed to join queue:", err);
          setToastMsg("⚠️ Failed to join queue. Retrying...");
          setTimeout(() => setToastMsg(""), 3000);
        }
      }
    };
    joinIfInside();
  }, [insideParadahan, coords, driver, hasJoined, manualOffline, isOnline, pendingRideLog]);

  useEffect(() => {
    const handleExitParadahan = async () => {
      // If user leaves the paradahan but had joined queue,
      // remove from queue and mark as exited for ride start process
      if (driver && hasJoined && !insideParadahan && coords) {
        const driverStatusRef = doc(db, "drivers", driver.id);
        try {
          await deleteDoc(doc(db, "queues", driver.id));
          // Update driver status to "in ride" when leaving queue
          await setDoc(driverStatusRef, { status: "in ride" }, { merge: true });

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

  // Record ride completion and prepare ride log for logging when driver rejoins queue
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
        const dropoffLocation = { lat: coords.latitude, lng: coords.longitude };
        const fare = selectedDestination ? fareMatrix[selectedDestination] : 0;

        // Use the currentWaitTimeMinutes state as wait time in queue stored here
        const waitTimeMinutes = currentWaitTimeMinutes;

        const rideLog = {
          driverId: driver?.id,
          plateNumber: driver?.plate,
          startedAt: rideStartTime,
          endedAt,
          travelTimeMinutes: Math.round((endedAt.getTime() - rideStartTime.getTime()) / 60000),
          pickupLocation,
          dropoffLocation,
          dropoffName: selectedDestination,
          waitTimeMinutes, // wait time in queue stored here
          estimatedEarnings: fare,
          timestamp: Timestamp.now(),
          queuePosition: position ?? null,
        };

        // Store pending ride log to log when driver rejoins queue
        setPendingRideLog(rideLog);

        // Save endedAt as lastReturnTime for next wait time calculation
        setLastReturnTime(endedAt);

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
    const driverStatusRef = doc(db, "drivers", driver.id);
    try {
      await deleteDoc(doc(db, "queues", driver.id));
      // Update driver status to "offline"
      await setDoc(driverStatusRef, { status: "offline" }, { merge: true });

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

        // If there's a pending ride log, calculate duration and log it
        if (pendingRideLog) {
          const duration = Math.round(
            (joinedAt.toMillis() - pendingRideLog.startedAt.getTime()) / 60000
          );
          const updatedLog = { ...pendingRideLog, travelTimeMinutes: duration };
          try {
            await addDoc(collection(db, "ride_logs"), updatedLog);
            setPendingRideLog(null);
          } catch (logErr) {
            console.error("Failed to log ride:", logErr);
            localStorage.setItem("unsyncedRide", JSON.stringify(updatedLog));
            setPendingRideLog(null);
          }
        }
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

  const value: RideContextType = {
    driver,
    isOnline,
    manualOffline,
    hasJoined,
    queue,
    position,
    driverJoinedAt,
    rideStarted,
    rideStartTime,
    pickupLocation,
    countdown,
    rideStatus,
    selectedDestination,
    hasExitedParadahan,
    lastReturnTime,
    currentWaitTimeMinutes,
    pendingRideLog,
    coords,
    insideParadahan,
    gpsError,
    toastMsg,
    setSelectedDestination,
    handleGoOffline,
    handleGoOnlineAgain,
    handleStartRide,
    setToastMsg,
  };

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
};
