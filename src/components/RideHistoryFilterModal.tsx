import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => Promise<void>;
  onClear: () => void;
  startDate: Date | null;
  setStartDate: (date: Date | null) => void;
  endDate: Date | null;
  setEndDate: (date: Date | null) => void;
  pickupLocation: string;
  setPickupLocation: (value: string) => void;
  dropoffLocation: string;
  setDropoffLocation: (value: string) => void;
  minFare: number | null;
  setMinFare: (value: number | null) => void;
}

const RideHistoryFilterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  onClear,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  pickupLocation,
  setPickupLocation,
  dropoffLocation,
  setDropoffLocation,
  minFare,
  setMinFare,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-900 text-white p-6 rounded-xl w-full max-w-md shadow-lg">
        <h2 className="text-xl font-bold mb-4">Filter Rides</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
              value={startDate ? startDate.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setStartDate(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-1">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
              value={endDate ? endDate.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setEndDate(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Pickup Location</label>
            <input
              type="text"
              placeholder="e.g., Caliking"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Dropoff Location</label>
            <input
              type="text"
              placeholder="e.g., La Trinidad"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Minimum Fare (₱)</label>
            <input
              type="number"
              placeholder="e.g., 50"
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700"
              value={minFare ?? ''}
              onChange={(e) =>
                setMinFare(e.target.value ? parseFloat(e.target.value) : null)
              }
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={onClear}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideHistoryFilterModal;
