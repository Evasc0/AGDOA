import React from "react";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

interface Driver {
  id: string;
  name: string;
  plate: string;
  vehicle: string;
  image?: string;
  status?: string;
  age?: string;
  contact?: string;
}

const DriverPublicProfile = () => {
  const { id } = useParams();
  const [driver, setDriver] = useState<Driver | null>(null);

  useEffect(() => {
    // Later replace this with backend fetch
    const drivers = JSON.parse(localStorage.getItem("drivers") || "[]");
    const found = drivers.find((d: Driver) => d.id === id);
    setDriver(found || null);
  }, [id]);

  if (!driver) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <p>Driver not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center p-4">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-md text-center">
        {driver.image && (
          <img
            src={driver.image}
            alt="Driver"
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
          />
        )}
        <h2 className="text-xl font-bold mb-1">{driver.name}</h2>
        <p className="text-gray-400 text-sm">{driver.vehicle} - {driver.plate}</p>

        <div className="mt-6 text-left space-y-2">
          {driver.status && <p><strong>Status:</strong> {driver.status}</p>}
          {driver.age && <p><strong>Age:</strong> {driver.age}</p>}
          {driver.contact && <p><strong>Contact:</strong> {driver.contact}</p>}
        </div>
      </div>
    </div>
  );
};

export default DriverPublicProfile;
