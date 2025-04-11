// src/pages/History.tsx
import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  Timestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import RideHistoryCard from '../components/RideHistoryCard';
import RideHistoryFilterModal from '../components/RideHistoryFilterModal';
import { Button } from '../components/ui/button';
import { Filter } from 'lucide-react';
import { useAuth } from '../components/AuthContext'; // 👈 make sure you're using this hook to get auth

interface RideLog {
  id: string;
  timestamp: Date;
  duration: number;
  distance: number;
  pickup: string;
  dropoff: string;
  fare: number;
  lastTurningPoint?: string;
}

export default function History() {
  const [logs, setLogs] = useState<RideLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<RideLog[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [minFare, setMinFare] = useState<number | null>(null);

  const { user } = useAuth(); // 🔐 current logged-in user

  const fetchLogs = async () => {
    try {
      if (!user) return;

      const rideLogsRef = collection(db, 'ride_logs');
      const q = query(rideLogsRef, where('driverId', '==', user.uid));

      const snapshot = await getDocs(q);
      const data: RideLog[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<RideLog, 'id' | 'timestamp'>),
        timestamp: (doc.data().timestamp as Timestamp).toDate(),
        lastTurningPoint: doc.data().lastTurningPoint || '', // fallback
      }));

      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Failed to fetch ride logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  const handleApplyFilters = async (): Promise<void> => {
    let filtered = [...logs];

    if (startDate) {
      filtered = filtered.filter((log) => log.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((log) => log.timestamp <= endDate);
    }
    if (pickupLocation) {
      const pickup = pickupLocation.toLowerCase();
      filtered = filtered.filter((log) =>
        log.pickup.toLowerCase().includes(pickup)
      );
    }
    if (dropoffLocation) {
      const dropoff = dropoffLocation.toLowerCase();
      filtered = filtered.filter((log) =>
        log.dropoff.toLowerCase().includes(dropoff)
      );
    }
    if (minFare !== null) {
      filtered = filtered.filter((log) => log.fare >= minFare);
    }

    setFilteredLogs(filtered);
    setIsFilterOpen(false);
  };

  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setPickupLocation('');
    setDropoffLocation('');
    setMinFare(null);
    setFilteredLogs(logs);
    setIsFilterOpen(false);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Ride History</h2>
        <Button onClick={() => setIsFilterOpen(true)} className="gap-2">
          <Filter className="w-4 h-4" /> Filter
        </Button>
      </div>

      {filteredLogs.length === 0 ? (
        <p className="text-center text-gray-400">No rides found.</p>
      ) : (
        filteredLogs.map((log) => (
          <RideHistoryCard key={log.id} log={log} />
        ))
      )}

      <RideHistoryFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        pickupLocation={pickupLocation}
        setPickupLocation={setPickupLocation}
        dropoffLocation={dropoffLocation}
        setDropoffLocation={setDropoffLocation}
        minFare={minFare}
        setMinFare={setMinFare}
      />
    </div>
  );
}
