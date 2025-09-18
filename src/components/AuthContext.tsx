import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser ] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Remove navigate here to avoid conflicting redirects
  // const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser ) => {
      setUser (firebaseUser );
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    // Removed navigate here to let App.tsx handle redirects
  };

  const signUp = async (email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Create default Firestore driver record
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

    // Removed navigate here to let App.tsx handle redirects
  };

  const logout = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Remove from queue if present
      const queueRef = doc(db, "queues", currentUser.uid);
      try {
        await deleteDoc(queueRef);
      } catch (error) {
        // Ignore if not in queue
      }
      // Set status to offline
      const driverRef = doc(db, "drivers", currentUser.uid);
      await setDoc(driverRef, { status: "offline" }, { merge: true });
    }
    await signOut(auth);
    setUser (null);
    // You can navigate to login here if you want, or handle in App.tsx
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
