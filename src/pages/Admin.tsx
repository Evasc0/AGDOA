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
    "drivers" | "logs" | "queue" | "history" | "pending"
  >("drivers");

  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Keep track of driverId timers to set offline after 1 min if they don't return to queue
  const offlineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  // Keep previous queue for comparison
  const prevQueueDriverIds = useRef<Set<string>>(new Set());

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

    // Listen to drivers collection
    const unsubDrivers = onSnapshot(
      collection(db, "drivers"),
      (snap) => {
        const allDrivers = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Driver[];

        setDrivers(allDrivers.filter((d) => d.verified === true));
        setPendingDrivers(allDrivers.filter((d) => d.verified === false));
      },
      (error) => {
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

  return (
    <div className="p-4 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <div className="flex gap-2 items-center flex-wrap">
          {["drivers", "queue", "logs", "history", "pending"].map((type) => (
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
