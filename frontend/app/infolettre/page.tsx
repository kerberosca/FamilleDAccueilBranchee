import type { Metadata } from "next";
import { NewsletterLanding } from "../../components/newsletter-landing";

export const metadata: Metadata = {
  title: "Infolettre FAB — Soyez informé du lancement",
  description: "Famille d’accueil ou futur allié, inscrivez-vous pour recevoir les nouvelles et les détails du lancement de FAB."
};

export default function NewsletterPage() {
  return <NewsletterLanding />;
}
