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
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SortableItem = ({ id, name, plate, onRemove }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex justify-between items-center bg-gray-700 p-2 rounded cursor-move">
      <span>{name} ({plate})</span>
      <button onClick={() => onRemove(id)} className="text-red-400">Remove</button>
    </li>
  );
};

const Admin = () => {
  const db = getFirestore();
  const auth = getAuth();

  const [drivers, setDrivers] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"drivers" | "logs" | "queue">("drivers");

  const [newDriver, setNewDriver] = useState({ email: "", password: "", name: "", plate: "" });
  const [showModal, setShowModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      setDrivers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubQueue = onSnapshot(query(collection(db, "queue"), orderBy("joinedAt")), (snap) => {
      setQueue(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLogs = onSnapshot(collection(db, "adminAccessLogs"), (snap) => {
      setLogs(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubDrivers();
      unsubQueue();
      unsubLogs();
    };
  }, []);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.findIndex((item) => item.driverId === active.id);
    const newIndex = queue.findIndex((item) => item.driverId === over.id);
    const newQueue = arrayMove(queue, oldIndex, newIndex);
    setQueue(newQueue);

    // Update Firestore
    const batch = writeBatch(db);
    newQueue.forEach((item, index) => {
      const ref = doc(db, "queue", item.driverId);
      batch.update(ref, { joinedAt: serverTimestamp(), order: index });
    });
    await batch.commit();
    toast.success("Queue reordered");
  };

  const handleRegister = async () => {
    const { email, password, name, plate } = newDriver;
    if (!email || !password || !name || !plate) return toast.error("Fill all fields");

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCred.user);

      await addDoc(collection(db, "drivers"), {
        id: userCred.user.uid,
        name,
        plate,
        email,
        status: "offline",
        createdAt: serverTimestamp(),
      });

      toast.success("Driver registered & verification sent");
      setNewDriver({ email: "", password: "", name: "", plate: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "drivers", id));
      toast.success("Driver deleted");
    } catch {
      toast.error("Error deleting driver");
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    try {
      await updateDoc(doc(db, "drivers", id), {
        status: current === "online" ? "offline" : "online",
      });
      toast.success("Status updated");
    } catch {
      toast.error("Error updating status");
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent");
    } catch {
      toast.error("Error sending reset email");
    }
  };

  const resendVerification = async (email: string) => {
    toast.error("Client SDK can't resend verification. Use Admin SDK.");
  };

  const addToQueue = async (driver: any) => {
    try {
      await setDoc(doc(db, "queue", driver.id), {
        driverId: driver.id,
        name: driver.name,
        plate: driver.plate,
        joinedAt: serverTimestamp(),
      });
      toast.success(`${driver.name} added to queue`);
    } catch {
      toast.error("Failed to add to queue");
    }
  };

  const removeFromQueue = async (id: string) => {
    try {
      await deleteDoc(doc(db, "queue", id));
      toast.success("Driver removed from queue");
    } catch {
      toast.error("Failed to remove from queue");
    }
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate?.toLowerCase().includes(search.toLowerCase())
  );

  const onlineNotInQueue = drivers.filter(
    (d) => d.status === "online" && !queue.find((q) => q.driverId === d.id)
  );

  return (
    <div className="p-4 max-w-6xl mx-auto text-white">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold">Admin Panel</h1>
        <div className="space-x-2">
          <button onClick={() => setTab("drivers")} className={`px-3 py-2 rounded ${tab === "drivers" ? "bg-blue-600" : "bg-gray-700"}`}>Drivers</button>
          <button onClick={() => setTab("queue")} className={`px-3 py-2 rounded ${tab === "queue" ? "bg-blue-600" : "bg-gray-700"}`}>Queue</button>
          <button onClick={() => setTab("logs")} className={`px-3 py-2 rounded ${tab === "logs" ? "bg-blue-600" : "bg-gray-700"}`}>Logs</button>
        </div>
      </div>

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
                      <button onClick={() => { setSelectedDriver(driver); setShowModal(true); }} className="text-blue-400">Edit</button>
                      <button onClick={() => handleDelete(driver.id)} className="text-red-400">Delete</button>
                      <button onClick={() => toggleStatus(driver.id, driver.status)} className="text-yellow-400">Toggle</button>
                      <button onClick={() => resetPassword(driver.email)} className="text-purple-400">Reset</button>
                      <button onClick={() => addToQueue(driver)} className="text-green-400">Add to Queue</button>
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
            <button onClick={handleRegister} className="mt-2 px-4 py-2 bg-blue-600 rounded">Register</button>
          </div>
        </>
      )}

      {tab === "queue" && (
        <div className="bg-gray-800 p-4 rounded mt-4">
          <h2 className="text-lg font-bold mb-2">Driver Queue (Drag to Reorder)</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={queue.map((q) => q.driverId)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2 max-h-[400px] overflow-y-auto">
                {queue.map((entry) => (
                  <SortableItem
                    key={entry.driverId}
                    id={entry.driverId}
                    name={entry.name}
                    plate={entry.plate}
                    onRemove={removeFromQueue}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <div className="mt-6">
            <h3 className="text-md font-semibold mb-2">Online but not in queue:</h3>
            <ul className="space-y-1 text-sm">
              {onlineNotInQueue.map((d) => (
                <li key={d.id} className="flex justify-between items-center bg-gray-700 p-2 rounded">
                  <span>{d.name} ({d.plate})</span>
                  <button onClick={() => addToQueue(d)} className="text-green-400">Add</button>
                </li>
              ))}
              {onlineNotInQueue.length === 0 && <li className="text-gray-400 italic">None</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="mt-4 bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-bold mb-2">Admin Activity Logs</h2>
          <div className="overflow-y-auto max-h-[400px] space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="border-b border-gray-600 py-1">
                <p className="text-sm">
                  <strong>{log.email}</strong> —{" "}
                  {log.accessedAt?.seconds
                    ? new Date(log.accessedAt.seconds * 1000).toLocaleString()
                    : "No time"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
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
