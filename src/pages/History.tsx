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
import { useAuth } from '../components/AuthContext'; // Hook to get logged-in user

interface RideLog {
  id: string;
  driverId: string;
  dropoffLocation: {
    lat: number;
    lng: number;
  };
  dropoffName: string;
  endedAt: Date; // This will be the timestamp for when the ride ended
  estimatedEarnings: number;
  pickupLocation: {
    lat: number;
    lng: number;
  };
  plateNumber: string;
  startedAt: Date; // This will be the timestamp for when the ride started
  travelTimeMinutes: number;
  waitTimeMinutes: number;
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

  const { user } = useAuth();

  // Fetch ride logs for current user
  const fetchLogs = async () => {
    try {
      if (!user) return;

      const rideLogsRef = collection(db, 'ride_logs');
      const q = query(rideLogsRef, where('driverId', '==', user.uid));

      const snapshot = await getDocs(q);
      // Debug logs
      console.log('Fetched snapshot:', snapshot);

      const data: RideLog[] = snapshot.docs.map((doc) => {
        const docData = doc.data();
        return {
          id: doc.id,
          driverId: docData.driverId,
          dropoffLocation: docData.dropoffLocation,
          dropoffName: docData.dropoffName,
          endedAt: (docData.endedAt as Timestamp).toDate(),
          estimatedEarnings: docData.estimatedEarnings,
          pickupLocation: docData.pickupLocation,
          plateNumber: docData.plateNumber,
          startedAt: (docData.startedAt as Timestamp).toDate(),
          travelTimeMinutes: docData.travelTimeMinutes,
          waitTimeMinutes: docData.waitTimeMinutes,
        };
      });

      console.log('Parsed ride logs:', data);

      // Sort logs by endedAt in descending order (most recent first)
      data.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());

      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Failed to fetch ride logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [user]);

  // Apply filters to logs
  const handleApplyFilters = async (): Promise<void> => {
    let filtered = [...logs];

    if (startDate) filtered = filtered.filter(log => log.endedAt >= startDate);
    if (endDate) filtered = filtered.filter(log => log.endedAt <= endDate);
    if (pickupLocation) {
      const pickup = pickupLocation.toLowerCase();
      filtered = filtered.filter(log => 
        `${log.pickupLocation.lat}, ${log.pickupLocation.lng}`.toLowerCase().includes(pickup)
      );
    }
    if (dropoffLocation) {
      const dropoff = dropoffLocation.toLowerCase();
      filtered = filtered.filter(log => log.dropoffName.toLowerCase().includes(dropoff));
    }
    if (minFare !== null) {
      // Filter to rides with fare >= minFare
      filtered = filtered.filter(log => log.estimatedEarnings >= minFare);
      // Sort by absolute difference (closest to searched fare first)
      filtered.sort((a, b) =>
        Math.abs(a.estimatedEarnings - minFare) - Math.abs(b.estimatedEarnings - minFare)
      );
    } else {
      // If no minFare filter, sort by endedAt descending
      filtered.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
    }

    setFilteredLogs(filtered);
    setIsFilterOpen(false);
  };

  // Clear all filters and reset list
  const handleClearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setPickupLocation('');
    setDropoffLocation('');
    setMinFare(null);
    // Reset filters and sort by endedAt descending
    const sortedLogs = [...logs].sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
    setFilteredLogs(sortedLogs);
    setIsFilterOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto min-h-screen">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold animate-fade-in">Ride History</h2>
            <Button
              onClick={() => setIsFilterOpen(true)}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              <Filter className="w-4 h-4" /> Filter
            </Button>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow-lg text-center animate-fade-in-up">
              <p className="text-gray-500 text-lg">No rides found.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              {filteredLogs.map((log, index) => (
                <div
                  key={log.id}
                  className="animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <RideHistoryCard log={log} />
                </div>
              ))}
            </div>
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
            dropoffLocation={dropoffLocation}
            setDropoffLocation={setDropoffLocation}
            minFare={minFare}
            setMinFare={setMinFare}
          />
        </div>
      </div>
    </div>
  );
}
