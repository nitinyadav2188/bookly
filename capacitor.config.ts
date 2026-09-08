import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.bookly.reader",
  appName: "Bookly",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
  plugins: {
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#fdfceb",
    },
  },
};

export default config;
