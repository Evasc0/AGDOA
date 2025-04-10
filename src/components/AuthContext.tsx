import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const navigate = useNavigate();

  const handleAuth = async () => {
    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      let userCredential;

      if (isSignUp) {
        // Sign up new user
        userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Create Firestore driver document
        const driverRef = doc(db, "drivers", userCredential.user.uid);
        await setDoc(driverRef, {
          displayName: email.split("@")[0] || "New Driver",
          email,
          plateNumber: "",
          vehicle: "",
          status: "Offline",
          age: null,
          contact: "",
          paymentMethod: "",
          paymentNumber: "",
          profileImageUrl: "",
          createdAt: serverTimestamp(),
          lastOnline: serverTimestamp(),
        });
      } else {
        // Login existing user
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      //test
      navigate("/home");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AGDUWA Queue</h1>
        <p className="text-sm text-gray-400">Automated Queueing System for Drivers</p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow">
        <h2 className="text-lg font-bold mb-4 text-center">
          {isSignUp ? "Create Account" : "Driver Login"}
        </h2>

        <label className="block text-sm font-semibold mb-1">Email Address</label>
        <input
          type="email"
          className="w-full p-2 rounded bg-gray-700 text-white mb-4"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />

        <label className="block text-sm font-semibold mb-1">Password</label>
        <input
          type="password"
          className="w-full p-2 rounded bg-gray-700 text-white mb-6"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />

        <button
          onClick={handleAuth}
          disabled={loading}
          className={`w-full p-2 rounded font-semibold transition ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading
            ? isSignUp
              ? "Creating account..."
              : "Logging in..."
            : isSignUp
            ? "Sign Up"
            : "Login"}
        </button>

        <p className="mt-4 text-sm text-center text-gray-300">
          {isSignUp ? "Already have an account?" : "Don’t have an account?"}{" "}
          <span
            className="text-blue-400 cursor-pointer underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Login here" : "Sign up"}
          </span>
        </p>

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
