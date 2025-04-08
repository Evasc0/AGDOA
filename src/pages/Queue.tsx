// src/pages/Queue.tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { db } from '../firebase';
import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  setDoc,
  GeoPoint,
  getDocs,
  limit,
} from 'firebase/firestore';
import { useDriverLocation } from '../hooks/useDriverLocation';

interface QueueEntry {
  id: string;
  driverId: string;
  plateNumber?: string;
  joinedAt: Timestamp;
}

export default function QueuePage() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { coords, insideParadahan, error } = useDriverLocation();

  // 🔁 Real-time queue listener
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'queues'), orderBy('joinedAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data() as Omit<QueueEntry, 'id'>;
        return { ...d, id: doc.id };
      });

      setQueue(data);
      const pos = data.findIndex((d) => d.driverId === user.uid);
      setPosition(pos >= 0 ? pos + 1 : null);
      setHasJoined(pos >= 0);
    });

    return () => unsubscribe();
  }, [user]);

  // ✅ Join or leave queue based on GPS
  useEffect(() => {
    const manageQueue = async () => {
      if (!user || !coords) return;

      const driverRef = doc(db, 'queues', user.uid);

      if (insideParadahan && !hasJoined) {
        await setDoc(driverRef, {
          driverId: user.uid,
          plateNumber: (user as any).plateNumber || null,
          joinedAt: Timestamp.now(),
        });
        setHasJoined(true);
      } else if (!insideParadahan && hasJoined) {
        await deleteDoc(driverRef);

        // 🧠 Log geofence exit
        const [latitude, longitude] = coords;
        await setDoc(doc(db, 'geofence_logs', `${user.uid}_${Date.now()}`), {
          driverId: user.uid,
          timestamp: Timestamp.now(),
          location: new GeoPoint(latitude, longitude),
          reason: 'left_geofence',
        });

        setHasJoined(false);
        setPosition(null);
      }
    };

    manageQueue();
  }, [insideParadahan, coords, user, hasJoined]);

  // 📊 Fetch average wait time from logs
  useEffect(() => {
    const fetchAverageWait = async () => {
      const q = query(collection(db, 'ride_logs'), orderBy('joinedAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);

      const waitTimes = snapshot.docs.map(doc => {
        const { joinedAt, startedAt } = doc.data();
        return (startedAt.toMillis() - joinedAt.toMillis()) / 60000; // in minutes
      });

      const avg = waitTimes.length
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 10;

      setEstimatedWait(avg);

      const todayKey = new Date().toISOString().split('T')[0];
      await setDoc(doc(db, 'daily_analytics', todayKey), {
        averageWait: avg,
        updatedAt: Timestamp.now(),
      }, { merge: true });
    };

    fetchAverageWait();
  }, [queue]);

  // ⏱ Countdown logic
  useEffect(() => {
    if (!estimatedWait || !position) return;

    const total = estimatedWait * (position - 1);
    setCountdown(Math.round(total));

    const interval = setInterval(() => {
      setCountdown(prev => (prev && prev > 0 ? prev - 1 : 0));
    }, 60000);

    return () => clearInterval(interval);
  }, [estimatedWait, position]);

  // ⛔ Manual go offline
  const handleGoOffline = async () => {
    if (!user) return;
    await deleteDoc(doc(db, 'queues', user.uid));
    setQueue([]);
    setPosition(null);
    setHasJoined(false);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-gray-800 p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">Queue Position</h2>

      {/* 📍 GPS info */}
      <div className="text-sm mb-3">
        <p className="text-gray-400">📍 Location status:</p>
        <p className={`${insideParadahan ? 'text-green-400' : 'text-red-400'}`}>
          {error || (insideParadahan ? 'Inside paradahan' : 'Outside paradahan – auto offline')}
        </p>
      </div>

      {position ? (
        <>
          <p className="text-green-400 mb-2">You are #{position} in queue</p>

          {estimatedWait !== null && (
            <p className="text-yellow-400">⏱ Estimated wait: {Math.round(estimatedWait * (position - 1))} mins</p>
          )}

          {countdown !== null && (
            <p className="text-blue-400 text-sm">⌛ Countdown: {countdown} mins remaining</p>
          )}

          {position > 1 && (
            <ul className="list-disc ml-6">
              {queue.slice(0, position - 1).map((d, i) => (
                <li key={d.driverId}>
                  #{i + 1} – Plate: {d.plateNumber || 'N/A'}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-red-400">You are not in the queue.</p>
      )}

      <button
        onClick={handleGoOffline}
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition"
      >
        Go Offline
      </button>
    </div>
  );
}
