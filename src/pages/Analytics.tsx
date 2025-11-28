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
  ArcElement,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import { fareMatrix } from '../utils/fareMatrix';
import AnalyticsFilterModal from '../components/AnalyticsFilterModal';

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler, zoomPlugin);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center animate-fade-in">📊 Analytics Dashboard</h1>

        {alertMsg && (
          <div className="bg-yellow-200 p-4 rounded-lg mb-6 shadow-lg animate-slide-down">
            {alertMsg}
          </div>
        )}

        {forecast.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mb-8 animate-fade-in-up">
            {forecast.map((day, i) => (
              <div key={i} className="bg-white p-4 rounded-xl flex flex-col items-center shadow-lg hover:shadow-xl transition-shadow duration-300">
                <p className="text-sm font-medium text-gray-700">{day.date}</p>
                <div className="text-4xl my-2">{day.icon}</div>
                <p className="font-bold text-lg">{day.temp.toFixed(1)}°C</p>
                <p className="text-xs capitalize text-center text-gray-600">{day.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center animate-slide-up">
            <div className="text-4xl mb-2">🕒</div>
            <p className="font-semibold text-xl mb-1">Avg Wait Time</p>
            <p className="text-3xl font-bold text-blue-600">{avgWaitTime} mins</p>
            <p className="text-xs text-gray-500 mt-2">(Based on queued wait times recorded)</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="text-4xl mb-2">🚖</div>
            <p className="font-semibold text-xl mb-1">Rides Today</p>
            <p className="text-3xl font-bold text-green-600">{ridesToday}</p>
            <p className="text-xs text-gray-500 mt-2">as of {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="text-4xl mb-2">🤑</div>
            <p className="font-semibold text-xl mb-1">Total Earnings</p>
            <p className="text-3xl font-bold text-yellow-600">₱{earnings.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">as of {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg animate-fade-in-left">
            <h2 className="font-semibold text-xl mb-4">🏁 Top Drop-offs</h2>
            {Object.entries(dropoffAreas).length ? (
              <ul className="space-y-2">
                {Object.entries(dropoffAreas)
                  .sort(([, a], [, b]) => b.earnings - a.earnings)
                  .slice(0, 5)
                  .map(([area, data], i) => (
                    <li key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="font-medium">{area}</span>
                      <span className="text-sm text-gray-600">{data.count} ride{data.count > 1 ? 's' : ''}, ₱{data.earnings.toFixed(2)}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-gray-500">No drop-offs recorded yet.</p>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg flex items-center justify-center animate-fade-in-right">
            <button
              onClick={() => {
                fetchAnalytics();
                fetchWeather();
                fetchPie(filter);
              }}
              disabled={refreshing}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 text-white px-8 py-3 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {refreshing ? '🔄 Refreshing...' : '🔁 Refresh Data'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 animate-fade-in-up">
          <h2 className="text-xl font-semibold mb-6">📈 7-Day Ride & Earnings Trend</h2>
          <div className="h-80">
            <Bar
              data={{
                labels: dailyStats.map(s => s.date),
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
                maintainAspectRatio: false,
                animation: {
                  duration: 1500,
                  easing: 'easeOutCubic',
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#374151' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                  },
                  x: {
                    ticks: { color: '#374151' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
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
                      color: '#374151',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h2 className="text-xl font-semibold mb-4 sm:mb-0">📊 Ride & Earnings Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setIsFilterModalOpen(true);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  customFilter ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  filter === 'weekly' && !customFilter ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  filter === 'monthly' && !customFilter ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  filter === 'annually' && !customFilter ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Annually
              </button>
            </div>
          </div>
          <div className="h-96">
            <Line
              data={{
                labels: pieStats.map(s => s.label),
                datasets: [
                  {
                    label: 'Earnings (₱)',
                    data: pieStats.map(s => s.earnings),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#10b981',
                  },
                  {
                    label: 'Rides',
                    data: pieStats.map(s => s.rides),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#3b82f6',
                  },
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                  duration: 1500,
                  easing: 'easeOutCubic',
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { color: '#374151' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                  },
                  x: {
                    ticks: { color: '#374151' },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                  },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      label: (tooltipItem) => {
                        const label = tooltipItem.dataset.label || 'Unknown';
                        const value = tooltipItem.parsed.y;
                        return `${label}: ${value}`;
                      },
                    },
                  },
                  legend: {
                    labels: {
                      color: '#374151',
                    },
                  },
                  zoom: {
                    zoom: {
                      wheel: {
                        enabled: true,
                      },
                      pinch: {
                        enabled: false,
                      },
                      mode: 'x',
                    },
                    pan: {
                      enabled: true,
                      mode: 'x',
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {isFilterModalOpen && (
          <AnalyticsFilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            onApply={(start: Date | null, end: Date | null) => {
              setStartDate(start);
              setEndDate(end);
              setCustomFilter(true);
              fetchPie('weekly', start, end);
              setIsFilterModalOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Analytics;
