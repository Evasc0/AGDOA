// src/components/AnalyticsFilterModal.tsx
import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (start: Date | null, end: Date | null) => void;
  onClear?: () => void;
}

const AnalyticsFilterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  onClear,
}) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white text-gray-900 p-6 rounded-xl w-full max-w-md shadow-lg border border-gray-300">
        <h2 className="text-xl font-bold mb-4">Filter Analytics</h2>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => {
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                setStartDate(todayStart);
                setEndDate(now);
                setSelectedMonth(null);
                setSelectedYear(null);
              }}
            >
              Today
            </button>
            <button
              className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => {
                const now = new Date();
                const sevenDaysAgo = new Date(now);
                sevenDaysAgo.setDate(now.getDate() - 7);
                setStartDate(sevenDaysAgo);
                setEndDate(now);
                setSelectedMonth(null);
                setSelectedYear(null);
              }}
            >
              Last 7 Days
            </button>
            <button
              className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => {
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                setStartDate(firstDay);
                setEndDate(now);
                setSelectedMonth(null);
                setSelectedYear(null);
              }}
            >
              This Month
            </button>
            <button
              className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
              onClick={() => {
                setStartDate(null);
                setEndDate(null);
                setSelectedMonth(null);
                setSelectedYear(null);
              }}
            >
              All Time
            </button>
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-900">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded bg-white border border-gray-300"
              value={startDate ? startDate.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setStartDate(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-900">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 rounded bg-white border border-gray-300"
              value={endDate ? endDate.toISOString().split('T')[0] : ''}
              onChange={(e) =>
                setEndDate(e.target.value ? new Date(e.target.value) : null)
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-900">Month</label>
            <select
              className="w-full px-3 py-2 rounded bg-white border border-gray-300"
              value={selectedMonth ?? ''}
              onChange={(e) =>
                setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)
              }
            >
              <option value="">Select Month</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-gray-900">Year</label>
            <select
              className="w-full px-3 py-2 rounded bg-white border border-gray-300"
              value={selectedYear ?? ''}
              onChange={(e) =>
                setSelectedYear(e.target.value ? parseInt(e.target.value) : null)
              }
            >
              <option value="">Select Year</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={() => {
              setStartDate(null);
              setEndDate(null);
              setSelectedMonth(null);
              setSelectedYear(null);
              if (onClear) onClear();
            }}
            className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                let finalStart = startDate;
                let finalEnd = endDate;
                if (selectedMonth !== null && selectedYear !== null) {
                  finalStart = new Date(selectedYear, selectedMonth, 1);
                  finalEnd = new Date(selectedYear, selectedMonth + 1, 0);
                }
                onApply(finalStart, finalEnd);
              }}
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

export default AnalyticsFilterModal;
