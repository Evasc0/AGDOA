import { db } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot, collection, orderBy, query } from 'firebase/firestore';

export type DriverQueueData = {
    name: string;
    plate: string;
    onlineAt: number;
    lat: number;
    lng: number;
    status: 'online' | 'offline';
  };

export const goOnline = async (driverId: string, data: DriverQueueData) => {
  const ref = doc(db, 'queues', driverId);
  await setDoc(ref, data);
};

export const goOffline = async (driverId: string) => {
  const ref = doc(db, 'queues', driverId);
  await deleteDoc(ref);
};

export const watchQueue = (
  callback: (drivers: DriverQueueData[]) => void
) => {
  const q = query(collection(db, 'queues'), orderBy('onlineAt', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const drivers = snapshot.docs.map(doc => doc.data() as DriverQueueData);
    callback(drivers);
  });
};
