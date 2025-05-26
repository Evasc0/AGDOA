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
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { fareMatrix } from '../utils/fareMatrix';

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

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

  // Fetch analytics data, calculates average wait time using stored waitTimeMinutes
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


  useEffect(() => {
    if (user) {
      fetchWeather();
      fetchAnalytics();
    }
  }, [user, fetchWeather, fetchAnalytics]);

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
    </div>
  );
};

export default Analytics;
