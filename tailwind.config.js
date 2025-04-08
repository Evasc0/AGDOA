// tailwind.config.js
module.exports = {
    darkMode: 'class', // ✅ enables class-based dark mode toggling
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
      extend: {
        colors: {
          darknavy: '#0D111C', // 🎯 custom dark mode background
        },
      },
    },
    plugins: [],
  };
  