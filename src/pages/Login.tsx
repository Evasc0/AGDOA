

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
} from "firebase/firestore";
import { auth, db } from "../firebase";
import toast, { Toaster } from "react-hot-toast";

// Use the correct admin email here (case-insensitive check)
const ADMIN_EMAILS = ["agduwaadmin@gmail.com"];

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

  const navigate = useNavigate();

  // Auto-redirect if already logged in and verified
  useEffect(() => {
    const stored = localStorage.getItem("driver");
    if (stored) {
      const data = JSON.parse(stored);
      if (
        data.email &&
        ADMIN_EMAILS.some(
          (adminEmail) => adminEmail.toLowerCase() === data.email.toLowerCase()
        )
      ) {
        navigate("/admin");
      } else {
        navigate("/home");
      }
    }
  }, [navigate]);

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
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-900 p-4">
      <Toaster position="top-center" />
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">
          {isSignUp ? "Sign Up" : "Login"}
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <div className="relative mb-3">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="w-full p-2 bg-gray-200 rounded border border-gray-300 pr-10 text-gray-900"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            validatePassword(e.target.value);
          }}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        <button
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2 top-2 text-sm text-gray-600 hover:text-gray-900"
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? "Hide" : "Show"}
        </button>
      </div>
      {passwordError && (
        <p className="text-red-500 text-sm mb-3">{passwordError}</p>
      )}

        {isSignUp && (
          <>
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
            <input
              type="text"
              placeholder="Plate Number"
              className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
            <input
              type="text"
              placeholder="Vehicle"
              className="w-full p-2 mb-3 bg-gray-200 rounded border border-gray-300 text-gray-900"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
            <div className="mb-3">
              <input
                type="text"
                placeholder="Phone Number (e.g., 09123456789)"
                className="flex-1 p-2 bg-gray-200 rounded border border-gray-300 text-gray-900"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  validatePhone(e.target.value);
                }}
                autoComplete="tel"
              />
              {phoneError && (
                <p className="text-red-500 text-sm mt-1">{phoneError}</p>
              )}
            </div>
          </>
        )}

        <button
          onClick={handleAuth}
          disabled={loading}
          className={`w-full py-2 px-4 mt-2 rounded font-semibold ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
          type="button"
        >
          {loading ? "Processing..." : isSignUp ? "Create Account" : "Login"}
        </button>

        <p className="text-sm text-center text-gray-600 mt-4">
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
  );
};

export default Login;
