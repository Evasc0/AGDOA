import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import RideHistoryCard from '../components/RideHistoryCard';
import RideHistoryFilterModal from '../components/RideHistoryFilterModal';
import { Button } from '../components/ui/button';
import { Filter } from 'lucide-react';

interface RideLog {
  id: string;
  timestamp: Date;
  duration: number;
  distance: number;
  pickup: string;
  dropoff: string;
  fare: number;
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

  const fetchLogs = async () => {
    let q = collection(db, 'rideLogs');
    const snapshot = await getDocs(q);
    const data: RideLog[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toDate(),
    })) as RideLog[];
    setLogs(data);
    setFilteredLogs(data);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleApplyFilters = async () => {
    let q = collection(db, 'rideLogs');
    const snapshot = await getDocs(q);
    let data: RideLog[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: (doc.data().timestamp as Timestamp).toDate(),
    })) as RideLog[];

    if (startDate) {
      data = data.filter((log) => log.timestamp >= startDate);
    }
    if (endDate) {
      data = data.filter((log) => log.timestamp <= endDate);
    }
    if (pickupLocation) {
      const pickup = pickupLocation.toLowerCase();
      data = data.filter((log) =>
        log.pickup.toLowerCase().includes(pickup)
      );
    }
    if (dropoffLocation) {
      const dropoff = dropoffLocation.toLowerCase();
      data = data.filter((log) =>
        log.dropoff.toLowerCase().includes(dropoff)
      );
    }
    if (minFare !== null) {
      data = data.filter((log) => log.fare >= minFare);
    }

    setFilteredLogs(data);
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
