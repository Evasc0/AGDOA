// src/components/RideHistoryCard.tsx
import React from 'react';

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

interface Props {
  log: RideLog;
}

const RideHistoryCard: React.FC<Props> = ({ log }) => {
  return (
    <div className="bg-gray-700 p-4 rounded-lg mb-4 shadow-md">
      {/* Destination name */}
      <p className="text-lg font-semibold mb-1">{log.dropoffName}</p>

      {/* Date and time */}
      <p className="text-gray-400 text-sm mb-2">
        Ended at: {log.endedAt.toLocaleString()}
      </p>

      {/* Distance and Duration formatted */}
      <p className="mb-1">
        Distance: {log.travelTimeMinutes > 0 ? log.travelTimeMinutes : 0} km &middot; Duration: {log.travelTimeMinutes} mins
      </p>

    
      {/* Fare */}
      <p className="font-semibold mt-2">Earnings: ₱{log.estimatedEarnings}</p>
    </div>
  );
};

export default RideHistoryCard;