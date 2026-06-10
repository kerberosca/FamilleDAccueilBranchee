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
    <Card className="border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">{resource.displayName}</h3>
        <Link
          href={`/resource/${resource.id}`}
          className="text-sm font-medium text-[#9fb9ff] no-underline hover:text-[#c5d6ff]"
        >
          Voir le profil
        </Link>
      </div>
      <p className="text-sm text-slate-300">
        {resource.city ?? "Ville inconnue"} - {resource.region ?? "Region inconnue"}
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Étiquettes : {resource.skillsTags?.length ? resource.skillsTags.join(", ") : "Aucune"}
      </p>
      <p className="mt-2 text-sm text-slate-200">
        Courriel : <span className="text-white">{resource.contactEmail ?? contactPlaceholder}</span>
      </p>
      <p className="text-sm text-slate-200">
        Téléphone : <span className="text-white">{resource.contactPhone ?? contactPlaceholder}</span>
      </p>
    </Card>
  );
}
