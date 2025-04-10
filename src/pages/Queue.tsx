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
import { AnimatePresence, motion } from 'framer-motion';

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
  const [loading, setLoading] = useState(true);

  const { coords, insideParadahan, error } = useDriverLocation();

  // 🔁 Real-time listener
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'queues'), orderBy('joinedAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data() as Omit<QueueEntry, 'id'>;
        return { ...d, id: doc.id };
      });

      setQueue(data);
      const pos = data.findIndex((d) => d.driverId === user.uid);
      setPosition(pos >= 0 ? pos + 1 : null);
      setHasJoined(pos >= 0);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ✅ Auto join/leave queue
  useEffect(() => {
    if (!user || !coords) return;

    const updateQueue = async () => {
      const driverRef = doc(db, 'queues', user.uid);

      if (insideParadahan && !hasJoined) {
        await setDoc(driverRef, {
          driverId: user.uid,
          plateNumber: (user as any).plateNumber || 'N/A',
          joinedAt: Timestamp.now(),
        });
        setHasJoined(true);
      }

      if (!insideParadahan && hasJoined) {
        await deleteDoc(driverRef);
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

    updateQueue();
  }, [insideParadahan, coords, user, hasJoined]);

  // 📊 Average wait time logic
  useEffect(() => {
    const fetchAverageWait = async () => {
      const q = query(collection(db, 'ride_logs'), orderBy('joinedAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);

      const waitTimes = snapshot.docs.map((doc) => {
        const { joinedAt, startedAt } = doc.data();
        return (startedAt.toMillis() - joinedAt.toMillis()) / 60000;
      });

      const avg = waitTimes.length
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 10;

      setEstimatedWait(avg);

      const todayKey = new Date().toISOString().split('T')[0];
      await setDoc(
        doc(db, 'daily_analytics', todayKey),
        {
          averageWait: avg,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    };

    fetchAverageWait();
  }, [queue]);

  // ⏱ Countdown timer
  useEffect(() => {
    if (!estimatedWait || !position) return;

    const total = Math.round(estimatedWait * (position - 1));
    setCountdown(total);

    const interval = setInterval(() => {
      setCountdown((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 60000);

    return () => clearInterval(interval);
  }, [estimatedWait, position]);

  // ⛔ Manual go offline
  const handleGoOffline = async () => {
    if (!user) return;
    await deleteDoc(doc(db, 'queues', user.uid));
    setHasJoined(false);
    setPosition(null);
    setQueue([]);
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-gray-800 p-6 rounded-xl shadow text-white">
      <h2 className="text-xl font-bold mb-4">Queue Position</h2>

      {/* 📍 Location Status */}
      <div className="text-sm mb-3">
        <p className="text-gray-400">📍 Location status:</p>
        <p className={insideParadahan ? 'text-green-400' : 'text-red-400'}>
          {error || (insideParadahan ? 'Inside paradahan' : 'Outside paradahan – auto offline')}
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading queue...</p>
      ) : position ? (
        <>
          {position === 1 && (
            <div className="bg-yellow-600 text-white px-3 py-2 rounded mb-3 text-center animate-bounce">
              🚖 It's your turn! Prepare to get a passenger.
            </div>
          )}

          <p className="text-green-400 mb-2">You are #{position} in queue</p>

          {estimatedWait !== null && (
            <p className="text-yellow-400">
              ⏱ Estimated wait: {Math.round(estimatedWait * (position - 1))} mins
            </p>
          )}

          {countdown !== null && (
            <p className="text-blue-400 text-sm">⌛ Countdown: {countdown} mins remaining</p>
          )}

          {position > 1 && (
            <ul className="list-disc ml-6 mt-2 text-sm text-gray-300">
              <AnimatePresence>
                {queue.slice(0, position - 1).map((d, i) => (
                  <motion.li
                    key={d.driverId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    #{i + 1} – Plate: {d.plateNumber || 'N/A'}
                  </motion.li>
                ))}
              </AnimatePresence>
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
