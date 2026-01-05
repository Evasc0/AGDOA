

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import toast, { Toaster } from "react-hot-toast";
import { query, orderBy, where } from "firebase/firestore";

// Use the correct admin email here (case-insensitive check)
const ADMIN_EMAILS = ["agduwaadmin@gmail.com"];

interface QueueEntry {
  driverId: string;
  name: string;
  plate: string;
  joinedAt?: any;
  order?: number;
  id?: string;
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showQueue, setShowQueue] = useState(true); // Default to showing queue
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);

  const navigate = useNavigate();

  // Watch the queue in real-time, matching admin page logic
  useEffect(() => {
    const queueQuery = query(collection(db, "queues"), orderBy("joinedAt", "asc"));
    const unsubscribe = onSnapshot(
      queueQuery,
      (snap) => {
        const currentQueue = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as QueueEntry[];
        setQueue(currentQueue);
      },
      (error) => {
        console.error("Error fetching queue:", error);
      }
    );
    return unsubscribe;
  }, []);

  // Fetch drivers for status display
  useEffect(() => {
    const q = query(collection(db, "drivers"), where("verified", "==", true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const allDrivers = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as any[];
      setDrivers(allDrivers);
    });
    return unsubscribe;
  }, []);

  // Removed auto-redirect to prevent navigation throttling; App.tsx handles routing

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      setPasswordError("Password must contain at least 6 characters");
      return false;
    } else {
      setPasswordError("");
      return true;
    }
  };

  const validatePhone = (phoneNumber: string) => {
    const phoneRegex = /^\d{11}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setPhoneError("Phone number must contain 11 digits");
      return false;
    } else {
      setPhoneError("");
      return true;
    }
  };

  // Helper: Determine driver status string for display with new text
  const getDriverStatus = (driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return "Offline";
    if (driver.status === "waiting") return "In Queue";
    if (driver.status === "in ride") return "Left the queue (In Ride)";
    if (driver.status === "offline") return "Offline";
    return "Offline";
  };

  const handleAuth = async () => {
    if (
      !email ||
      !password ||
      (isSignUp && (!name || !plate || !vehicle || !phone))
    ) {
      toast.error("Please fill all fields.");
      return;
    }

    // Validate password and phone before proceeding
    if (!validatePassword(password)) {
      return;
    }
    if (isSignUp && !validatePhone(phone)) {
      return;
    }

    setLoading(true);

    try {
      let userCredential;

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const uid = userCredential.user.uid;

        const isAdmin = ADMIN_EMAILS.some(
          (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
        );

        const driverData = {
          id: uid,
          name,
          plate,
          vehicle,
          email,
          phone, // store phone number
          status: "offline",
          age: "",
          contact: phone, // automatically set contact to phone number
          image: null,
          paymentMethod: "GCash",
          paymentNumber: "",
          createdAt: serverTimestamp(),
          verified: isAdmin, // admins auto verified, others false
        };

        await setDoc(doc(db, "drivers", uid), driverData);

        console.log("✅ Driver document created:", {
          uid,
          name,
          email,
          verified: driverData.verified,
          createdAt: driverData.createdAt
        });

        if (isAdmin) {
          localStorage.setItem("driver", JSON.stringify(driverData));
          toast.success("Registered successfully as Admin!");
          setTimeout(() => navigate("/admin"), 1000);
        } else {
          toast.success("Your account has been created! Please wait for admin approval.");
          toast.success("You can only log in when the admin approves your account.");
          // Do not auto-login unverified users
          // Clear form fields
          setEmail("");
          setPassword("");
          setName("");
          setPlate("");
          setVehicle("");
          setPhone("");
          setIsSignUp(false);
        }
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const isAdmin = ADMIN_EMAILS.some(
          (adminEmail) => adminEmail.toLowerCase() === email.toLowerCase()
        );

        if (isAdmin) {
          // For admin, skip profile check and redirect immediately
            const driverData = {
              id: uid,
              name: "Admin",
              plate: "",
              vehicle: "",
              email,
              phone: "",
              status: "offline",
              age: "",
              contact: phone || "", // set contact to phone number if available
              image: null,
              paymentMethod: "GCash",
              paymentNumber: "",
              createdAt: serverTimestamp(),
              verified: true,
            };
          localStorage.setItem("driver", JSON.stringify(driverData));
          toast.success("Welcome, Admin!");
          setTimeout(() => navigate("/admin"), 1000);
          setLoading(false);
          return;
        }

        const driverRef = doc(db, "drivers", uid);
        const docSnap = await getDoc(driverRef);

        if (!docSnap.exists()) {
          toast.error("No profile found for this account.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        const driverDocData = docSnap.data() as {
          name: string;
          plate: string;
          vehicle: string;
          email: string;
          phone: string;
          status: string;
          age: string;
          contact: string;
          image: string | null;
          paymentMethod: string;
          paymentNumber: string;
          createdAt: any;
          verified: boolean;
        };
        const driverData = { ...driverDocData, id: uid };

        if (!driverData.verified) {
          toast.error(
            "Your account is not verified by admin yet. Please wait for approval."
          );
          await signOut(auth);
          setLoading(false);
          return;
        }

        localStorage.setItem("driver", JSON.stringify(driverData));

        toast.success("Welcome back!");
        setTimeout(() => navigate("/home"), 1000);
      }
    } catch (error: any) {
      console.error(error.code);
      switch (error.code) {
        case "auth/user-not-found":
          toast.error("Account not found.");
          break;
        case "auth/wrong-password":
          toast.error("Incorrect password.");
          break;
        case "auth/email-already-in-use":
          toast.error("Email already in use.");
          break;
        case "auth/invalid-email":
          toast.error("Invalid email.");
          break;
        default:
          toast.error("Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 text-gray-900">
      <Toaster position="top-center" />
      {/* Login button at the top */}
      <div className="flex justify-end p-4">
        <button
          onClick={() => setShowQueue(false)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded font-semibold text-sm sm:text-base"
          type="button"
        >
          Login
        </button>
      </div>
      {showQueue ? (
        <div className="flex flex-col items-center justify-start flex-1 p-2 sm:p-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg w-full max-w-md sm:max-w-lg md:max-w-2xl lg:max-w-4xl border border-gray-200">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center text-gray-900">
              Welcome to Agduwa
            </h1>
            <h2 className="text-lg sm:text-xl font-semibold mb-6 text-center text-gray-700">
              Active Drivers Queue
            </h2>
            {queue.length === 0 ? (
              <p className="text-center text-gray-600 text-base sm:text-lg py-8">No drivers online at the moment.</p>
            ) : (
              <div className="max-h-80 sm:max-h-96 overflow-y-auto">
                <ul className="space-y-3">
                  {queue.map((entry) => {
                    const driver = drivers.find((d) => d.id === entry.driverId);
                    const status = getDriverStatus(entry.driverId);

                    return (
                      <li key={entry.driverId} className="flex justify-between items-center bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center">
                          <span className="font-medium text-gray-900 text-sm sm:text-base">
                            {driver?.name ?? entry.name}
                          </span>
                          <span className="text-gray-600 text-xs sm:text-sm sm:ml-2">
                            ({driver?.plate ?? entry.plate}) - {driver?.vehicle ?? 'N/A'}
                          </span>
                        </div>
                        <span
                          className={`text-sm sm:text-base font-medium px-2 py-1 rounded-full ${
                            status === "In Queue"
                              ? "text-green-700 bg-green-100"
                              : status === "Left the queue (In Ride)"
                              ? "text-yellow-700 bg-yellow-100"
                              : "text-red-700 bg-red-100"
                          }`}
                        >
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md md:max-w-lg border border-gray-200">
            <div className="flex justify-start mb-4">
              <button
                onClick={() => setShowQueue(true)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded font-semibold text-sm sm:text-base"
                type="button"
              >
                ← Back
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-2 text-center text-gray-900">
              {isSignUp ? "Sign Up" : "Login"}
            </h1>

            <input
              type="email"
              placeholder="Email"
              className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900 text-sm sm:text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <div className="relative mb-3">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-2 bg-gray-200 rounded border border-gray-300 pr-10 text-gray-900 text-sm sm:text-base"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(e.target.value);
              }}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {passwordError && (
            <p className="text-red-500 text-xs sm:text-sm mb-3">{passwordError}</p>
          )}

            {isSignUp && (
              <>
                <input
                  type="text"
                  placeholder="Full Name"
                  className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900 text-sm sm:text-base"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
                <input
                  type="text"
                  placeholder="Plate Number"
                  className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900 text-sm sm:text-base"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Vehicle"
                  className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900 text-sm sm:text-base"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                />
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Phone Number (e.g., 09123456789)"
                    className="flex-1 p-2 bg-gray-200 rounded border border-gray-300 text-gray-900 text-sm sm:text-base"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      validatePhone(e.target.value);
                    }}
                    autoComplete="tel"
                  />
                  {phoneError && (
                    <p className="text-red-500 text-xs sm:text-sm mt-1">{phoneError}</p>
                  )}
                </div>
              </>
            )}

            <button
              onClick={handleAuth}
              disabled={loading}
              className={`w-full py-2 px-4 mt-2 rounded font-semibold text-sm sm:text-base ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white`}
              type="button"
            >
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Login"}
            </button>

            <p className="text-xs sm:text-sm text-center text-gray-600 mt-4">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 hover:underline"
                type="button"
              >
                {isSignUp ? "Login here" : "Register"}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
