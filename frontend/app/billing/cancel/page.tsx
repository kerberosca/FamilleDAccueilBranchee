import Link from "next/link";
import { Card } from "../../../components/ui/card";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Card className="space-y-4 border-[#4e4771] bg-[#171134]/90 text-center">
        <h1 className="text-2xl font-semibold text-white">Paiement annulé</h1>
        <p className="text-sm text-slate-300">
          Aucun nouvel abonnement n'a été activé. Vous pouvez reprendre le paiement plus tard depuis votre profil.
        </p>
        <Link className="inline-flex rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white" href="/me">
          Retour à mon profil
        </Link>
      </Card>
    </main>
  );
}
