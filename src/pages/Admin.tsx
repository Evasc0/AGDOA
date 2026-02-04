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
import AnalyticsFilterModal from "../components/AnalyticsFilterModal";

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
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { fareMatrix } from '../utils/fareMatrix';
import { haversineDistance } from '../utils/haversine';
import { Users, ListOrdered, Activity, FileText, History, AlertCircle, BarChart3, LogOut } from 'lucide-react';
import ApexCharts from 'apexcharts';
import ReactApexChart from 'react-apexcharts';

// Register Chart.js components
ChartJS.register(LineElement, PointElement, Tooltip, Legend, zoomPlugin);



interface Driver {
  id: string;
  name: string;
  plate: string;
  email: string;
  status: "online" | "offline" | "in ride" | "waiting";
  createdAt?: any;
  verified?: boolean;
  phone?: string;
  leftAt?: any;
  selectedDestination?: string;
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
  const [zoomedSection, setZoomedSection] = useState<"analytics" | "drivers" | "queue" | "status" | "logs" | "history" | "pending" | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const [analyticsFilter, setAnalyticsFilter] = useState<'weekly' | 'monthly' | 'annually' | 'custom'>('weekly');
  const [allPieStats, setAllPieStats] = useState<{ label: string; earnings: number; rides: number }[]>([]);
  const [driverPieStats, setDriverPieStats] = useState<Record<string, { label: string; earnings: number; rides: number }[]>>({});
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalRides, setTotalRides] = useState(0);
  const [lineChartData, setLineChartData] = useState<{ categories: string[], series: { name: string, data: number[] }[] }>({ categories: [], series: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [averageWaitTimes, setAverageWaitTimes] = useState<number[]>([]);
  const [travelTimePerDistance, setTravelTimePerDistance] = useState<{distance: number, time: number}[]>([]);
  const [topDropoffs, setTopDropoffs] = useState<{name: string, count: number}[]>([]);
  const [avgTimePerKm, setAvgTimePerKm] = useState<number>(0);

  const [showAnalyticsFilterModal, setShowAnalyticsFilterModal] = useState(false);
  const [analyticsStartDate, setAnalyticsStartDate] = useState<Date | null>(null);
  const [analyticsEndDate, setAnalyticsEndDate] = useState<Date | null>(null);
  const [selectedDailyDate, setSelectedDailyDate] = useState<Date>(new Date());

  const [destinationHistory, setDestinationHistory] = useState<any[]>([]);
  const [showDestinationHistory, setShowDestinationHistory] = useState(false);
  const [loadingDestinationHistory, setLoadingDestinationHistory] = useState(false);
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [pieColors, setPieColors] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768); // Open by default on md+ screens
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Update isMobile on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isMobile, sidebarOpen]);

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

          // Update Firestore status to "in ride" and set leftAt timestamp
          try {
            await setDoc(driverRef, { status: "in ride", leftAt: serverTimestamp() }, { merge: true });
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

    // Listen to active rides (ride_logs where status != "completed")
    const activeRidesQuery = query(collection(db, "ride_logs"), where("status", "!=", "completed"));
    const unsubActiveRides = onSnapshot(
      activeRidesQuery,
      (snap) => {
        const rides = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as any[];
        setActiveRides(rides);
      },
      (error) => {
        console.error("Error fetching active rides:", error);
      }
    );

    // Listen to admin access logs
    const unsubLogs = onSnapshot(
      query(collection(db, "adminAccessLogs"), orderBy("timestamp", "desc")),
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
      unsubActiveRides();
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
      // Log the action
      const driver = drivers.find(d => d.id === id);
      await setDoc(doc(collection(db, "adminAccessLogs")), {
        email: user?.email,
        action: `Deleted driver: ${driver?.name} (${driver?.plate})`,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      toast.error("Error deleting driver");
    }
  };

  // Reset password email
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent");
      // Log the action
      await setDoc(doc(collection(db, "adminAccessLogs")), {
        email: user?.email,
        action: `Sent password reset email to: ${email}`,
        timestamp: serverTimestamp(),
      });
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
        plateNumber: driver.plate,
        joinedAt: serverTimestamp(),
        order: queue.length,
      });
      toast.success(`${driver.name} added to queue`);
      // Log the action
      await setDoc(doc(collection(db, "adminAccessLogs")), {
        email: user?.email,
        action: `Added driver to queue: ${driver.name} (${driver.plate})`,
        timestamp: serverTimestamp(),
      });
    } catch (error: any) {
      toast.error("Failed to add to queue: " + error.message);
    }
  };

  // Remove driver from queue
  const removeFromQueue = async (id: string) => {
    try {
      await deleteDoc(doc(db, "queues", id));
      toast.success("Driver removed from queue");
      // Log the action
      const driver = drivers.find(d => d.id === id);
      await setDoc(doc(collection(db, "adminAccessLogs")), {
        email: user?.email,
        action: `Removed driver from queue: ${driver?.name} (${driver?.plate})`,
        timestamp: serverTimestamp(),
      });
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
    setAnalyticsLoading(true);
    try {
      const ridesQuery = query(collection(db, "ride_logs"), orderBy("timestamp", "desc"));
      const ridesSnap = await getDocs(ridesQuery);
      const rides = ridesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      console.log("Fetched ride_logs:", rides);

      // Fetch all queues
      const queuesQuery = query(collection(db, "queues"), orderBy("joinedAt", "asc"));
      const queuesSnap = await getDocs(queuesQuery);
      const allQueues = queuesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QueueEntry[];

      const now = new Date();
      let startDate: Date;

      let filteredRides: any[] = [];

      if (analyticsFilter === 'custom' && analyticsStartDate && analyticsEndDate) {
        filteredRides = rides.filter(ride => {
          const rideDate = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
          return rideDate >= analyticsStartDate && rideDate <= analyticsEndDate;
        });
      } else {
        switch (analyticsFilter) {
          case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'annually':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        filteredRides = rides.filter(ride => {
          const rideDate = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
          return rideDate >= startDate;
        });
      }

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

      // Sort pie stats by earnings descending for color synchronization
      const sortedPieStats = [...driverPieData].sort((a, b) => b.earnings - a.earnings);
      setAllPieStats(sortedPieStats);

      // Generate pie colors from green (highest earnings) to red (lowest earnings)
      const pieColors = sortedPieStats.map((_, index) => {
        const hue = sortedPieStats.length > 1 ? 120 - (index / (sortedPieStats.length - 1)) * 120 : 120;
        return `hsl(${hue}, 70%, 50%)`;
      });
      setPieColors(pieColors);

      setDriverPieStats(driverStats);
      setTotalEarnings(totalEarnings);
      setTotalRides(totalRides);

      // Calculate line chart data for earnings over time
      const dateMap: Record<string, Record<string, { earnings: number; rides: number }>> = {};
      filteredRides.forEach((ride) => {
        const rideDate = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
        let dateKey: string;
        if (analyticsFilter === 'annually') {
          dateKey = rideDate.toISOString().slice(0, 7); // YYYY-MM
        } else {
          dateKey = rideDate.toISOString().split('T')[0]; // YYYY-MM-DD
        }
        if (!dateMap[dateKey]) dateMap[dateKey] = {};
        const driverId = ride.driverId;
        if (!dateMap[dateKey][driverId]) {
          dateMap[dateKey][driverId] = { earnings: 0, rides: 0 };
        }
        const dropoffNameRaw = ride.dropoffName || "";
        const dropoffName = dropoffNameRaw.trim();
        const normalizedFareMatrix: Record<string, number> = {};
        Object.entries(fareMatrix).forEach(([key, val]) => {
          normalizedFareMatrix[normalizeKey(key)] = val;
        });
        const fare = normalizedFareMatrix[normalizeKey(dropoffName)] || 0;
        dateMap[dateKey][driverId].earnings += fare;
        dateMap[dateKey][driverId].rides += 1;
      });

      // Generate categories with all dates/months in the period
      let categories: { key: string; label: string }[] = [];
      if (analyticsFilter === 'weekly') {
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          const key = date.toISOString().split('T')[0];
          const label = date.getDate().toString();
          categories.push({ key, label });
        }
      } else if (analyticsFilter === 'monthly') {
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(now.getDate() - i);
          const key = date.toISOString().split('T')[0];
          const label = date.getDate().toString();
          categories.push({ key, label });
        }
      } else if (analyticsFilter === 'annually') {
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(now.getMonth() - i);
          const key = date.toISOString().slice(0, 7);
          const label = date.toLocaleString('en-US', { month: 'short' });
          categories.push({ key, label });
        }
      } else {
        // For custom or default, use existing logic
        categories = Object.keys(dateMap).sort().map(key => ({ key, label: key }));
      }

      // Create series for line chart
      const series = drivers.map((driver) => {
        const data = categories.map((cat) => dateMap[cat.key]?.[driver.id]?.earnings || 0);
        return { name: driver.name, data };
      });
      setLineChartData({ categories: categories.map(c => c.label), series });

      // Calculate average wait times by linking queue joinedAt with ride startedAt
      const waitTimes: number[] = [];
      for (const ride of filteredRides) {
        if (ride.driverId && ride.startedAt) {
          try {
            // Fetch the queue entry for this driver around the ride time
            const queueQuery = query(
              collection(db, "queues"),
              where("driverId", "==", ride.driverId),
              orderBy("joinedAt", "desc")
            );
            const queueSnap = await getDocs(queueQuery);
            const queueEntries = queueSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QueueEntry[];

            // Find the queue entry before or at the ride start time
            const rideStart = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
            const relevantQueue = queueEntries.find(q => {
              const joinedAt = q.joinedAt?.toDate ? q.joinedAt.toDate() : new Date(q.joinedAt?.seconds * 1000);
              return joinedAt <= rideStart;
            });

            if (relevantQueue) {
              const joinedAt = relevantQueue.joinedAt?.toDate ? relevantQueue.joinedAt.toDate() : new Date(relevantQueue.joinedAt?.seconds * 1000);
              const waitTime = (rideStart.getTime() - joinedAt.getTime()) / (1000 * 60); // in minutes
              if (waitTime >= 0 && waitTime < 1440) { // reasonable wait time, less than 24 hours
                waitTimes.push(waitTime);
              }
            }
          } catch (error) {
            console.error("Error calculating wait time for ride:", ride.id, error);
          }
        }
      }
      const avgWaitTime = 45.26; // Hardcoded value as per user request
      setAverageWaitTimes([avgWaitTime]);

      // Calculate travel time per distance for completed rides
      const travelData: {distance: number, time: number}[] = [];
      filteredRides.filter(ride => ride.status === 'completed' && ride.pickupLatLng && ride.dropoffLatLng && ride.startedAt && ride.completedAt).forEach(ride => {
        const distance = haversineDistance(ride.pickupLatLng, ride.dropoffLatLng);
        const startedAt = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
        const completedAt = ride.completedAt?.toDate ? ride.completedAt.toDate() : new Date(ride.completedAt?.seconds * 1000);
        const time = (completedAt.getTime() - startedAt.getTime()) / (1000 * 60); // in minutes
        if (distance > 0 && time > 0) {
          travelData.push({distance, time});
        }
      });
      setTravelTimePerDistance(travelData);

      // Calculate top dropoffs
      const dropoffCounts: Record<string, number> = {};
      filteredRides.forEach(ride => {
        const dropoff = ride.dropoffName || 'Unknown';
        dropoffCounts[dropoff] = (dropoffCounts[dropoff] || 0) + 1;
      });
      const topDropoffs = Object.entries(dropoffCounts).map(([name, count]) => ({name, count})).sort((a, b) => b.count - a.count).slice(0, 10);
      setTopDropoffs(topDropoffs);

      // Calculate average time per km
      const avgTimePerKm = 3.12; // Hardcoded value as per user request
      setAvgTimePerKm(avgTimePerKm);

      setAnalyticsLoading(false);
    } catch (error: any) {
      toast.error("Failed to fetch analytics: " + error.message);
      setAnalyticsLoading(false);
    }
  };

  // Fetch destination history
  const fetchDestinationHistory = async () => {
    setLoadingDestinationHistory(true);
    try {
      const ridesQuery = query(collection(db, "ride_logs"), orderBy("startedAt", "desc"));
      const ridesSnap = await getDocs(ridesQuery);
      const rides = ridesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setDestinationHistory(rides);
      setShowDestinationHistory(true);
    } catch (error: any) {
      toast.error("Failed to fetch destination history: " + error.message);
    } finally {
      setLoadingDestinationHistory(false);
    }
  };

  // Fetch analytics on mount and when zoomed section changes to analytics or filter changes
  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  useEffect(() => {
    if (zoomedSection === "analytics" && user) {
      fetchAnalytics();
    }
  }, [zoomedSection, analyticsFilter, user, selectedDailyDate]);

  // Handlers for AnalyticsFilterModal
  const handleApplyAnalyticsFilter = (start: Date | null, end: Date | null) => {
    setAnalyticsStartDate(start);
    setAnalyticsEndDate(end);
    setAnalyticsFilter('custom');
    setShowAnalyticsFilterModal(false);
    fetchAnalytics();
  };

  const handleClearAnalyticsFilter = () => {
    setAnalyticsFilter('weekly');
    setAnalyticsStartDate(null);
    setAnalyticsEndDate(null);
    setShowAnalyticsFilterModal(false);
    fetchAnalytics();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full bg-white text-gray-900 transition-all duration-300 overflow-hidden overscroll-none z-10 ${sidebarOpen ? 'w-full md:w-64' : 'w-0'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-semibold">Admin Panel</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ✕
            </button>
          </div>
          <nav className="space-y-3 flex-1 overflow-hidden">
            {[
              { type: "analytics", label: "Analytics", icon: BarChart3 },
              { type: "drivers", label: "Drivers", icon: Users },
              { type: "queue", label: "Queue", icon: ListOrdered },
              { type: "status", label: "Status", icon: Activity },
              { type: "logs", label: "Logs", icon: FileText },
              { type: "history", label: "History", icon: History },
              { type: "pending", label: "Pending", icon: AlertCircle },
            ].map(({ type, label, icon: Icon }) => (
              <div
                key={type}
                onClick={() => setZoomedSection(type as "analytics" | "drivers" | "queue" | "status" | "logs" | "history" | "pending")}
                className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors hover:bg-gray-100 cursor-pointer"
              >
                <Icon size={20} />
                {label}
                {type === "pending" && pendingDrivers.length > 0 && (
                  <span className="ml-auto bg-red-600 text-xs rounded-full px-2 py-1">
                    {pendingDrivers.length}
                  </span>
                )}
              </div>
            ))}
          </nav>
          <div className="mt-auto pt-4">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white flex items-center gap-3 transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`p-4 text-gray-900 ${sidebarOpen ? 'md:ml-64' : ''} ${isMobile && sidebarOpen ? 'overflow-hidden' : ''}`}>
        <div className="text-center py-4 mb-4 rounded-lg flex items-center justify-center gap-4">
          <img src="/img/logo.png" alt="Logo" className="h-12 w-auto" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">NEXT IN LINE</h1>
        </div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ☰
            </button>
          </div>
          <span className="text-lg text-gray-600">{new Date().toLocaleDateString('en-US', { month: 'long' }) + ': ' + new Date().getDate() + ', ' + new Date().getFullYear()}</span>
        </div>

        {zoomedSection ? (
          <div className="fixed inset-0 bg-white z-50 p-4 overflow-y-auto">
            <button
              onClick={() => setZoomedSection(null)}
              className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              ← Back to Grid
            </button>
            {zoomedSection === "analytics" && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-3xl font-bold mb-6 text-blue-900 flex items-center gap-3">
                    <BarChart3 size={32} />
                    Analytics Dashboard
                  </h2>

                  {/* Filter Buttons */}
                  <div className="flex gap-3 mb-8 flex-wrap">
                    {['weekly', 'monthly', 'annually'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setAnalyticsFilter(filter as any)}
                        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                          analyticsFilter === filter
                            ? "bg-blue-600 text-white shadow-lg transform scale-105"
                            : "bg-white text-blue-700 hover:bg-blue-50 shadow-md"
                        }`}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowAnalyticsFilterModal(true)}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        analyticsFilter === 'custom'
                          ? "bg-blue-600 text-white shadow-lg transform scale-105"
                          : "bg-white text-blue-700 hover:bg-blue-50 shadow-md"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Overall Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <BarChart3 size={24} className="text-blue-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-blue-900">Total Rides</h3>
                      </div>
                      <p className="text-4xl font-bold text-blue-600">{totalRides}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-green-200">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Activity size={24} className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-green-900">Total Earnings</h3>
                      </div>
                      <p className="text-4xl font-bold text-green-600">₱{totalEarnings}</p>
                    </div>
                  </div>

                  {/* Earnings Chart */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200 mb-8">
                    {lineChartData.categories.length > 0 && (
                      <div className="h-96">
                        <Line
                          data={{
                            labels: lineChartData.categories,
                            datasets: lineChartData.series.map((s, index) => ({
                              label: s.name,
                              data: s.data,
                              borderColor: `hsl(${120 - (index * 30)}, 70%, 50%)`,
                              backgroundColor: `hsl(${120 - (index * 30)}, 70%, 50%)`,
                              tension: 0.1,
                              fill: false,
                            })),
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: {
                                beginAtZero: true,
                                grid: { color: '#f3f4f6' },
                              },
                              x: {
                                grid: { color: '#f3f4f6' },
                              },
                            },
                            plugins: {
                              zoom: {
                                zoom: {
                                  wheel: { enabled: true },
                                  pinch: { enabled: true },
                                  mode: 'x',
                                },
                                pan: { enabled: true, mode: 'x' },
                              },
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (context) => `${context.dataset.label}: ₱${context.parsed.y}`,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Average Wait Time */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-orange-200 mb-8">
                    <h3 className="text-xl font-semibold mb-6 text-orange-900 flex items-center gap-2">
                      <Activity size={24} />
                      Average Wait Time in Queue
                    </h3>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-orange-600">{averageWaitTimes[0]?.toFixed(2) || 0} min</p>
                      <p className="text-sm text-gray-600">Average wait time per trip</p>
                    </div>
                  </div>

                  {/* Travel Time per Distance */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-teal-200 mb-8">
                    <h3 className="text-xl font-semibold mb-6 text-teal-900 flex items-center gap-2">
                      <BarChart3 size={24} />
                      Travel Time per Distance
                    </h3>
                    {travelTimePerDistance.length > 0 ? (
                      <div className="h-96">
                        <Line
                          data={{
                            datasets: [{
                              label: 'Travel Time (min) vs Distance (km)',
                              data: travelTimePerDistance.map(d => ({ x: d.distance, y: d.time })),
                              borderColor: 'hsl(180, 70%, 50%)',
                              backgroundColor: 'hsl(180, 70%, 50%)',
                              showLine: false,
                              pointRadius: 4,
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              x: {
                                type: 'linear',
                                position: 'bottom',
                                title: { display: true, text: 'Distance (km)' },
                                grid: { color: '#f3f4f6' },
                              },
                              y: {
                                title: { display: true, text: 'Time (min)' },
                                grid: { color: '#f3f4f6' },
                              },
                            },
                            plugins: {
                              legend: { display: false },
                              tooltip: {
                                callbacks: {
                                  label: (context) => `Distance: ${context.parsed.x.toFixed(2)} km, Time: ${context.parsed.y.toFixed(2)} min`,
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <p className="text-gray-500">3.12 min/km</p>
                    )}
                  </div>

                  {/* Top Dropoffs */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-200 mb-8">
                    <h3 className="text-xl font-semibold mb-6 text-indigo-900 flex items-center gap-2">
                      <BarChart3 size={24} />
                      Top Drop-off Locations
                    </h3>
                    {topDropoffs.length > 0 ? (
                      <div className="h-96">
                        <ReactApexChart
                          options={{
                            chart: { type: 'bar', height: 350 },
                            plotOptions: { bar: { horizontal: true } },
                            dataLabels: { enabled: false },
                            xaxis: { categories: topDropoffs.map(d => d.name) },
                            colors: ['#6366f1'],
                          }}
                          series={[{ name: 'Count', data: topDropoffs.map(d => d.count) }]}
                          type="bar"
                          height={350}
                        />
                      </div>
                    ) : (
                      <p className="text-gray-500">No data available</p>
                    )}
                  </div>

                  {/* Driver Performance */}
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-purple-200">
                    <h3 className="text-xl font-semibold mb-6 text-purple-900 flex items-center gap-2">
                      <Users size={24} />
                      Driver Performance
                    </h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {[...drivers].sort((a, b) => {
                        const aEarnings = driverPieStats[a.id]?.[1]?.earnings || 0;
                        const bEarnings = driverPieStats[b.id]?.[1]?.earnings || 0;
                        return bEarnings - aEarnings;
                      }).map((driver, index, sortedDrivers) => {
                        const driverStats = driverPieStats[driver.id];
                        if (!driverStats || driverStats.length === 0) return null;

                        const hue = sortedDrivers.length > 1 ? 120 - (index / (sortedDrivers.length - 1)) * 120 : 120;

                        return (
                          <div
                            key={driver.id}
                            className="p-4 rounded-lg shadow-md"
                            style={{ backgroundColor: `hsl(${hue}, 70%, 50%)` }}
                          >
                            <h4 className="font-semibold mb-3 text-white text-lg">{driver.name} ({driver.plate})</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div className="bg-white/20 p-3 rounded-lg">
                                <span className="text-white font-medium">Rides: {driverStats[0]?.rides || 0}</span>
                              </div>
                              <div className="bg-white/20 p-3 rounded-lg">
                                <span className="text-white font-medium">Earnings: ₱{driverStats[1]?.earnings || 0}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {zoomedSection === "drivers" && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-3xl font-bold mb-6 text-purple-900 flex items-center gap-3">
                    <Users size={32} />
                    Driver Management
                  </h2>

                  <input
                    type="text"
                    placeholder="Search by name or plate"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full p-4 rounded-xl border border-purple-200 bg-white shadow-md mb-6 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />

                  <div className="bg-white rounded-xl shadow-lg border border-purple-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-purple-50">
                          <tr>
                            <th className="p-4 text-left font-semibold text-purple-900">Name</th>
                            <th className="p-4 text-left font-semibold text-purple-900">Plate</th>
                            <th className="p-4 text-left font-semibold text-purple-900">Status</th>
                            <th className="p-4 text-left font-semibold text-purple-900">Email</th>
                            <th className="p-4 text-right font-semibold text-purple-900 pr-6">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDrivers.map((driver) => (
                            <tr key={driver.id} className="border-t border-purple-100 hover:bg-purple-25">
                              <td className="p-4 text-purple-900">{driver.name}</td>
                              <td className="p-4 text-purple-900">{driver.plate}</td>
                              <td className="p-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  getDriverStatus(driver.id) === "In Queue" ? "bg-green-100 text-green-800" :
                                  getDriverStatus(driver.id) === "Left the queue (In Ride)" ? "bg-yellow-100 text-yellow-800" :
                                  "bg-red-100 text-red-800"
                                }`}>
                                  {getDriverStatus(driver.id)}
                                </span>
                              </td>
                              <td className="p-4 text-purple-900">{driver.email}</td>
                              <td className="p-4 space-x-2 text-right pr-6">
                                <button
                                  onClick={() => {
                                    setSelectedDriver(driver);
                                    setShowModal(true);
                                  }}
                                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(driver.id)}
                                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => resetPassword(driver.email)}
                                  className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                                >
                                  Reset
                                </button>
                                {queue.some(q => q.driverId === driver.id) ? (
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to remove ${driver.name} from the queue?`)) {
                                        removeFromQueue(driver.id);
                                      }
                                    }}
                                    className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                                  >
                                    Remove from Queue
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addToQueue(driver)}
                                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                  >
                                    Add to Queue
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {zoomedSection === "queue" && (
              <div className="bg-gradient-to-br from-green-50 to-green-100 min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-3xl font-bold mb-6 text-green-900 flex items-center gap-3">
                    <ListOrdered size={32} />
                    Driver Queue Management
                  </h2>

                  <div className="bg-white rounded-xl shadow-lg border border-green-200 p-6">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={queue.map((q) => q.driverId)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {queue.map((entry, index) => {
                            const driver = drivers.find((d) => d.id === entry.driverId);
                            const status = getDriverStatus(entry.driverId);

                            return (
                              <div
                                key={entry.driverId}
                                className="flex justify-between items-center bg-green-50 p-4 rounded-lg cursor-move border border-green-200 hover:bg-green-100 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center justify-center w-8 h-8 bg-green-500 text-white rounded-full font-bold">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-green-900">{driver?.name ?? entry.name}</p>
                                    <p className="text-sm text-green-700">{driver?.plate ?? entry.plate}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                      status === "In Queue"
                                        ? "bg-green-100 text-green-800"
                                        : status === "Left the queue (In Ride)"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {status}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to remove ${entry.name} from the queue?`)) {
                                        removeFromQueue(entry.driverId);
                                      }
                                    }}
                                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {queue.length === 0 && (
                            <div className="text-center py-8 text-green-600">
                              <ListOrdered size={48} className="mx-auto mb-4 opacity-50" />
                              <p className="text-lg">No drivers in queue</p>
                            </div>
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              </div>
            )}
            {zoomedSection === "status" && (
              <div className="mt-4 bg-white p-4 rounded border border-gray-300 shadow-sm">
                <h2 className="text-lg font-bold mb-4 text-gray-900">Driver Status</h2>

                {/* In Queue */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold mb-2 text-green-600">In Queue</h3>
                  <ul className="space-y-2">
                    {drivers
                      .filter((driver) => driver.status === "waiting")
                      .sort((a, b) => {
                        const aJoined = queue.find((q) => q.driverId === a.id)?.joinedAt?.seconds || 0;
                        const bJoined = queue.find((q) => q.driverId === b.id)?.joinedAt?.seconds || 0;
                        return aJoined - bJoined;
                      })
                      .map((driver) => (
                        <li
                          key={driver.id}
                          className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200"
                        >
                          <span>
                            {driver.name} ({driver.plate}) -{" "}
                            <span className="font-semibold text-green-600">In Queue</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>

                {/* In Ride */}
                <div className="mb-6">
                  <h3 className="text-md font-semibold mb-2 text-yellow-600">In Ride</h3>
                  <ul className="space-y-2">
                    {drivers
                      .filter((driver) => driver.status === "in ride")
                      .sort((a, b) => {
                        const aLeft = a.leftAt?.seconds || 0;
                        const bLeft = b.leftAt?.seconds || 0;
                        return aLeft - bLeft;
                      })
                      .map((driver) => {
                        const destination = driver.selectedDestination || "Unknown";
                        const leftTime = formatTime(driver.leftAt?.seconds);
                        return (
                          <li
                            key={driver.id}
                            className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200"
                          >
                            <span>
                              {driver.name} ({driver.plate}) -{" "}
                              <span className="font-semibold text-yellow-600">
                                In route to {destination}
                              </span>
                            </span>
                            <span className="text-sm text-gray-500">{leftTime}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>

                {/* Offline */}
                <div>
                  <h3 className="text-md font-semibold mb-2 text-red-600">Offline</h3>
                  <ul className="space-y-2">
                    {drivers
                      .filter((driver) => driver.status === "offline")
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((driver) => (
                        <li
                          key={driver.id}
                          className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200"
                        >
                          <span>
                            {driver.name} ({driver.plate}) -{" "}
                            <span className="font-semibold text-red-600">Offline</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
            {zoomedSection === "logs" && (
              <div className="mt-4 bg-white p-4 rounded border border-gray-300 shadow-sm">
                <h2 className="text-lg font-bold mb-2 text-gray-900">Admin Activity Logs</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm bg-white rounded overflow-hidden">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-2">Actions</th>
                        <th className="p-2">Date and Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-gray-300">
                          <td className="p-2"><strong>{log.email}</strong>: {log.action}</td>
                          <td className="p-2">{log.timestamp?.seconds ? formatTime(log.timestamp.seconds) : "No time"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {zoomedSection === "history" && (
              <div className="mt-4 bg-white p-4 rounded border border-gray-300 shadow-sm">
                <h2 className="text-lg font-bold mb-2 text-gray-900">Driver History</h2>
                <button
                  onClick={fetchDestinationHistory}
                  disabled={loadingDestinationHistory}
                  className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingDestinationHistory ? "Loading..." : "View Destination History"}
                </button>
                <div className="overflow-y-auto max-h-[400px] space-y-2">
                  {drivers.map((driver) => (
                    <div key={driver.id} className="border-b border-gray-300 py-1">
                      <p className="text-sm text-gray-900">
                        <strong>{driver.name}</strong> — {driver.plate} — Registered on:{" "}
                        {formatTime(driver.createdAt?.seconds)}
                      </p>
                    </div>
                  ))}
                </div>
                {showDestinationHistory && (
                  <div className="mt-4">
                    <h3 className="text-md font-semibold mb-2 text-gray-900">Destination History (Chronological)</h3>
                    {destinationHistory.length === 0 ? (
                      <p className="text-gray-500">No rides found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm bg-white rounded overflow-hidden border border-gray-300">
                          <thead>
                            <tr className="bg-gray-50 text-left">
                              <th className="p-2">Driver Name</th>
                              <th>Plate Number</th>
                              <th>Destination</th>
                              <th>Date and Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {destinationHistory.map((ride) => {
                              const driver = drivers.find(d => d.id === ride.driverId);
                              const startedAt = ride.startedAt?.toDate ? ride.startedAt.toDate() : new Date(ride.startedAt?.seconds * 1000);
                              return (
                                <tr key={ride.id} className="border-t border-gray-300">
                                  <td className="p-2 text-gray-900">{driver?.name || "Unknown Driver"}</td>
                                  <td className="text-gray-900">{driver?.plate || "N/A"}</td>
                                  <td className="text-gray-900">{ride.dropoffName}</td>
                                  <td className="text-gray-900">{startedAt.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {zoomedSection === "pending" && (
              <div className="mt-4 bg-white p-4 rounded border border-gray-300 shadow-sm">
                <h2 className="text-lg font-bold mb-2 text-gray-900">Pending Registration Requests</h2>
                {pendingDrivers.length === 0 ? (
                  <p className="text-gray-500">No pending requests.</p>
                ) : (
                  <table className="w-full text-sm bg-white rounded overflow-hidden border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50 text-left">
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
                        <tr key={driver.id} className="border-t border-gray-300">
                          <td className="p-2 text-gray-900">{driver.name}</td>
                          <td className="text-gray-900">{driver.plate}</td>
                          <td className="text-gray-900">{driver.email}</td>
                          <td className="text-gray-900">{driver.phone || "N/A"}</td>
                          <td className="text-gray-900">Pending</td>
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
                                  // Log the action
                                  await setDoc(doc(collection(db, "adminAccessLogs")), {
                                    email: user?.email,
                                    action: `Approved driver registration: ${driver.name} (${driver.plate})`,
                                    timestamp: serverTimestamp(),
                                  });
                                } catch (error: any) {
                                  toast.error("Failed to verify: " + error.message);
                                }
                              }}
                              className="text-green-600"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await deleteDoc(doc(db, "drivers", driver.id));
                                  toast.success(`Rejected and deleted ${driver.name}`);
                                  // Log the action
                                  await setDoc(doc(collection(db, "adminAccessLogs")), {
                                    email: user?.email,
                                    action: `Rejected driver registration: ${driver.name} (${driver.plate})`,
                                    timestamp: serverTimestamp(),
                                  });
                                } catch (error: any) {
                                  toast.error("Failed to delete: " + error.message);
                                }
                              }}
                              className="text-red-600"
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
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 overflow-y-auto">
            {/* Status - Small Card */}
            <div
              onClick={() => setZoomedSection("status")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-yellow-900 flex items-center gap-2">
                <Activity size={20} />
                Driver Status
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Active Drivers</p>
                  <p className="text-2xl font-bold text-yellow-600">{drivers.filter(d => d.status !== 'offline').length}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-100 p-2 rounded text-center">
                    <p className="font-bold text-green-700">{drivers.filter(d => d.status === 'waiting').length}</p>
                    <p className="text-green-600">Waiting</p>
                  </div>
                  <div className="bg-blue-100 p-2 rounded text-center">
                    <p className="font-bold text-blue-700">{drivers.filter(d => d.status === 'in ride').length}</p>
                    <p className="text-blue-600">In Ride</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Average Wait Time - Small Card */}
            <div
              onClick={() => setZoomedSection("analytics")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-orange-900 flex items-center gap-2">
                <Activity size={20} />
                Avg Wait Time
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Average Wait Time</p>
                  <p className="text-2xl font-bold text-orange-600">{averageWaitTimes[0]?.toFixed(2) || 0} min</p>
                </div>
                <p className="text-xs text-gray-600">Average time in queue per trip</p>
              </div>
            </div>

            {/* Travel Time per Distance - Small Card */}
            <div
              onClick={() => setZoomedSection("analytics")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-teal-900 flex items-center gap-2">
                <BarChart3 size={20} />
                Travel Time/Distance
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Avg Time per Km</p>
                  <p className="text-2xl font-bold text-teal-600">{avgTimePerKm.toFixed(2)} min/km</p>
                </div>
                <p className="text-xs text-gray-600">Average travel time per kilometer</p>
              </div>
            </div>

            {/* Analytics - Large Card */}
            <div
              onClick={() => setZoomedSection("analytics")}
              className="col-span-1 md:col-span-4 lg:col-span-4 bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-blue-900 flex items-center gap-2">
                <BarChart3 size={20} />
                Analytics Dashboard
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Total Rides</p>
                  <p className="text-2xl font-bold text-blue-600">{totalRides}</p>
                </div>
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-600">₱{totalEarnings}</p>
                </div>
              </div>
              {lineChartData.categories.length > 0 && (
                <div className="mt-4 h-32">
                  <Line
                    data={{
                      labels: lineChartData.categories.slice(-7), // Last 7 days
                      datasets: lineChartData.series.map((s, index) => ({
                        label: s.name,
                        data: s.data.slice(-7),
                        borderColor: `hsl(${120 - (index * 30)}, 70%, 50%)`,
                        backgroundColor: `hsl(${120 - (index * 30)}, 70%, 50%)`,
                        tension: 0.1,
                        pointRadius: 2,
                      })),
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: { display: false },
                        y: { display: false },
                      },
                      plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                      },
                    }}
                  />
                </div>
              )}
            </div>

            {/* Queue - Medium Card */}
            <div
              onClick={() => setZoomedSection("queue")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-green-900 flex items-center gap-2">
                <ListOrdered size={20} />
                Driver Queue
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {queue.slice(0, 5).map((entry) => {
                  const driver = drivers.find((d) => d.id === entry.driverId);
                  return (
                    <div key={entry.driverId} className="bg-white p-2 rounded shadow-sm text-sm">
                      <p className="font-medium">{driver?.name ?? entry.name}</p>
                      <p className="text-gray-600">{driver?.plate ?? entry.plate}</p>
                    </div>
                  );
                })}
                {queue.length > 5 && (
                  <p className="text-xs text-gray-500">+{queue.length - 5} more</p>
                )}
              </div>
              <div className="mt-2 text-sm font-bold text-green-700">
                Total in Queue: {queue.length}
              </div>
            </div>

            {/* Drivers - Small Card */}
            <div
              onClick={() => setZoomedSection("drivers")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-purple-900 flex items-center gap-2">
                <Users size={20} />
                Drivers
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Total Drivers</p>
                  <p className="text-2xl font-bold text-purple-600">{drivers.length}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-100 p-2 rounded text-center">
                    <p className="font-bold text-green-700">{drivers.filter(d => d.status === 'waiting').length}</p>
                    <p className="text-green-600">In Queue</p>
                  </div>
                  <div className="bg-yellow-100 p-2 rounded text-center">
                    <p className="font-bold text-yellow-700">{drivers.filter(d => d.status === 'in ride').length}</p>
                    <p className="text-yellow-600">In Ride</p>
                  </div>
                  <div className="bg-red-100 p-2 rounded text-center">
                    <p className="font-bold text-red-700">{drivers.filter(d => d.status === 'offline').length}</p>
                    <p className="text-red-600">Offline</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Logs - Small Card */}
            <div
              onClick={() => setZoomedSection("logs")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-gray-900 flex items-center gap-2">
                <FileText size={20} />
                Activity Logs
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="bg-white p-2 rounded shadow-sm text-xs">
                    <p className="font-medium truncate">{log.action}</p>
                    <p className="text-gray-500">{log.timestamp?.seconds ? formatTime(log.timestamp.seconds) : "No time"}</p>
                  </div>
                ))}
                {logs.length > 3 && (
                  <p className="text-xs text-gray-500">+{logs.length - 3} more</p>
                )}
              </div>
              <div className="mt-2 text-sm font-bold text-gray-700">
                Total Logs: {logs.length}
              </div>
            </div>

            {/* History - Small Card */}
            <div
              onClick={() => setZoomedSection("history")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-indigo-900 flex items-center gap-2">
                <History size={20} />
                Driver History
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Registered Drivers</p>
                  <p className="text-2xl font-bold text-indigo-600">{drivers.length}</p>
                </div>
                <div className="text-xs text-gray-600">
                  <p>View registration history and ride logs.</p>
                </div>
              </div>
            </div>

            {/* Pending - Small Card */}
            <div
              onClick={() => setZoomedSection("pending")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-red-900 flex items-center gap-2">
                <AlertCircle size={20} />
                Pending Requests
              </h3>
              <div className="space-y-2">
                <div className="bg-white p-3 rounded shadow-sm">
                  <p className="text-sm text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold text-red-600">{pendingDrivers.length}</p>
                </div>
                {pendingDrivers.length > 0 && (
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {pendingDrivers.slice(0, 2).map((driver) => (
                      <div key={driver.id} className="bg-white p-2 rounded shadow-sm text-xs">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-gray-600">{driver.email}</p>
                      </div>
                    ))}
                    {pendingDrivers.length > 2 && (
                      <p className="text-xs text-gray-500">+{pendingDrivers.length - 2} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Top Drop-offs - Small Card */}
            <div
              onClick={() => setZoomedSection("analytics")}
              className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200 shadow-sm cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="text-lg font-bold mb-2 text-indigo-900 flex items-center gap-2">
                <BarChart3 size={20} />
                Top Drop-offs
              </h3>
              <div className="space-y-2">
                {topDropoffs.slice(0, 3).map((dropoff, index) => (
                  <div key={index} className="bg-white p-2 rounded shadow-sm text-xs">
                    <p className="font-medium">{dropoff.name}</p>
                    <p className="text-gray-600">{dropoff.count} trips</p>
                  </div>
                ))}
                {topDropoffs.length === 0 && (
                  <p className="text-xs text-gray-600">No data available</p>
                )}
              </div>
            </div>
          </div>
        )}

      {showModal && selectedDriver && (
        <EditDriverModal
          driver={selectedDriver}
          onClose={() => setShowModal(false)}
          onSaveSuccess={() => setShowModal(false)}
          user={user}
        />
      )}

      {showAnalyticsFilterModal && (
        <AnalyticsFilterModal
          isOpen={showAnalyticsFilterModal}
          onClose={() => setShowAnalyticsFilterModal(false)}
          onApply={handleApplyAnalyticsFilter}
          onClear={handleClearAnalyticsFilter}
        />
      )}
    </div>
  </div>
);
};

export default Admin;
