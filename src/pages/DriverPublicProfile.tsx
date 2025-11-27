import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase"; // Ensure this imports your Firestore instance
import { QRCodeSVG } from "qrcode.react";

interface Driver {
  name: string;
  plate: string;
  vehicle: string;
  status: string;
  age: number;
  contact: string;
  paymentMethod: string;
  paymentNumber: string;
  image?: string; // Optional
}

const DriverProfilePublic = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDriver = async () => {
      if (!driverId) {
        setLoading(false);
        return; // Exit if driverId is undefined
      }

      try {
        const docRef = doc(db, "publicProfiles", driverId); // Fetch from publicProfiles
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setDriver(snapshot.data() as Driver); // Cast to Driver type
        } else {
          setDriver(null);
        }
      } catch (error) {
        console.error("Error fetching driver:", error);
        setDriver(null);
      }
      setLoading(false);
    };

    fetchDriver();
  }, [driverId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white p-4">
        <p>Loading driver profile...</p>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 text-gray-900 p-4">
        <p className="mb-4">Driver profile not found.</p>
        <Link to="/" className="text-blue-500 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  const profileUrl = `${window.location.origin}/driver/${driverId}`;

  return (
    <div className="flex justify-center p-4 bg-gray-100 min-h-screen text-gray-900">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-md">
        {/* Profile Image */}
        <div className="flex justify-center mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-900">
            {driver.image ? (
              <img
                src={driver.image}
                alt={`${driver.name} profile`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-gray-400 text-sm flex items-center justify-center h-full">
                No Image
              </div>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <strong>Name:</strong> {driver.name || "N/A"}
          </div>
          <div>
            <strong>Plate:</strong> {driver.plate || "N/A"}
          </div>
          <div>
            <strong>Vehicle:</strong> {driver.vehicle || "N/A"}
          </div>
          <div>
            <strong>Status:</strong>{" "}
            <span
              className={`px-2 py-1 rounded text-sm font-semibold ${
                driver.status === "Online"
                  ? "bg-green-600 text-green-100"
                  : "bg-red-600 text-red-100"
              }`}
            >
              {driver.status || "Offline"}
            </span>
          </div>
          <div>
            <strong>Age:</strong> {driver.age || "N/A"}
          </div>
          <div>
            <strong>Contact:</strong> {driver.contact || "N/A"}
          </div>
          <div>
            <strong>Payment Method:</strong> {driver.paymentMethod || "N/A"}
          </div>
          <div>
            <strong>{driver.paymentMethod || "Payment"} Number:</strong>{" "}
            {driver.paymentNumber || "N/A"}
          </div>
        </div>

        {/* QR Code */}
        <div className="text-center mt-8">
          <h2 className="font-bold text-sm mb-2">Driver QR Code</h2>
          <div className="bg-white p-4 rounded-lg w-fit mx-auto">
            <QRCodeSVG value={profileUrl} size={150} />
          </div>
          <p className="text-xs mt-2 text-gray-400 break-all">{profileUrl}</p>
        </div>
      </div>
    </div>
  );
};

export default DriverProfilePublic;