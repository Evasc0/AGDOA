import React, { useCallback, useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../components/AuthContext';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { fareMatrix } from '../utils/fareMatrix';
import AnalyticsFilterModal from '../components/AnalyticsFilterModal';

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement);

const OPENWEATHER_API_KEY = 'cdbb40b30135e8397fe914b98c469d44';

type WeatherData = {
  date: string;
  temp: number;
  description: string;
  icon: string;
};

const weatherToEmoji = (desc: string): string => {
  desc = desc.toLowerCase();
  if (desc.includes('rain')) return '🌧️';
  if (desc.includes('cloud')) return '☁️';
  if (desc.includes('clear')) return '☀️';
  if (desc.includes('storm')) return '⛈️';
  if (desc.includes('snow')) return '❄️';
  if (desc.includes('fog') || desc.includes('mist')) return '🌫️';
  return '🌈';
};

const normalizeKey = (key: string) => key.trim().toLowerCase();

// Define distinct color arrays for different time periods
const dailyColors = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800080'
];
const weeklyColors = [
  '#FF6347', '#32CD32', '#1E90FF', '#FFD700'
];
const monthlyColors = [
  '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800080',
  '#FFA500', '#A52A2A', '#808080', '#000080', '#008080'
];

const Analytics: React.FC = () => {
  const { user } = useAuth();

  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [dropoffAreas, setDropoffAreas] = useState<Record<string, { count: number; earnings: number }>>({});
  const [alertMsg, setAlertMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dailyStats, setDailyStats] = useState<
    { date: string; earnings: number; rides: number }[]
  >([]);
  const [filter, setFilter] = useState<'weekly' | 'monthly' | 'annually'>('weekly');
  const [pieStats, setPieStats] = useState<{ label: string; earnings: number; rides: number }[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [customFilter, setCustomFilter] = useState(false);

  // Fetch 7-day weather forecast
  const fetchWeather = useCallback(() => {
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${coords.latitude}&lon=${coords.longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`);
        const data = await res.json();

        const daily: WeatherData[] = data.list
          .filter((_: any, idx: number) => idx % 8 === 0)
          .slice(0, 7)
          .map((entry: any) => {
            const date = new Date(entry.dt_txt);
            const desc = entry.weather[0].description;
            const emoji = weatherToEmoji(desc);
            if (!alertMsg && (desc.includes('rain') || desc.includes('storm'))) {
              setAlertMsg('☔ Expect rain — rides may increase!');
            }
            return {
              date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
              temp: entry.main.temp,
              description: desc,
              icon: emoji,
            };
          });
        setForecast(daily);
      } catch (err) {
        console.error('Weather fetch error:', err);
      }
    }, (err) => {
      console.error("Failed to get location for weather:", err);
    });
  }, [alertMsg]);

  // Fetch analytics data for bar chart (7 days)
  const fetchAnalytics = useCallback(async () => {
  if (!user) return;
  setRefreshing(true);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Get the date 6 days ago to include today

    const q = query(
      collection(db, 'ride_logs'),
      where('driverId', '==', user.uid),
      where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo)) // Fetch rides from the last 7 days
    );

    const snapshot = await getDocs(q);

    let totalEarnings = 0;
    let totalWaitTime = 0;
    let ridesWithWaitTimeCount = 0;
    let dropoffs: Record<string, { count: number; earnings: number }> = {};
    let statMap: Record<string, { earnings: number; rides: number; date: Date }> = {};

    // Initialize statMap for the last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo.getTime() + i * 86400000);
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      statMap[label] = { earnings: 0, rides: 0, date: d }; // Store the actual date
    }

    // Variables to track today's rides and earnings
    let todayEarnings = 0;
    let todayRidesCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const ts = data.timestamp?.toDate();
      if (!ts) return;

      const dropoffNameRaw = data.dropoffName || "";
      const dropoffName = dropoffNameRaw.trim();

      const normalizedFareMatrix: Record<string, number> = {};
      Object.entries(fareMatrix).forEach(([key, val]) => {
        normalizedFareMatrix[normalizeKey(key)] = val;
      });

      const fare = normalizedFareMatrix[normalizeKey(dropoffName)] || 0;

      totalEarnings += fare; // Accumulate total earnings for the last 7 days

      // Check if the ride is today
      if (ts >= today && ts < new Date(today.getTime() + 86400000)) {
        todayEarnings += fare; // Accumulate today's earnings
        todayRidesCount++; // Count today's rides
      }

      // Update wait time
      if (typeof data.waitTimeMinutes === "number" && data.waitTimeMinutes >= 0) {
        totalWaitTime += data.waitTimeMinutes;
        ridesWithWaitTimeCount++;
      }

      const dayLabel = ts.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (statMap[dayLabel]) {
        statMap[dayLabel] = {
          earnings: (statMap[dayLabel]?.earnings || 0) + fare,
          rides: (statMap[dayLabel]?.rides || 0) + 1,
          date: statMap[dayLabel].date // Keep the actual date
        };
      }

      // Update drop-off statistics
      if (dropoffName) {
        if (!dropoffs[dropoffName]) {
          dropoffs[dropoffName] = { count: 0, earnings: 0 };
        }
        dropoffs[dropoffName].count += 1;
        dropoffs[dropoffName].earnings += fare;
      }
    });

    // Set today's rides and earnings
    setRidesToday(todayRidesCount);
    setEarnings(todayEarnings);
    
    // Calculate average wait time for the past 7 days
    setAvgWaitTime(
      ridesWithWaitTimeCount ? Math.round(totalWaitTime / ridesWithWaitTimeCount) : 0
    );

    // Set drop-off areas
    setDropoffAreas(dropoffs);

    // Set daily stats for the 7-day trend
    setDailyStats(
      Object.entries(statMap)
        .reverse()
        .map(([date, values]) => {
          const formattedDate = values.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
          return {
            date: formattedDate, // Include the day of the week in the date
            earnings: values.earnings || 0,
            rides: values.rides || 0
          };
        })
    );

  } catch (err) {
    console.error("Error loading analytics:", err);
  }
  setRefreshing(false);
}, [user]);

  // Fetch data for pie chart based on filter
  const fetchPie = useCallback(async (selectedFilter: 'weekly' | 'monthly' | 'annually', customStart?: Date | null, customEnd?: Date | null) => {
    if (!user) return;

    try {
      let startDate: Date;
      let endDate: Date;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      } else {
        const daysBack = selectedFilter === 'annually' ? 365 : selectedFilter === 'monthly' ? 30 : 7;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (daysBack - 1));
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
      }

      const q = query(
        collection(db, 'ride_logs'),
        where('driverId', '==', user.uid),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate))
      );

      const snapshot = await getDocs(q);

      let statMap: Record<string, { earnings: number; rides: number; date: Date }> = {};

      // Initialize statMap for the period
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      for (let i = 0; i < daysDiff; i++) {
        const d = new Date(startDate.getTime() + i * 86400000);
        const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        statMap[label] = { earnings: 0, rides: 0, date: d };
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp?.toDate();
        if (!ts) return;

        const dropoffNameRaw = data.dropoffName || "";
        const dropoffName = dropoffNameRaw.trim();

        const normalizedFareMatrix: Record<string, number> = {};
        Object.entries(fareMatrix).forEach(([key, val]) => {
          normalizedFareMatrix[normalizeKey(key)] = val;
        });

        const fare = normalizedFareMatrix[normalizeKey(dropoffName)] || 0;

        const dayLabel = ts.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        if (statMap[dayLabel]) {
          statMap[dayLabel].earnings += fare;
          statMap[dayLabel].rides += 1;
        }
      });

      // Aggregate based on filter
      let aggregated: Record<string, { earnings: number; rides: number }> = {};

      if (customStart && customEnd) {
        // For custom filter, use daily
        Object.entries(statMap).forEach(([label, data]) => {
          aggregated[label] = data;
        });
      } else if (selectedFilter === 'weekly') {
        // For weekly, use daily
        Object.entries(statMap).forEach(([label, data]) => {
          aggregated[label] = data;
        });
      } else if (selectedFilter === 'monthly') {
        // Group by week
        Object.entries(statMap).forEach(([label, data]) => {
          const weekStart = new Date(data.date);
          weekStart.setDate(data.date.getDate() - data.date.getDay());
          const weekLabel = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          if (!aggregated[weekLabel]) {
            aggregated[weekLabel] = { earnings: 0, rides: 0 };
          }
          aggregated[weekLabel].earnings += data.earnings;
          aggregated[weekLabel].rides += data.rides;
        });
      } else if (selectedFilter === 'annually') {
        // Group by month
        Object.entries(statMap).forEach(([label, data]) => {
          const monthLabel = data.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
          if (!aggregated[monthLabel]) {
            aggregated[monthLabel] = { earnings: 0, rides: 0 };
          }
          aggregated[monthLabel].earnings += data.earnings;
          aggregated[monthLabel].rides += data.rides;
        });
      }

      const pieData = Object.entries(aggregated).map(([label, data]) => ({
        label,
        earnings: data.earnings,
        rides: data.rides
      }));

      setPieStats(pieData);
    } catch (err) {
      console.error("Error loading pie analytics:", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchWeather();
      fetchAnalytics();
      fetchPie(filter);
    }
  }, [user, fetchWeather, fetchAnalytics, fetchPie, filter]);

  useEffect(() => {
    if (user) {
      fetchPie(filter);
    }
  }, [filter, fetchPie, user]);

  return (
    <div className="p-4 text-white max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">📊 Analytics Dashboard</h1>

      {alertMsg && <div className="bg-yellow-600 p-3 rounded-lg mb-6">{alertMsg}</div>}

      {forecast.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mb-8">
          {forecast.map((day, i) => (
            <div key={i} className="bg-blue-900 p-3 rounded-xl flex flex-col items-center shadow">
              <p className="text-sm font-medium">{day.date}</p>
              <div className="text-3xl my-2">{day.icon}</div>
              <p className="font-bold">{day.temp.toFixed(1)}°C</p>
              <p className="text-xs capitalize text-center">{day.description}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8 ">
        <div className="bg-gray-800 p-5 rounded-lg text-center">
          <div className=" text-3xl">🕒</div>
          <p className="mt-2 font-semibold text-lg">Avg Wait Time</p>
          <p className="text-xl">{avgWaitTime} mins</p>
          <p className="text-xs italic mt-1">(Based on queued wait times recorded)</p>
        </div>
        <div className="bg-gray-800 p-5 rounded-lg text-center">
          <div className="text-3xl">🚖</div>
          <p className="mt-2 font-semibold text-lg">Rides Today</p>
          <p className="text-xl">{ridesToday} <br />as of {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="bg-gray-800 p-5 rounded-lg text-center">
          <div className="text-3xl">🤑</div>
          <p className="mt-2 font-semibold text-lg">Total Earnings</p>
          <p className="text-xl">₱{earnings.toFixed(2)} <br />as of {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg mb-8">
        <h2 className="font-semibold mb-2">🏁 Top Drop-offs</h2>
        {Object.entries(dropoffAreas).length ? (
          <ul className="list-disc list-inside text-sm max-h-48 overflow-auto">
            {Object.entries(dropoffAreas)
              .sort(([, a], [, b]) => b.earnings - a.earnings)
              .slice(0, 5)
              .map(([area, data], i) => (
                <li key={i}>
                  {area} — {data.count} ride{data.count > 1 ? 's' : ''}, ₱{data.earnings.toFixed(2)}
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No drop-offs recorded yet.</p>
        )}
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={() => {
            fetchAnalytics();
            fetchWeather();
            fetchPie(filter);
          }}
          disabled={refreshing}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-full shadow-md transition"
        >
          {refreshing ? '🔄 Refreshing...' : '🔁 Refresh'}
        </button>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-lg">
        <h2 className="text-lg font-semibold mb-4">📈 7-Day Ride & Earnings Trend</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[320px] sm:min-w-full">
            <Bar
              data={{
                labels: dailyStats.map(s => s.date), // Use the actual date for the graph labels
                datasets: [
                  {
                    label: 'Rides',
                    data: dailyStats.map(s => s.rides),
                    backgroundColor: '#3b82f6',
                    borderRadius: 6,
                  },
                  {
                    label: 'Earnings (₱)',
                    data: dailyStats.map(s => s.earnings),
                    backgroundColor: '#10b981',
                    borderRadius: 6,
                  },
                ]
              }}
              options={{
                responsive: true,
                animation: {
                  duration: 1200,
                  easing: 'easeOutCubic',
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                  },
                  x: {
                    ticks: { color: '#fff' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                  },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (tooltipItem) => {
                        const label = tooltipItem.dataset.label || 'Unknown';
                        return `${label}: ${tooltipItem.parsed.y}`;
                      },
                    },
                  },
                  legend: {
                    labels: {
                      color: '#fff',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl shadow-lg mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">📊 Ride & Earnings Breakdown</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setIsFilterModalOpen(true);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                customFilter ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Filter
            </button>
            <button
              onClick={() => {
                setFilter('weekly');
                setCustomFilter(false);
                fetchPie('weekly');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === 'weekly' && !customFilter ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => {
                setFilter('monthly');
                setCustomFilter(false);
                fetchPie('monthly');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === 'monthly' && !customFilter ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setFilter('annually');
                setCustomFilter(false);
                fetchPie('annually');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                filter === 'annually' && !customFilter ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Annually
            </button>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Pie
              data={{
                labels: pieStats.map(s => s.label),
                datasets: [
                  {
                    label: 'Earnings (₱)',
                    data: pieStats.map(s => s.earnings),
                    backgroundColor: (() => {
                      if (filter === 'weekly') {
                        return dailyColors.slice(0, pieStats.length);
                      } else if (filter === 'monthly') {
                        return weeklyColors.slice(0, pieStats.length);
                      } else if (filter === 'annually') {
                        return monthlyColors.slice(0, pieStats.length);
                      } else {
                        return ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'].slice(0, pieStats.length);
                      }
                    })(),
                    borderWidth: 2,
                    borderColor: '#1f2937',
                  },
                ]
              }}
              options={{
                responsive: true,
                animation: {
                  duration: 1200,
                  easing: 'easeOutCubic',
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (tooltipItem) => {
                        const label = tooltipItem.label || 'Unknown';
                        const value = tooltipItem.parsed;
                        return `${label}: ₱${value.toFixed(2)}`;
                      },
                    },
                  },
                  legend: {
                    labels: {
                      color: '#fff',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {isFilterModalOpen && (
        <AnalyticsFilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          onApply={(start, end) => {
            setStartDate(start);
            setEndDate(end);
            setCustomFilter(true);
            fetchPie('weekly', start, end);
            setIsFilterModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default Analytics;
