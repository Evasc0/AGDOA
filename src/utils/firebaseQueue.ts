import { db } from '../firebase';
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  orderBy,
  query,
  DocumentReference,
} from 'firebase/firestore';

// ⛳ Driver queue data type
export type DriverQueueData = {
  name: string;
  plate: string;
  onlineAt: number;
  lat: number;
  lng: number;
  status: 'online' | 'offline';
};

// 🟢 Go Online: Add/update driver in Firestore "queues" collection
export const goOnline = async (
  driverId: string,
  data: DriverQueueData
): Promise<void> => {
  try {
    const ref: DocumentReference = doc(db, 'queues', driverId);
    await setDoc(ref, data);
    console.log(`[goOnline] Driver ${driverId} is now online.`);
  } catch (error) {
    console.error('[goOnline] Failed:', error);
    throw error;
  }
};

// 🔴 Go Offline: Remove driver from the queue
export const goOffline = async (driverId: string): Promise<void> => {
  try {
    const ref: DocumentReference = doc(db, 'queues', driverId);
    await deleteDoc(ref);
    console.log(`[goOffline] Driver ${driverId} has gone offline.`);
  } catch (error) {
    console.error('[goOffline] Failed:', error);
    throw error;
  }
};

// 🔁 Real-time watcher for the entire queue (FIFO order)
export const watchQueue = (
  callback: (drivers: DriverQueueData[]) => void
): (() => void) => {
  const q = query(collection(db, 'queues'), orderBy('onlineAt', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const drivers = snapshot.docs.map(doc => doc.data() as DriverQueueData);
    callback(drivers);
  });

  return unsubscribe;
};
