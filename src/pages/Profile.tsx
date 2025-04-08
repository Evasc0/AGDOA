import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";

const Profile = () => {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("GCash");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const storedDriver = localStorage.getItem("driver");
    if (!storedDriver) {
      navigate("/login");
      return;
    }
    const parsed = JSON.parse(storedDriver);
    setDriver(parsed);
    setStatus(parsed.status || "");
    setAge(parsed.age || "");
    setContact(parsed.contact || "");
    setImage(parsed.image || null);
    setPaymentMethod(parsed.paymentMethod || "GCash");
    setPaymentNumber(parsed.paymentNumber || "");
  }, [navigate]);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      localStorage.removeItem("driver");
      navigate("/login");
    }, 400); // match with animation duration
  };

  const handleSave = () => {
    const updatedDriver = {
      ...driver,
      status,
      age,
      contact,
      image,
      paymentMethod,
      paymentNumber,
    };
    setDriver(updatedDriver);
    localStorage.setItem("driver", JSON.stringify(updatedDriver));
    setEditing(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!driver) return null;

  const profileUrl = `${window.location.origin}/driver/${driver.id || driver.plate}`;

  return (
    <div className="flex justify-center p-4 bg-gray-00 min-h-screen text-white">
      <AnimatePresence>
        {!isLoggingOut && (
          <motion.div
            key="profileCard"
            className="w-full max-w-md bg-gray-800 p-6 rounded-xl shadow-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col items-center mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 mb-2">
                {image ? (
                  <img src={image} alt="Driver" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-400 text-sm flex items-center justify-center h-full">No Image</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="text-xs text-gray-400 mb-2"
              />
            </div>

            <div className="space-y-2">
              <div><strong>Name:</strong> {driver.name}</div>
              <div><strong>Plate:</strong> {driver.plate}</div>
              <div><strong>Vehicle:</strong> {driver.vehicle}</div>

              <div>
                <strong>Status:</strong>{" "}
                {editing ? (
                  <input
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="bg-gray-700 rounded p-1 ml-2 w-full"
                  />
                ) : (
                  status
                )}
              </div>

              <div>
                <strong>Age:</strong>{" "}
                {editing ? (
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="bg-gray-700 rounded p-1 ml-2 w-full"
                  />
                ) : (
                  age
                )}
              </div>

              <div>
                <strong>Contact:</strong>{" "}
                {editing ? (
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="bg-gray-700 rounded p-1 ml-2 w-full"
                  />
                ) : (
                  contact
                )}
              </div>

              <div>
                <strong>Payment Method:</strong>{" "}
                {editing ? (
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="bg-gray-700 rounded p-1 ml-2 w-full"
                  >
                    <option value="GCash">GCash</option>
                    <option value="PayMaya">PayMaya</option>
                  </select>
                ) : (
                  paymentMethod
                )}
              </div>

              <div>
                <strong>{paymentMethod} Number:</strong>{" "}
                {editing ? (
                  <input
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value)}
                    className="bg-gray-700 rounded p-1 ml-2 w-full"
                  />
                ) : (
                  paymentNumber || "N/A"
                )}
              </div>
            </div>

            <div className="text-center mt-6">
              <h2 className="font-bold text-sm mb-2">Your Driver QR Code</h2>
              <div className="bg-white p-4 rounded-lg w-fit mx-auto">
                <QRCodeSVG value={profileUrl} size={150} />
              </div>
              <p className="text-xs mt-2 text-gray-400 break-all">{profileUrl}</p>
            </div>

            <div className="flex justify-between mt-6">
              {editing ? (
                <motion.button
                  onClick={handleSave}
                  whileTap={{ scale: 0.95 }}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm w-full mr-2"
                >
                  Save
                </motion.button>
              ) : (
                <motion.button
                  onClick={() => setEditing(true)}
                  whileTap={{ scale: 0.95 }}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm w-full mr-2"
                >
                  Edit Profile
                </motion.button>
              )}

              <motion.button
                onClick={handleLogout}
                whileTap={{ scale: 0.9 }}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm w-full ml-2"
              >
                Logout
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
