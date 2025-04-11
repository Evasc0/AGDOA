// src/pages/Home.tsx
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
  getDocs,
} from "firebase/firestore";
import { useDriverLocation } from "../hooks/useDriverLocation";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Polygon, useMap } from "react-leaflet";
import L from "leaflet";

const paradahanCoords: [number, number][] = [
  [16.722, 120.835],
  [16.722, 120.837],
  [16.720, 120.837],
  [16.720, 120.835],
];

const AutoCenter = ({ coords }: { coords: { latitude: number; longitude: number } | null }) => {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.setView([coords.latitude, coords.longitude], 17);
    }
  }, [coords]);

  return null;
};

const Home = () => {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [manualOffline, setManualOffline] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([]);

  const { coords, insideParadahan, error } = useDriverLocation();

  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) setDriver(JSON.parse(stored));
  }, []);

  useEffect(() => {
    const joinIfInside = async () => {
      if (driver && insideParadahan && !hasJoined && !manualOffline) {
        const driverRef = doc(db, "queues", driver.id);
        await setDoc(driverRef, {
          driverId: driver.id,
          plateNumber: driver.plate,
          joinedAt: Timestamp.now(),
          lat: coords?.latitude,
          lng: coords?.longitude,
        });
        setHasJoined(true);
        setIsOnline(true);
      }
    };
    joinIfInside();
  }, [insideParadahan, coords, driver, hasJoined, manualOffline]);

  useEffect(() => {
    const removeIfOutside = async () => {
      if (driver && hasJoined && !insideParadahan) {
        await deleteDoc(doc(db, "queues", driver.id));
        setHasJoined(false);
        setPosition(null);
        setQueue([]);
        setIsOnline(false);
        setToastMsg("⚠️ You left the paradahan. Removed from queue.");
        setTimeout(() => setToastMsg(""), 3000);
      }
    };
    removeIfOutside();
  }, [insideParadahan, driver, hasJoined]);

  useEffect(() => {
    const q = query(collection(db, "queues"), orderBy("joinedAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setQueue(data);
      const pos = data.findIndex((d) => d.driverId === driver?.id);
      setPosition(pos >= 0 ? pos + 1 : null);
      setOnlineDrivers(data); // show all online drivers
    });

    return () => unsub();
  }, [driver]);

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

    if (!insideParadahan) {
      setToastMsg("⚠️ You must be inside the paradahan to join the queue.");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    const driverRef = doc(db, "queues", driver.id);
    await setDoc(driverRef, {
      driverId: driver.id,
      plateNumber: driver.plate,
      joinedAt: Timestamp.now(),
      lat: coords.latitude,
      lng: coords.longitude,
    });

    setHasJoined(true);
    setManualOffline(false);
    setIsOnline(true);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-4 relative">
      {/* MAP WITH GEOFENCE */}
      <div className="w-full max-w-2xl h-64 mb-4 rounded-xl overflow-hidden shadow-lg">
        <MapContainer center={[16.721, 120.836]} zoom={17} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {coords && (
            <Marker position={[coords.latitude, coords.longitude]} icon={L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [30, 30] })} />
          )}
          <Polygon positions={paradahanCoords} pathOptions={{ color: "green", fillColor: "#2ecc71", fillOpacity: 0.3 }} />
          <AutoCenter coords={coords} />

          {onlineDrivers.map((d) =>
            d.lat && d.lng ? (
              <Marker
                key={d.driverId}
                position={[d.lat, d.lng]}
                icon={L.icon({
                  iconUrl: "https://cdn-icons-png.flaticon.com/512/3048/3048122.png",
                  iconSize: [25, 25],
                })}
              />
            ) : null
          )}
        </MapContainer>
      </div>

      {/* CONTENT */}
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
          <p className="text-sm text-gray-400 mb-1">📍 <span className="font-semibold">Location Status:</span></p>
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
              Your position: <span className="font-semibold text-yellow-300">{position ?? "N/A"}</span>
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
        <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-md flex items-center gap-2 animate-fadeIn text-sm">
          {toastMsg}
          <button onClick={() => setToastMsg("")}><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

export default Home;
