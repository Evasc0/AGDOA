export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;
    try {
      const res = await fetch(
        `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${apiKey}&language=en&pretty=1`
      );
      const data = await res.json();
      const result = data?.results?.[0];
  
      if (!result) return "Unknown Location";
  
      // Prefer a village name if available
      return (
        result.components.village ||
        result.components.town ||
        result.components.city ||
        result.components.county ||
        result.formatted
      );
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      return "Unknown Location";
    }
  };
  