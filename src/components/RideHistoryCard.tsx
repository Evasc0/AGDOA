// src/components/RideHistoryCard.tsx
import React from 'react';

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

interface RideHistoryCardProps {
  log: RideLog;
}

export default function RideHistoryCard({ log }: RideHistoryCardProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-xl mb-4 shadow">
      <div className="text-sm text-gray-400">
        {log.timestamp.toLocaleString()}
      </div>
      <div className="mt-1 text-base font-semibold">
        {log.pickup} → {log.dropoff}
      </div>
      {log.lastTurningPoint && (
        <div className="text-xs text-yellow-300 mt-1 italic">
          Last Turn: {log.lastTurningPoint}
        </div>
      )}
      <div className="text-sm mt-1">
        Distance: {log.distance} km · Duration: {log.duration} mins
      </div>
      <div className="text-green-400 font-bold mt-1">₱{log.fare}</div>
    </div>
  );
}
