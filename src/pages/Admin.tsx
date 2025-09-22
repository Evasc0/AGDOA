import { useEffect, useState, useRef } from "react";
import {
  collection,
  getFirestore,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  writeBatch,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import toast from "react-hot-toast";
import EditDriverModal from "../components/EditDriverModal";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { fareMatrix } from '../utils/fareMatrix';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Driver colors for pie chart and boxes
const driverColors = Array.from({length: 50}, (_, i) => `hsl(${i * 7.2}, 70%, 50%)`);
const driverBgClasses = [
  'bg-red-500', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900',
  'bg-blue-500', 'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900',
  'bg-green-500', 'bg-green-600', 'bg-green-700', 'bg-green-800', 'bg-green-900',
  'bg-yellow-500', 'bg-yellow-600', 'bg-yellow-700', 'bg-yellow-800', 'bg-yellow-900',
  'bg-purple-500', 'bg-purple-600', 'bg-purple-700', 'bg-purple-800', 'bg-purple-900',
  'bg-pink-500', 'bg-pink-600', 'bg-pink-700', 'bg-pink-800', 'bg-pink-900',
  'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900',
  'bg-teal-500', 'bg-teal-600', 'bg-teal-700', 'bg-teal-800', 'bg-teal-900',
  'bg-orange-500', 'bg-orange-600', 'bg-orange-700', 'bg-orange-800', 'bg-orange-900',
  'bg-cyan-500', 'bg-cyan-600', 'bg-cyan-700', 'bg-cyan-800', 'bg-cyan-900',
  'bg-gray-500', 'bg-gray-600', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900'
];

interface Driver {
  id: string;
  name: string;
  plate: string;
  email: string;
  status: "online" | "offline" | "in ride" | "waiting";
  createdAt?: any;
  verified?: boolean;
  phone?: string;
}

interface QueueEntry {
  driverId: string;
  name: string;
  plate: string;
  joinedAt?: any;
  order?: number;
  id?: string;
}

interface Ride {
  id: string;
  createdAt?: any;
  fare?: number;
  status?: string;
  driverId?: string;
}

const SortableItem = ({ id, name, plate, onRemove }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex justify-between items-center bg-gray-700 p-2 rounded cursor-move"
    >
      <span>
        {name} ({plate})
      </span>
      <button onClick={() => onRemove(id)} className="text-red-400">
        Remove
      </button>
    </li>
  );
};

const normalizeKey = (key: string) => key.trim().toLowerCase();

const Admin = () => {
  const db = getFirestore();
  const auth = getAuth();
  const navigate = useNavigate();

  const [user, setUser ] = useState<any>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<
    "drivers" | "logs" | "queue" | "history" | "pending" | "analytics"
  >("drivers");

  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const [analyticsFilter, setAnalyticsFilter] = useState<'daily' | 'weekly' | 'monthly' | 'annually'>('weekly');
  const [allPieStats, setAllPieStats] = useState<{ label: string; earnings: number; rides: number }[]>([]);
  const [driverPieStats, setDriverPieStats] = useState<Record<string, { label: string; earnings: number; rides: number }[]>>({});
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalRides, setTotalRides] = useState(0);

  // Keep track of driverId timers to set offline after 1 min if they don't return to queue
  const offlineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  // Keep previous queue for comparison
  const prevQueueDriverIds = useRef<Set<string>>(new Set());
  // Keep track of previous pending drivers count for notifications
  const prevPendingCount = useRef<number>(0);

  // Monitor authentication status
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser ) => {
      if (currentUser ) {
        setUser (currentUser );
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribeAuth();
  }, [auth, navigate]);

  // Fetch drivers, pending drivers, logs, and handle queue with status logic
  useEffect(() => {
    if (!user) return;

    console.log("User in Admin:", user);

    // Listen to drivers collection
    const unsubDrivers = onSnapshot(
      collection(db, "drivers"),
      (snap) => {
        const allDrivers = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Driver[];

        console.log("🔥 Firestore snapshot received - Total drivers:", snap.docs.length);
        console.log("📋 All drivers data:", allDrivers.map(d => ({
          id: d.id,
          name: d.name,
          email: d.email,
          verified: d.verified,
          createdAt: d.createdAt
        })));

        const verifiedDrivers = allDrivers.filter((d) => d.verified === true);
        const pending = allDrivers.filter((d) => d.verified === false);

        console.log("✅ Verified drivers:", verifiedDrivers.length, verifiedDrivers.map(d => ({ id: d.id, name: d.name, verified: d.verified })));
        console.log("⏳ Pending drivers:", pending.length, pending.map(d => ({ id: d.id, name: d.name, verified: d.verified })));

        setDrivers(verifiedDrivers);
        setPendingDrivers(pending);

        // Notify admin of new pending registration requests
        if (pending.length > prevPendingCount.current) {
          const newRequests = pending.length - prevPendingCount.current;
          console.log("🔔 New pending requests detected:", newRequests);
          toast(`New pending registration request${newRequests > 1 ? 's' : ''} (${newRequests})`);
        }
        prevPendingCount.current = pending.length;
      },
      (error) => {
        console.error("❌ Error fetching drivers:", error);
        toast.error("Error fetching drivers: " + error.message);
      }
    );

    // Listen to queues collection, ordered by 'joinedAt' field
    const queueQuery = query(collection(db, "queues"), orderBy("joinedAt", "asc"));
    const unsubQueue = onSnapshot(
      queueQuery,
      async (snap) => {
        const currentQueue = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as QueueEntry[];

        setQueue(currentQueue);

        // Get current queue driver ids as a Set
        const currentDriverIds = new Set(currentQueue.map((q) => q.driverId));
        const previousDriverIds = prevQueueDriverIds.current;

        // Detect drivers who left the queue (were in prev but not now)
        const leftDrivers = Array.from(previousDriverIds).filter(
          (id) => !currentDriverIds.has(id)
        );
        // Detect drivers who joined or remain in queue (were not in prev or still in)
        const joinedOrStayedDrivers = Array.from(currentDriverIds);

        // Update status for drivers who just left queue to "in ride" and set offline timer
        for (const driverId of leftDrivers) {
          // Clear any existing timer for this driver
          const existingTimer = offlineTimers.current.get(driverId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const driverRef = doc(db, "drivers", driverId);
          const driverSnap = await getDoc(driverRef);
          if (driverSnap.exists() && driverSnap.data().status === "offline") continue;

          // Update Firestore status to "in ride"
          try {
            await setDoc(driverRef, { status: "in ride" }, { merge: true });
          } catch (error: any) {
            toast.error(
              "Failed to update driver status to Left the queue (In Ride): " +
                error.message
            );
          }

          // Set timeout to automatically set status to offline after 1 minute
          const timeout = setTimeout(async () => {
            try {
              await setDoc(driverRef, { status: "offline" }, { merge: true });
              toast.success(
                `Driver ${driverId} status changed to Offline after 1 minute of leaving queue.`
              );
            } catch (error: any) {
              toast.error("Failed to update driver status to Offline: " + error.message);
            }
            offlineTimers.current.delete(driverId);
          }, 60000); // 1 minute

          offlineTimers.current.set(driverId, timeout);
        }

        // Update status for drivers who joined or stayed in queue to "waiting" and clear offline timers if any
        for (const driverId of joinedOrStayedDrivers) {
          const existingTimer = offlineTimers.current.get(driverId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            offlineTimers.current.delete(driverId);
          }
          // Set status to "waiting"
          const driverRef = doc(db, "drivers", driverId);
          try {
            await setDoc(driverRef, { status: "waiting" }, { merge: true });
          } catch (error: any) {
            toast.error("Failed to update driver status to In Queue: " + error.message);
          }
        }

        // Update previous queue driverIds
        prevQueueDriverIds.current = currentDriverIds;
      },
      (error) => {
        toast.error("Error fetching queue: " + error.message);
      }
    );

    // Listen to admin access logs
    const unsubLogs = onSnapshot(
      collection(db, "adminAccessLogs"),
      (snap) => {
        setLogs(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      },
      (error) => {
        toast.error("Error fetching logs: " + error.message);
      }
    );

    return () => {
      unsubDrivers();
      unsubQueue();
      unsubLogs();
      // Clear all timers on unmount
      offlineTimers.current.forEach((timer) => clearTimeout(timer));
      offlineTimers.current.clear();
    };
  }, [db, user]);

  const sensors = useSensors(useSensor(PointerSensor));

  // Handle drag end to reorder queue
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((item) => item.driverId === active.id);
    const newIndex = queue.findIndex((item) => item.driverId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newQueue = arrayMove(queue, oldIndex, newIndex);
    setQueue(newQueue);

    // Batch update 'order' field to preserve queue order in Firestore
    const batch = writeBatch(db);
    newQueue.forEach((item, index) => {
      const ref = doc(db, "queues", item.driverId);
      batch.update(ref, { order: index });
    });

    try {
      await batch.commit();
      toast.success("Queue reordered successfully");
    } catch (error: any) {
      toast.error("Failed to reorder queue: " + error.message);
    }
  };

  // Delete driver document
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "drivers", id));
      toast.success("Driver deleted");
    } catch (error: any) {
      toast.error("Error deleting driver");
    }
  };

  // Reset password email
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent");
    } catch (error: any) {
      toast.error("Error sending reset email");
    }
  };

  // Add driver to queue, set order to last position
  const addToQueue = async (driver: Driver) => {
    try {
      await setDoc(doc(db, "queues", driver.id), {
        driverId: driver.id,
        name: driver.name,
        plate: driver.plate,
        joinedAt: serverTimestamp(),
        order: queue.length,
      });
      toast.success(`${driver.name} added to queue`);
    } catch (error: any) {
      toast.error("Failed to add to queue: " + error.message);
    }
  };

  // Remove driver from queue
  const removeFromQueue = async (id: string) => {
    try {
      await deleteDoc(doc(db, "queues", id));
      toast.success("Driver removed from queue");
    } catch (error: any) {
      toast.error("Failed to remove from queue: " + error.message);
    }
  };

  // Filter drivers for search
  const filteredDrivers = drivers.filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate?.toLowerCase().includes(search.toLowerCase())
  );

  // Helper: Determine driver status string for display with new text
  const getDriverStatus = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return "Offline";
    if (driver.status === "waiting") return "In Queue";
    if (driver.status === "in ride") return "Left the queue (In Ride)";
    if (driver.status === "offline") return "Offline";
    return "Offline";
  };

  const handleLogout = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Remove from queue if present
        const queueRef = doc(db, "queues", user.uid);
        try {
          await deleteDoc(queueRef);
        } catch (error) {
          // Ignore if not in queue
        }
        // Set status to offline
        const driverRef = doc(db, "drivers", user.uid);
        await setDoc(driverRef, { status: "offline" }, { merge: true });
      }
      await signOut(auth);
      toast.success("Logged out");
      navigate("/login");
    } catch (error: any) {
      toast.error("Logout failed");
    }
  };

  // Format Firestore timestamp to readable string
  const formatTime = (seconds: number) => {
    if (!seconds) return "No date";
    const date = new Date(seconds * 1000);
    return date.toLocaleString();
  };

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      const ridesQuery = query(collection(db, "ride_logs"), orderBy("timestamp", "desc"));
      const ridesSnap = await getDocs(ridesQuery);
      const rides = ridesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      console.log("Fetched ride_logs:", rides);

      const now = new Date();
      let startDate: Date;

      switch (analyticsFilter) {
        case 'daily':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'annually':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      const filteredRides = rides.filter(ride => {
        const rideDate = ride.timestamp?.toDate ? ride.timestamp.toDate() : new Date(ride.timestamp?.seconds * 1000);
        return rideDate >= startDate;
      });

      // Calculate per-driver stats first
      const driverStats: Record<string, { label: string; earnings: number; rides: number }[]> = {};
      let totalEarnings = 0;
      let totalRides = 0;
      drivers.forEach(driver => {
        const driverRides = filteredRides.filter(ride => ride.driverId === driver.id);
        const driverEarnings = driverRides.reduce((sum, ride) => {
          const dropoffNameRaw = ride.dropoffName || "";
          const dropoffName = dropoffNameRaw.trim();
          const normalizedFareMatrix: Record<string, number> = {};
          Object.entries(fareMatrix).forEach(([key, val]) => {
            normalizedFareMatrix[normalizeKey(key)] = val;
          });
          const fare = normalizedFareMatrix[normalizeKey(dropoffName)] || 0;
          return sum + fare;
        }, 0);
        const driverRideCount = driverRides.length;

        totalEarnings += driverEarnings;
        totalRides += driverRideCount;

        // Always add stats for all drivers, even with 0 rides
        driverStats[driver.id] = [
          { label: 'Rides', earnings: driverRideCount, rides: driverRideCount },
          { label: 'Earnings', earnings: driverEarnings, rides: driverRideCount },
        ];
      });

      const completedRides = filteredRides.filter(ride => ride.status === 'completed').length;

      // Set pie chart data to per-driver earnings
      const driverPieData: { label: string; earnings: number; rides: number }[] = drivers.map((driver, index) => {
        const stats = driverStats[driver.id];
        if (!stats) return null;
        const earnings = stats[1]?.earnings || 0;
        const rides = stats[0]?.rides || 0;
        return { label: driver.name, earnings, rides };
      }).filter(Boolean) as { label: string; earnings: number; rides: number }[];

      setAllPieStats(driverPieData);

      setDriverPieStats(driverStats);
      setTotalEarnings(totalEarnings);
      setTotalRides(totalRides);
    } catch (error: any) {
      toast.error("Failed to fetch analytics: " + error.message);
    }
  };

  // Fetch analytics when tab changes to analytics or filter changes
  useEffect(() => {
    if (tab === "analytics" && user) {
      fetchAnalytics();
    }
  }, [tab, analyticsFilter, user]);

  return (
    <div className="p-4 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <div className="flex gap-2 items-center flex-wrap">
          {["drivers", "queue", "logs", "history", "pending", "analytics"].map((type) => (
            <button
              key={type}
              onClick={() => setTab(type as any)}
              className={`relative px-3 py-2 rounded ${
                tab === type ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              {type[0].toUpperCase() + type.slice(1)}
              {type === "pending" && pendingDrivers.length > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-2 bg-red-600 text-xs rounded-full px-1.5">
                  {pendingDrivers.length}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded bg-red-600 whitespace-nowrap"
          >
            Logout
          </button>
        </div>
      </div>

      {/* DRIVERS LIST */}
      {tab === "drivers" && (
        <>
          <input
            type="text"
            placeholder="Search by name or plate"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="p-2 w-full text-black rounded mb-4"
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-gray-800 rounded overflow-hidden">
              <thead>
                <tr className="bg-gray-700 text-left">
                  <th className="p-2">Name</th>
                  <th>Plate</th>
                  <th>Status</th>
                  <th>Email</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-gray-600">
                    <td className="p-2">{driver.name}</td>
                    <td>{driver.plate}</td>
                    <td>{getDriverStatus(driver.id)}</td>
                    <td>{driver.email}</td>
                    <td className="space-x-2 text-right pr-4">
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setShowModal(true);
                        }}
                        className="text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(driver.id)}
                        className="text-red-400"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => resetPassword(driver.email)}
                        className="text-purple-400"
                      >
                        Reset
                      </button>
                      <button
                        onClick={() => addToQueue(driver)}
                        className="text-green-400"
                      >
                        Add to Queue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Driver Status Section */}
          <div className="mt-6 bg-gray-800 p-4 rounded">
            <h2 className="text-lg font-bold mb-2">Driver Status</h2>
            <ul className="space-y-2">
              {drivers.map((driver) => (
                <li
                  key={driver.id}
                  className="flex justify-between items-center bg-gray-700 p-2 rounded"
                >
                  <span>
                    {driver.name} ({driver.plate}) -{" "}
                    <span
                      className={`font-semibold ${
                        getDriverStatus(driver.id) === "In Queue"
                          ? "text-green-400"
                          : getDriverStatus(driver.id) === "Left the queue (In Ride)"
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {getDriverStatus(driver.id)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* QUEUE */}
      {tab === "queue" && (
        <div className="bg-gray-800 p-4 rounded mt-4">
          <h2 className="text-lg font-bold mb-2">Driver Queue (Drag to Reorder)</h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={queue.map((q) => q.driverId)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                {queue.map((entry) => {
                  const driver = drivers.find((d) => d.id === entry.driverId);
                  const status = getDriverStatus(entry.driverId);

                  return (
                    <li
                      key={entry.driverId}
                      className="flex justify-between items-center bg-gray-700 p-2 rounded cursor-move"
                    >
                      <span>
                        {driver?.name ?? entry.name} ({driver?.plate ?? entry.plate})
                      </span>
                      <span
                        className={`ml-4 text-sm font-medium ${
                          status === "In Queue"
                            ? "text-green-400"
                            : status === "Left the queue (In Ride)"
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="mt-4 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">Admin Activity Logs</h2>
          <div className="overflow-y-auto max-h-[400px] space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-gray-600 py-1">
                <p className="text-sm">
                  <strong>{log.email}</strong> —{" "}
                  {log.accessedAt?.seconds
                    ? formatTime(log.accessedAt.seconds)
                    : "No time"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRIVER HISTORY */}
      {tab === "history" && (
        <div className="mt-4 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">Driver History</h2>
                    <div className="overflow-y-auto max-h-[400px] space-y-2">
            {drivers.map((driver) => (
              <div key={driver.id} className="border-b border-gray-600 py-1">
                <p className="text-sm">
                  <strong>{driver.name}</strong> — {driver.plate} — Registered on:{" "}
                  {formatTime(driver.createdAt?.seconds)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING REGISTRATION REQUESTS */}
      {tab === "pending" && (
        <div className="bg-gray-800 p-4 rounded mt-4">
          <h2 className="text-lg font-bold mb-2">Pending Registration Requests</h2>
          {pendingDrivers.length === 0 ? (
            <p>No pending requests.</p>
          ) : (
            <table className="w-full text-sm bg-gray-700 rounded overflow-hidden">
              <thead>
                <tr className="bg-gray-600 text-left">
                  <th className="p-2">Name</th>
                  <th>Plate</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingDrivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-gray-600">
                    <td className="p-2">{driver.name}</td>
                    <td>{driver.plate}</td>
                    <td>{driver.email}</td>
                    <td>{driver.phone || "N/A"}</td>
                    <td>Pending</td>
                    <td className="space-x-2 text-right pr-4">
                      <button
                        onClick={async () => {
                          try {
                            await setDoc(
                              doc(db, "drivers", driver.id),
                              { verified: true },
                              { merge: true }
                            );
                            toast.success(`Verified ${driver.name}`);
                          } catch (error: any) {
                            toast.error("Failed to verify: " + error.message);
                          }
                        }}
                        className="text-green-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, "drivers", driver.id));
                            toast.success(`Rejected and deleted ${driver.name}`);
                          } catch (error: any) {
                            toast.error("Failed to delete: " + error.message);
                          }
                        }}
                        className="text-red-400"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ANALYTICS */}
      {tab === "analytics" && (
        <div className="mt-4 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-4">Analytics Dashboard</h2>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6">
          {['daily', 'weekly', 'monthly', 'annually'].map((filter) => (
              <button
                key={filter}
                onClick={() => setAnalyticsFilter(filter as any)}
                className={`px-4 py-2 rounded ${
                  analyticsFilter === filter ? "bg-blue-600" : "bg-gray-700"
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Overall Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-md font-semibold mb-2">Overall Statistics</h3>
              {allPieStats.length > 0 && (
                <Pie
                  data={{
                    labels: allPieStats.map(stat => stat.label),
                    datasets: [{
                      data: allPieStats.map(stat => stat.earnings),
                      backgroundColor: driverColors.slice(0, allPieStats.length),
                      borderColor: driverColors.slice(0, allPieStats.length),
                      borderWidth: 1,
                    }],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.label}: ₱${context.parsed}`,
                        },
                      },
                    },
                  }}
                />
              )}
              {/* Total Summary */}
              <div className="mt-4 text-sm font-bold">
                <p><span className="text-gray-300">Total Rides:</span> {totalRides}</p>
                <p><span className="text-gray-300">Total Earnings:</span> ₱{totalEarnings}</p>
              </div>
            </div>

            {/* Per-Driver Stats */}
            <div className="bg-gray-700 p-4 rounded">
              <h3 className="text-md font-semibold mb-2">Driver Performance</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {drivers.map((driver, index) => {
                  const driverStats = driverPieStats[driver.id];
                  if (!driverStats || driverStats.length === 0) return null;

                  return (
                    <div key={driver.id} className={`${driverBgClasses[index % driverBgClasses.length]} p-3 rounded font-medium mb-2`}>
                      <h4 className="font-medium mb-2">{driver.name} ({driver.plate})</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-300">Rides:</span> {driverStats[0]?.earnings || 0}
                        </div>
                        <div>
                          <span className="text-gray-300">Earnings:</span> ₱{driverStats[1]?.earnings || 0}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Total Summary */}
                <div className="bg-gray-600 p-3 rounded font-bold border-t border-gray-500">
                  <h4 className="mb-2">Total for All Drivers</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-300">Total Rides:</span> {totalRides}
                    </div>
                    <div>
                      <span className="text-gray-300">Total Earnings:</span> ₱{totalEarnings}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedDriver && (
        <EditDriverModal
          driver={selectedDriver}
          onClose={() => setShowModal(false)}
          onSaveSuccess={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default Admin;
