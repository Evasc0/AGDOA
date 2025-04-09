import { useState } from "react";
import { useNavigate } from "react-router-dom";

type LoginProps = {
  setIsAuthenticated: (auth: boolean) => void;
};

const Login = ({ setIsAuthenticated }: LoginProps) => {
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    if (!name || !plate || !vehicle) {
      alert("Please fill in all fields.");
      return;
    }

    setLoading(true);

    // Create a simple unique driver ID (can be improved later)
    const id = `${plate.trim().toUpperCase()}-${name.trim().toLowerCase().replace(/\s+/g, "_")}`;

    const driverData = {
      id,
      name,
      plate,
      vehicle,
      status: "",
      age: "",
      contact: "",
      image: null,
      paymentMethod: "GCash",
      paymentNumber: "",
    };

    localStorage.setItem("driver", JSON.stringify(driverData));

    setTimeout(() => {
      setIsAuthenticated(true);
      navigate("/home");
    }, 2000);
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AGDUWA Queue</h1>
        <p className="text-sm text-gray-400">Automated Queueing System for Drivers</p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow">
        <h2 className="text-lg font-bold mb-4 text-center">Driver Login</h2>

        <label className="block text-sm font-semibold mb-1">Driver Name</label>
        <input
          type="text"
          className="w-full p-2 rounded bg-gray-700 text-white mb-4"
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />

        <label className="block text-sm font-semibold mb-1">Plate Number</label>
        <input
          type="text"
          className="w-full p-2 rounded bg-gray-700 text-white mb-4"
          placeholder="e.g., ABC-1234"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          disabled={loading}
        />

        <label className="block text-sm font-semibold mb-1">Vehicle Details</label>
        <input
          type="text"
          className="w-full p-2 rounded bg-gray-700 text-white mb-6"
          placeholder="e.g., Toyota FX White"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          disabled={loading}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full p-2 rounded font-semibold transition ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Logging in..." : "Login & Start Queue"}
        </button>

        {loading && (
          <div className="mt-4 flex justify-center">
            <svg
              className="animate-spin h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
