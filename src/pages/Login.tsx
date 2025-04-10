// src/pages/Login.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
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

type LoginProps = {
  setIsAuthenticated: (auth: boolean) => void;
};

const Login = ({ setIsAuthenticated }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (successMsg) {
      const timeout = setTimeout(() => setSuccessMsg(""), 4000);
      return () => clearTimeout(timeout);
    }
  }, [successMsg]);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && (!name || !plate || !vehicle))) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

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
          status: "online",
          age: "",
          contact: "",
          image: null,
          paymentMethod: "GCash",
          paymentNumber: "",
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, "drivers", uid), driverData);
        localStorage.setItem("driver", JSON.stringify(driverData));
        setIsAuthenticated(true);
        setSuccessMsg("Account created successfully!");

        setTimeout(() => navigate("/"), 1200);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const driverRef = doc(db, "drivers", uid);
        const docSnap = await getDoc(driverRef);

        if (!docSnap.exists()) {
          setErrorMsg("Account exists but no profile was found.");
          return;
        }

        const driverData = { id: uid, ...docSnap.data() };
        localStorage.setItem("driver", JSON.stringify(driverData));
        setIsAuthenticated(true);
        setSuccessMsg("Login successful!");

        setTimeout(() => navigate("/"), 1200);
      }
    } catch (err: any) {
      console.error("Auth error:", err.code);
      switch (err.code) {
        case "auth/user-not-found":
          setErrorMsg("No account found with this email.");
          break;
        case "auth/wrong-password":
          setErrorMsg("Incorrect password.");
          break;
        case "auth/email-already-in-use":
          setErrorMsg("Email already in use.");
          break;
        case "auth/invalid-email":
          setErrorMsg("Invalid email format.");
          break;
        default:
          setErrorMsg("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white px-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AGDUWA Queue</h1>
        <p className="text-sm text-gray-400">
          {isSignUp ? "Register as a New Driver" : "Login to Your Account"}
        </p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow relative animate-fade-in">
        <h2 className="text-lg font-bold mb-4 text-center">
          {isSignUp ? "Driver Sign Up" : "Driver Login"}
        </h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 bg-gray-700 rounded"
        />

        <div className="relative mb-3">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded pr-10"
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
              placeholder="Driver Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 mb-3 bg-gray-700 rounded"
            />
            <input
              type="text"
              placeholder="Plate Number"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              className="w-full p-2 mb-3 bg-gray-700 rounded"
            />
            <input
              type="text"
              placeholder="Vehicle Info"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full p-2 mb-6 bg-gray-700 rounded"
            />
          </>
        )}

        {errorMsg && (
          <div className="bg-red-600 text-white text-sm px-4 py-2 rounded mb-3 animate-fade-in">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-600 text-white text-sm px-4 py-2 rounded mb-3 animate-fade-in">
            {successMsg}
          </div>
        )}

        <button
          onClick={handleAuth}
          className={`w-full flex justify-center items-center gap-2 p-2 rounded font-semibold transition duration-300 ${
            loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          disabled={loading}
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loading ? "Processing..." : isSignUp ? "Sign Up" : "Login"}
        </button>

        <p className="text-center text-sm mt-4 text-gray-400">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-400 hover:underline"
          >
            {isSignUp ? "Login" : "Sign Up"}
          </button>
        </p>
      </div>

      <style>{`
        .animate-fade-in {
          animation: fadeIn 0.4s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
