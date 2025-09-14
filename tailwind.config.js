/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",      // adjust these paths to your project structure
    // "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'max-ipad-pro': {'max': '990px'},   // your custom breakpoint here
      },
    },
  },
  plugins: [],
}
