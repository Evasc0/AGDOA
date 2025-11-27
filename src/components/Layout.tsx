// src/components/Layout.tsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomTabNav from "./BottomTabNav";

const Layout = () => {
  return (
    <div className="min-h-screen bg-white text-black transition-colors duration-500 pb-16">
      <header className="sticky top-0 z-40 bg-white px-4 pt-4 pb-2 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-bold">AGDUWA Drivers</h1>
      </header>

      <main className="p-4">
        <Outlet />
      </main>

      <BottomTabNav />
    </div>
  );
};

export default Layout;
