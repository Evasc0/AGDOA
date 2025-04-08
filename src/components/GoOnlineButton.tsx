// GoOnline.tsx
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/AuthContext';
import * as turf from '@turf/turf';
import { useState } from 'react';

export default function GoOnlineButton() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = useState("");

  // 🧭 Define the geofence for Camp30 Caliking Atok Benguet
  const geofence = turf.polygon([[
    [120.867, 16.704],
    [120.868, 16.704],
    [120.868, 16.703],
    [120.867, 16.703],
    [120.867, 16.704]
  ]]);

  const handleGoOnline = () => {
    if (!user) return;

    // 🛰 Ask for location permission and validate geofence
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = turf.point([pos.coords.longitude, pos.coords.latitude]);
        const inside = turf.booleanPointInPolygon(point, geofence);

        if (!inside) {
          setWarning("❌ You must be inside the paradahan area to go online.");
          return;
        }

        // ✅ Inside geofence, push to Firebase
        const queueRef = doc(db, 'queues', user.uid);
        await setDoc(queueRef, {
          driverId: user.uid,
          joinedAt: serverTimestamp(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          plateNumber: 'ABC-1234' // 🔧 Replace with real data
        });

        navigate('/queue');
      },
      (err) => {
        console.error("Location Error:", err);
        setWarning("⚠️ Please allow location access to go online.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {warning && (
        <div className="bg-yellow-500 text-black px-4 py-2 rounded text-sm font-medium">
          {warning}
        </div>
      )}

      <button
        onClick={handleGoOnline}
        className="bg-green-600 text-white px-4 py-2 rounded-xl shadow hover:bg-green-700 transition"
      >
        Go Online
      </button>
    </div>
  );
}
