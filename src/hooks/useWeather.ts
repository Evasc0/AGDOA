import { useEffect, useState } from 'react';

const API_KEY = 'cdbb40b30135e8397fe914b98c469d44';

export function useWeather() {
  const [weather, setWeather] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
        );
        const data = await res.json();
        if (data.weather && data.main) {
          setWeather(`${data.weather[0].description}, ${data.main.temp}°C`);
        }
      } catch (err) {
        console.error('Failed to fetch weather:', err);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetchWeather(latitude, longitude);
        },
        (err) => console.warn('Geolocation blocked:', err)
      );
    }
  }, []);

  return weather;
}
