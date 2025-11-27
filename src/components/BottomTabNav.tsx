import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Clock, BarChart2, List, User } from "lucide-react";

const BottomTabNav = () => {
  const tabs = [
    { to: "/home", icon: Home, label: "Home" },
    { to: "/analytics", icon: BarChart2, label: "Analytics" },
    { to: "/history", icon: List, label: "History" },
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full h-16 z-50 border-t backdrop-blur-sm
    bg-white/80 text-black border-gray-200
    dark:bg-[#0D111C]/95 dark:text-white dark:border-[#1c2230]
    flex justify-around items-center transition-colors duration-300"
    >
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center text-xs font-medium transition-colors duration-200
            ${isActive ? "text-blue-600" : "text-gray-500"}`
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomTabNav;
