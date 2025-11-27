import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import { Toaster } from "react-hot-toast"; // ✅ add this
import './index.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} /> {/* ✅ toast renderer */}
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
