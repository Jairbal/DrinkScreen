/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./admin.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff8ef",
          100: "#feeccf",
          200: "#fbd59d",
          300: "#f6b564",
          400: "#ef8d38",
          500: "#e26e1f",
          600: "#c35216",
          700: "#9d3d15",
          800: "#7f3318",
          900: "#682d18",
          950: "#391408"
        }
      },
      boxShadow: {
        soft: "0 20px 80px rgba(15, 23, 42, 0.18)"
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Arial Narrow"', "sans-serif"],
        sans: ['"Segoe UI"', "system-ui", "sans-serif"]
      },
      backgroundImage: {
        "admin-grid":
          "radial-gradient(circle at top left, rgba(226,110,31,0.18), transparent 25%), radial-gradient(circle at right, rgba(251,213,157,0.3), transparent 28%), linear-gradient(180deg, #fff9ef 0%, #f8efe4 100%)",
        "screen-stage":
          "radial-gradient(circle at top, rgba(122,231,199,0.14), transparent 30%), linear-gradient(180deg, #0b1023 0%, #04060f 100%)"
      }
    }
  },
  plugins: []
};
