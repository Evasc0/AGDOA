// src/components/Layout.tsx
import React from "react";
import { Outlet } from "react-router-dom";
import BottomTabNav from "./BottomTabNav";
import ThemeToggle from "./ThemeToggle";

const Layout = () => {
  return (
    <div className="min-h-screen bg-white text-black dark:bg-gray-900 dark:text-white transition-colors duration-500 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 px-4 pt-4 pb-2 flex justify-between items-center shadow-sm">
        <h1 className="text-lg font-bold">AGDUWA Drivers</h1>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <BottomTabNav />
    </div>
  );
};

export default Layout;
