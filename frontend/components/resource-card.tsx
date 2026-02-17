import Link from "next/link";
import { Card } from "./ui/card";

type ResourceResult = {
  id: string;
  displayName: string;
  city?: string;
  region?: string;
  skillsTags?: string[];
  contactEmail?: string;
  contactPhone?: string;
};

/** Si true, l'utilisateur a l'abonnement premium : les champs vides = "Non renseigné". Sinon = "Masque (premium requis)". */
export function ResourceCard({
  resource,
  isPremiumUser = false
}: {
  resource: ResourceResult;
  isPremiumUser?: boolean;
}) {
  const contactPlaceholder = isPremiumUser ? "Non renseigne" : "Masque (premium requis)";
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold">{resource.displayName}</h3>
        <Link
          href={`/resource/${resource.id}`}
          className="text-sm text-cyan-400 hover:underline"
        >
          Voir le profil
        </Link>
      </div>
      <p className="text-sm text-slate-300">
        {resource.city ?? "Ville inconnue"} - {resource.region ?? "Region inconnue"}
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Tags: {resource.skillsTags?.length ? resource.skillsTags.join(", ") : "Aucun"}
      </p>
      <p className="mt-2 text-sm">
        Email: <span className="text-slate-200">{resource.contactEmail ?? contactPlaceholder}</span>
      </p>
      <p className="text-sm">
        Tel: <span className="text-slate-200">{resource.contactPhone ?? contactPlaceholder}</span>
      </p>
    </Card>
  );
}
