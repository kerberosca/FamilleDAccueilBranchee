import type { Metadata } from "next";
import Script from "next/script";
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

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const metadata: Metadata = {
  title: isDemo ? "Démo familles — FAB" : "FAB — Famille d'accueil branchée",
  description:
    isDemo
      ? "Découvrez le parcours famille de FAB dans un environnement de démonstration avec des profils fictifs."
      : "Là où les familles d'accueil trouvent leur soutien. Trouvez des alliés: gardien compétent, entretien ménage ou tutorat près de chez vous. Une initiative Forméduc.",
  robots: isDemo ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={outfit.variable} data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans">
        {!isDemo ? (
          <Script
            id="hs-script-loader"
            src="//js-na2.hs-scripts.com/246205280.js"
            strategy="afterInteractive"
          />
        ) : null}
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
