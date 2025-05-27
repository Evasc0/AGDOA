import { useEffect, useState } from "react";
import {
  collection,
  getFirestore,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  getAuth,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";

interface Driver {
  id: string;
  name: string;
  plate: string;
  email: string;
  status: "online" | "offline";
  createdAt?: any;
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

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
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"drivers" | "logs" | "queue" | "history">("drivers");

  const [newDriver, setNewDriver] = useState({ email: "", password: "", name: "", plate: "" });
  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

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

  // Fetch drivers, queue, and logs from Firestore when user is authenticated
  useEffect(() => {
    if (!user) return;

    // Listen to drivers collection
    const unsubDrivers = onSnapshot(
      collection(db, "drivers"),
      (snap) => {
        setDrivers(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Driver))
        );
      },
      (error) => {
        toast.error("Error fetching drivers: " + error.message);
      }
    );

    // Listen to queues collection, ordered by 'order' field or fallback to 'joinedAt'
    const queueQuery = query(collection(db, "queues"), orderBy("joinedAt", "asc"));
    const unsubQueue = onSnapshot(
      queueQuery,
      (snap) => {
        setQueue(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as QueueEntry))
        );
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

  // Register new driver (adds document in drivers collection)
  const handleRegister = async () => {
    const { email, password, name, plate } = newDriver;
    if (!email || !password || !name || !plate) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await addDoc(collection(db, "drivers"), {
        name,
        plate,
        email,
        status: "offline",
        createdAt: serverTimestamp(),
      });
      toast.success("Driver registered successfully");
      setNewDriver({ email: "", password: "", name: "", plate: "" });
    } catch (err: any) {
      toast.error("Failed to register driver: " + err.message);
    }
  };

  // Delete driver document
  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "drivers", id));
      toast.success("Driver deleted");
    } catch (error: any) {
      console.error("Error deleting driver:", error);
      toast.error("Error deleting driver");
    }
  };

  // Toggle driver status online/offline
  const toggleStatus = async (id: string, current: string) => {
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: current === "online" ? "offline" : "online",
      });
      toast.success("Status updated");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Error updating status");
    }
  };

  // Reset password email
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast.error("Error sending reset email");
    }
  };

  // Add driver to queue, set order to last position
  const addToQueue = async (driver: Driver) => {
    console.log("Adding to queue:", driver); // Debug: Log driver being added
    try {
      await setDoc(doc(db, "queues", driver.id), {
        driverId: driver.id,
        name: driver.name,
        plate: driver.plate,
        joinedAt: serverTimestamp(),
        order: queue.length, // Add at the end of queue
      });
      toast.success(`${driver.name} added to queue`);
    } catch (error: any) {
      console.error("Error adding to queue:", error); // Debug: Log error
      toast.error("Failed to add to queue: " + error.message);
    }
  };

  // Remove driver from queue
  const removeFromQueue = async (id: string) => {
    try {
      await deleteDoc(doc(db, "queues", id));
      toast.success("Driver removed from queue");
    } catch (error: any) {
      console.error("Failed to remove from queue:", error);
      toast.error("Failed to remove from queue: " + error.message);
    }
  };

  // Filter drivers for search
  const filteredDrivers = drivers.filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate?.toLowerCase().includes(search.toLowerCase())
  );

  // Online drivers not currently in queue
  const onlineNotInQueue = drivers.filter(
    (d) => d.status === "online" && !queue.find((q) => q.driverId === d.id)
  );

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out");
      navigate("/login");
    } catch (error: any) {
      console.error("Logout failed:", error);
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
        <div className="flex gap-2 items-center">
          {["drivers", "queue", "logs", "history"].map((type) => (
            <button
              key={type}
              onClick={() => setTab(type as any)}
              className={`px-3 py-2 rounded ${tab === type ? "bg-blue-600" : "bg-gray-700"}`}
            >
              {type[0].toUpperCase() + type.slice(1)}
            </button>
          ))}
          <button onClick={handleLogout} className="px-3 py-2 rounded bg-red-600">
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
                    <td>{driver.status}</td>
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
                      <button onClick={() => handleDelete(driver.id)} className="text-red-400">
                        Delete
                      </button>
                      <button onClick={() => toggleStatus(driver.id, driver.status)} className="text-yellow-400">
                        Toggle
                      </button>
                      <button onClick={() => resetPassword(driver.email)} className="text-purple-400">
                        Reset
                      </button>
                      <button onClick={() => addToQueue(driver)} className="text-green-400">
                        Add to Queue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 bg-gray-800 p-4 rounded">
            <h2 className="text-lg font-bold mb-2">Register New Driver</h2>
            <div className="grid md:grid-cols-4 gap-2">
              {["name", "plate", "email", "password"].map((field) => (
                <input
                  key={field}
                  type={field === "password" ? "password" : "text"}
                  placeholder={field[0].toUpperCase() + field.slice(1)}
                  value={(newDriver as any)[field]}
                  onChange={(e) => setNewDriver({ ...newDriver, [field]: e.target.value })}
                  className="p-2 text-black rounded"
                />
              ))}
            </div>
            <button onClick={handleRegister} className="mt-2 px-4 py-2 bg-blue-600 rounded">
              Register
            </button>
          </div>
        </>
      )}

      {/* QUEUE */}
      {tab === "queue" && (
  <div className="bg-gray-800 p-4 rounded mt-4">
    <h2 className="text-lg font-bold mb-2">Driver Queue (Drag to Reorder)</h2>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={queue.map((q) => q.driverId)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2 max-h-[400px] overflow-y-auto">
          {queue.map((entry) => {
            // Find the driver data corresponding to this queue entry
            const driver = drivers.find((d) => d.id === entry.driverId);
            const status = driver?.status || "offline";
            // Optional: If you track "in ride" status differently, adjust status here


            return (
              <SortableItem
                key={entry.driverId}
                id={entry.driverId}
                name={driver?.name ?? entry.name}
                plate={driver?.plate ?? entry.plate}
                onRemove={removeFromQueue}
              >
                <span
                  className={`ml-4 text-sm font-medium ${
                    status === "online" ? "text-green-400" : status === "offline" ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {status}
                </span>
              </SortableItem>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>

    <div className="mt-6">
      <h3 className="text-md font-semibold mb-2">Online but not in queue:</h3>
      <ul className="space-y-1 text-sm">
        {onlineNotInQueue.length > 0 ? (
          onlineNotInQueue.map((d) => (
            <li
              key={d.id}
              className="flex justify-between items-center bg-gray-700 p-2 rounded"
            >
              <span>
                {d.name} ({d.plate}) -{" "}
                <span className="text-green-400 font-semibold">{d.status}</span>
              </span>
              <button onClick={() => addToQueue(d)} className="text-green-400">
                Add
              </button>
            </li>
          ))
        ) : (
          <li className="text-gray-400 italic">None</li>
        )}
      </ul>
    </div>
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
                  {log.accessedAt?.seconds ? formatTime(log.accessedAt.seconds) : "No time"}
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
                  <strong>{driver.name}</strong> — {driver.plate} — {driver.status} — Registered on:{" "}
                  {formatTime(driver.createdAt?.seconds)}
                </p>
              </div>
            ))}
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
