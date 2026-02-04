// src/components/Layout.tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomTabNav from "./BottomTabNav";

const Layout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br text-black transition-colors duration-500 pb-16">
      <header className="sticky top-0 z-40 bg-gradient-to-br from-blue-50 to-indigo-100 px-4 pt-4 pb-2 shadow-sm animate-pulse">
        <div className="text-center py-2 flex items-center justify-center gap-4">
          <img src="/img/logo.png" alt="Logo" className="h-8 w-auto" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">NEXT IN LINE</h1>
        </div>
      </header>

      <main className="p-4">
        <Outlet />
      </main>

      <BottomTabNav />
    </div>
  );
};

export default Layout;
