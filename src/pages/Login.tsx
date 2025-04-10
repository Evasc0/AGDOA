// Login.tsx
import { useState } from "react";
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
  collection,
  addDoc,
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
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password || !name || !plate || !vehicle) {
      alert("Fill in all fields");
      return;
    }

    setLoading(true);

    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        // If account doesn't exist, create one
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }

      const uid = userCredential.user.uid;
      const driverRef = doc(db, "drivers", uid);
      const docSnap = await getDoc(driverRef);

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

      if (!docSnap.exists()) {
        await setDoc(driverRef, driverData);
      }

      // Push to queue collection
      await addDoc(collection(db, "queue"), {
        driverId: uid,
        name,
        plate,
        vehicle,
        joinedAt: serverTimestamp(),
      });

      localStorage.setItem("driver", JSON.stringify(driverData));
      setIsAuthenticated(true);
      navigate("/queue");
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">AGDUWA Queue</h1>
        <p className="text-sm text-gray-400">Login or Register as Driver</p>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl w-full max-w-md shadow">
        <h2 className="text-lg font-bold mb-4 text-center">Driver Login</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 bg-gray-700 rounded"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-3 bg-gray-700 rounded"
        />
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

        <button
          onClick={handleLogin}
          className={`w-full p-2 rounded font-semibold transition ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login / Sign Up"}
        </button>
      </div>
    </div>
  );
};

export default Login;
