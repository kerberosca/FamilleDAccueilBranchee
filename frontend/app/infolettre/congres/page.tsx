import type { Metadata } from "next";
import { NewsletterLanding } from "../../../components/newsletter-landing";

export const metadata: Metadata = {
  title: "Infolettre FAB — Congrès",
  description: "Inscrivez-vous à l’infolettre de FAB pendant le congrès pour suivre son lancement.",
  robots: { index: false, follow: false }
};

export default function CongressNewsletterPage() {
  return <NewsletterLanding congress />;
}
