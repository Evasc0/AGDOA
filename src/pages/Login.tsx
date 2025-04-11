// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import toast, { Toaster } from "react-hot-toast";

const ADMIN_EMAILS = ["admin@agduwa.com"]; // Add your admin emails here

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // Auto-redirect if already logged in
  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) {
      const data = JSON.parse(stored);
      if (ADMIN_EMAILS.includes(data.email)) {
        navigate("/admin");
      } else {
        navigate("/home");
      }
    }
  }, [navigate]);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && (!name || !plate || !vehicle))) {
      toast.error("Please fill all fields.");
      return;
    }

    setLoading(true);

    try {
      let userCredential;

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const driverData = {
          id: uid,
          name,
          plate,
          vehicle,
          email,
          status: "offline",
          age: "",
          contact: "",
          image: null,
          paymentMethod: "GCash",
          paymentNumber: "",
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, "drivers", uid), driverData);
        localStorage.setItem("driver", JSON.stringify(driverData));
        toast.success("Registered successfully!");
        setTimeout(() => navigate("/home"), 1000);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const driverRef = doc(db, "drivers", uid);
        const docSnap = await getDoc(driverRef);

        if (!docSnap.exists()) {
          toast.error("No profile found for this account.");
          return;
        }

        const driverData = { id: uid, ...docSnap.data() };
        localStorage.setItem("driver", JSON.stringify(driverData));

        if (ADMIN_EMAILS.includes(email)) {
          toast.success("Welcome, Admin!");
          setTimeout(() => navigate("/admin"), 1000);
        } else {
          toast.success("Welcome back!");
          setTimeout(() => navigate("/home"), 1000);
        }
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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
      <Toaster position="top-center" />
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">
          {isSignUp ? "Sign Up" : "Login"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 mb-3 bg-gray-700 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="w-full p-2 bg-gray-700 rounded pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-2 text-sm text-gray-400 hover:text-white"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {isSignUp && (
          <>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-2 mb-3 bg-gray-700 rounded"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Plate Number"
              className="w-full p-2 mb-3 bg-gray-700 rounded"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
            <input
              type="text"
              placeholder="Vehicle"
              className="w-full p-2 mb-3 bg-gray-700 rounded"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </>
        )}

        <button
          onClick={handleAuth}
          disabled={loading}
          className={`w-full py-2 px-4 mt-2 rounded font-semibold ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Processing..." : isSignUp ? "Create Account" : "Login"}
        </button>

        <p className="text-sm text-center text-gray-400 mt-4">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-400 hover:underline"
          >
            {isSignUp ? "Login here" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
