import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import { DevModeProvider } from "../lib/dev-mode";
import { MaintenanceProvider } from "../lib/maintenance-context";
import { AppFrame } from "../components/app-frame";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FAB — Famille d'accueil branchée",
  description: "Famille d'accueil branchée — plateforme",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body className="min-h-screen font-sans">
        <AuthProvider>
          <MaintenanceProvider>
            <DevModeProvider>
              <AppFrame>{children}</AppFrame>
            </DevModeProvider>
          </MaintenanceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
