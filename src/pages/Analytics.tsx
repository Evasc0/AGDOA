import React, { useEffect, useState } from 'react';
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

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const apiKey = 'cdbb40b30135e8397fe914b98c469d44';

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

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [avgWaitTime, setAvgWaitTime] = useState(0);
  const [ridesToday, setRidesToday] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [pickupAreas, setPickupAreas] = useState<Record<string, number>>({});
  const [dropoffAreas, setDropoffAreas] = useState<Record<string, number>>({});
  const [alertMsg, setAlertMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [dailyStats, setDailyStats] = useState<
    { date: string; earnings: number; rides: number }[]
  >([]);

  const fetchWeather = async () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`
        );
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
              date: date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              }),
              temp: entry.main.temp,
              description: desc,
              icon: emoji,
            };
          });
        setForecast(daily);
      } catch (err) {
        console.error('Weather fetch error:', err);
      }
    });
  };

  const fetchAnalytics = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, 'ride_logs'),
        where('driverId', '==', user.uid),
        where('timestamp', '>=', Timestamp.fromDate(new Date(today.getTime() - 6 * 86400000))) // past 7 days
      );

      const snapshot = await getDocs(q);
      let totalEarnings = 0;
      let totalWaitTime = 0;
      let pickups: Record<string, number> = {};
      let dropoffs: Record<string, number> = {};
      let statMap: Record<string, { earnings: number; rides: number }> = {};

      for (let i = 0; i < 7; i++) {
        const d = new Date(today.getTime() - i * 86400000);
        const label = d.toLocaleDateString(undefined, { weekday: 'short' });
        statMap[label] = { earnings: 0, rides: 0 };
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const ts = data.timestamp?.toDate();
        if (!ts) return;

        const day = ts.toLocaleDateString(undefined, { weekday: 'short' });
        const fare = data.fare || 0;

        totalEarnings += fare;
        totalWaitTime += data.waitTimeMinutes || 0;

        statMap[day] = {
          earnings: (statMap[day]?.earnings || 0) + fare,
          rides: (statMap[day]?.rides || 0) + 1,
        };

        if (data.pickupLocation?.name) {
          pickups[data.pickupLocation.name] = (pickups[data.pickupLocation.name] || 0) + 1;
        }
        if (data.dropoffLocation?.name) {
          dropoffs[data.dropoffLocation.name] = (dropoffs[data.dropoffLocation.name] || 0) + 1;
        }
      });

      setRidesToday(snapshot.size);
      setEarnings(totalEarnings);
      setAvgWaitTime(snapshot.size ? Math.round(totalWaitTime / snapshot.size) : 0);
      setPickupAreas(pickups);
      setDropoffAreas(dropoffs);

      const sortedStats = Object.entries(statMap)
        .reverse()
        .map(([date, values]) => ({ date, ...values }));

      setDailyStats(sortedStats);
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchWeather();
    fetchAnalytics();
  }, [user]);

  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-semibold mb-4">📊 Analytics Dashboard</h1>

      {alertMsg && <div className="bg-yellow-600 p-3 rounded-lg mb-4">{alertMsg}</div>}

      {/* Weather Forecast */}
      {forecast.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 mb-6">
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">🕒 Avg Wait Time: {avgWaitTime} mins</div>
        <div className="bg-gray-800 p-4 rounded-lg">🚖 Rides Today: {ridesToday}</div>
        <div className="bg-gray-800 p-4 rounded-lg">🤑 Total Earnings: ₱{earnings.toFixed(2)}</div>
        <div className="bg-gray-800 p-4 rounded-lg col-span-1 md:col-span-1">
          📍 Top Pickup Areas:
          <ul className="text-sm list-disc ml-4">
            {Object.entries(pickupAreas).map(([area, count], i) => (
              <li key={i}>{area} — {count}</li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg col-span-1 md:col-span-1">
          🏁 Top Drop-offs:
          <ul className="text-sm list-disc ml-4">
            {Object.entries(dropoffAreas).map(([area, count], i) => (
              <li key={i}>{area} — {count}</li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-center">
          <button
            onClick={() => {
              fetchAnalytics();
              fetchWeather();
            }}
            className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow"
          >
            {refreshing ? '🔄 Refreshing...' : '🔁 Refresh'}
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="bg-gray-900 p-4 rounded-xl mt-6">
        📈 <h2 className="text-lg font-semibold mb-2">7-Day Ride & Earnings Trend</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[320px] sm:min-w-full">
            <Bar
              data={{
                labels: dailyStats.map((s) => s.date),
                datasets: [
                  {
                    label: 'Rides',
                    data: dailyStats.map((s) => s.rides),
                    backgroundColor: '#3b82f6',
                    borderRadius: 8,
                  },
                  {
                    label: 'Earnings (₱)',
                    data: dailyStats.map((s) => s.earnings),
                    backgroundColor: '#10b981',
                    borderRadius: 8,
                  },
                ],
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
                      label: function (context) {
                        const label = context.dataset.label || '';
                        return `${label}: ${context.parsed.y}`;
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
