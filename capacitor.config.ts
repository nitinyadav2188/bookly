import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.bookly.reader",
  appName: "Página",
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
