import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { goOnline, goOffline } from "../utils/firebaseQueue";
import { useDriverLocation } from "../hooks/useDriverLocation";

const Home = () => {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const navigate = useNavigate();

  const { coords, insideParadahan, error } = useDriverLocation();

  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) setDriver(JSON.parse(stored));
  }, []);

  // 🟨 Automatically go online if location is inside
  useEffect(() => {
    if (driver && insideParadahan && !isOnline && coords) {
      goOnline(driver.id, {
        name: driver.name,
        plate: driver.plate,
        onlineAt: Date.now(),
        lat: coords[1],
        lng: coords[0],
        status: "online",
      }).then(() => {
        setIsOnline(true);
        navigate("/queue");
      });
    }
  }, [insideParadahan, coords, driver, isOnline, navigate]);

  const handleToggleOnline = async () => {
    if (!driver) return;

    if (!coords) {
      setToastMsg("⚠️ Location is unavailable.");
      return;
    }

    if (insideParadahan) {
      if (!isOnline) {
        await goOnline(driver.id, {
          name: driver.name,
          plate: driver.plate,
          onlineAt: Date.now(),
          lat: coords[1],
          lng: coords[0],
          status: "online",
        });
        setIsOnline(true);
        navigate("/queue");
      } else {
        await goOffline(driver.id);
        setIsOnline(false);
        setToastMsg("🔴 You are now offline.");
      }
    } else {
      setToastMsg("❌ You're outside the paradahan zone.");
    }

    setTimeout(() => setToastMsg(""), 4000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 relative">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Welcome, {driver?.name ?? "Driver"}</h2>
          <button
            onClick={handleToggleOnline}
            className={`px-4 py-1 text-sm rounded font-semibold transition ${
              isOnline ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isOnline ? "Go Offline" : "Go Online"}
          </button>
        </div>

        <hr className="border-gray-700 mb-4" />

        <div className="mb-4">
          {/* 🔍 Highlighted: Location Status */}
          <p className="text-sm text-gray-400 mb-1">
            📍 <span className="font-semibold">Location Status:</span>
          </p>
          <p className={`${insideParadahan ? "text-green-400" : "text-red-400"} text-sm`}>
            {error || (insideParadahan ? "Inside Atok Terminal" : "Outside the Terminal")}
          </p>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-sm font-semibold mb-1">Vehicle Information</p>
          <p><strong>Plate Number:</strong> {driver?.plate}</p>
          <p><strong>Vehicle:</strong> {driver?.vehicle}</p>
        </div>
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
