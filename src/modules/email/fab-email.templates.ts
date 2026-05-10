type FabEmailAction = {
  label: string;
  href: string;
};

type FabEmailOptions = {
  title: string;
  eyebrow?: string;
  intro: string;
  sections?: { title: string; body: string }[];
  action?: FabEmailAction;
  note?: string;
  frontendUrl: string;
};

const LOGO_DATA_URI =
  "data:image/png;base64,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";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(frontendUrl: string, path: string): string {
  return `${frontendUrl.replace(/\/$/, "")}${path}`;
}

export function buildFabEmail(options: FabEmailOptions): string {
  const sections = options.sections ?? [];
  const safeTitle = escapeHtml(options.title);
  const safeIntro = escapeHtml(options.intro);
  const safeEyebrow = escapeHtml(options.eyebrow ?? "Famille d'accueil branchée");
  const safeNote = options.note ? escapeHtml(options.note) : null;

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#100c26;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#100c26;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;overflow:hidden;border-radius:24px;background:#ffffff;color:#211a3e;border:1px solid #e4def4;">
            <tr>
              <td style="background:#080817;padding:24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${LOGO_DATA_URI}" width="56" height="56" alt="FAB" style="display:block;border:0;max-width:56px;height:auto;">
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <div style="font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#ffffff;">FAB</div>
                      <div style="font-size:13px;color:#9eeaf9;">Famille d'accueil branchée</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 28px 28px;">
                <div style="display:inline-block;border:1px solid #d9d2ec;border-radius:999px;padding:7px 13px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5a5275;">
                  ${safeEyebrow}
                </div>
                <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.15;color:#211a3e;">${safeTitle}</h1>
                <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#4d4669;">${safeIntro}</p>
                ${
                  sections.length > 0
                    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:separate;border-spacing:0 10px;">
                        ${sections
                          .map(
                            (section) => `
                              <tr>
                                <td style="border:1px solid #e7e1f2;border-radius:16px;background:#f8f6fc;padding:16px 18px;">
                                  <div style="font-size:15px;font-weight:800;color:#2a2247;margin-bottom:5px;">${escapeHtml(section.title)}</div>
                                  <div style="font-size:14px;line-height:1.55;color:#5a5275;">${escapeHtml(section.body)}</div>
                                </td>
                              </tr>`
                          )
                          .join("")}
                      </table>`
                    : ""
                }
                ${
                  options.action
                    ? `<p style="margin:26px 0 18px;">
                        <a href="${options.action.href}" style="display:inline-block;border-radius:12px;background:#3368bd;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 20px;">
                          ${escapeHtml(options.action.label)}
                        </a>
                      </p>`
                    : ""
                }
                ${
                  safeNote
                    ? `<p style="margin:18px 0 0;border-left:4px solid #21c7df;background:#eefcff;padding:13px 15px;border-radius:10px;font-size:14px;line-height:1.55;color:#31515d;">${safeNote}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="background:#f4f0fb;padding:18px 28px;font-size:12px;line-height:1.55;color:#71688b;">
                Vous recevez ce courriel parce que vous avez un compte sur FAB. Pour toute question, répondez à ce message ou contactez l'équipe.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export function buildAllyWelcomeEmail(params: {
  displayName: string;
  allyTypeLabel: string;
  frontendUrl: string;
}): string {
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: "Bienvenue parmi les alliés FAB",
    title: `Bienvenue ${params.displayName}`,
    intro:
      "Votre candidature allié a bien été reçue. Merci d'offrir votre présence et vos services aux familles d'accueil.",
    sections: [
      {
        title: "Prochaine étape",
        body: "Votre profil est maintenant en attente de vérification par l'équipe FAB avant publication."
      },
      {
        title: "Type d'allié",
        body: params.allyTypeLabel
      },
      {
        title: "À préparer",
        body: "Gardez vos références et documents de vérification à portée de main. Nous pourrons vous les demander pendant la validation."
      }
    ],
    action: { label: "Voir mon profil", href: absoluteUrl(params.frontendUrl, "/me") },
    note: "Nous vous aviserons lorsque votre profil sera vérifié ou si des informations supplémentaires sont nécessaires."
  });
}

export function buildAllyProfileUpdatedEmail(params: {
  displayName: string;
  frontendUrl: string;
}): string {
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: "Profil allié mis à jour",
    title: "Vos modifications ont été enregistrées",
    intro: `Bonjour ${params.displayName}, les changements apportés à votre profil allié ont bien été sauvegardés.`,
    sections: [
      {
        title: "Validation",
        body: "Si vos modifications touchent votre offre de service ou vos informations de vérification, l'équipe FAB pourra les réviser."
      },
      {
        title: "Visibilité",
        body: "Les informations publiées restent soumises aux statuts de vérification et de publication de votre profil."
      }
    ],
    action: { label: "Revoir mon profil", href: absoluteUrl(params.frontendUrl, "/me") },
    note: "Si vous n'êtes pas à l'origine de cette modification, contactez l'équipe FAB rapidement."
  });
}

export function buildPasswordResetEmail(params: { resetUrl: string; frontendUrl: string }): string {
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: "Sécurité du compte",
    title: "Réinitialisation de votre mot de passe",
    intro: "Une demande de réinitialisation de mot de passe a été faite pour votre compte FAB.",
    sections: [
      {
        title: "Durée de validité",
        body: "Ce lien est valide pendant 1 heure."
      },
      {
        title: "Vous n'avez rien demandé ?",
        body: "Vous pouvez ignorer ce courriel. Votre mot de passe actuel restera inchangé."
      }
    ],
    action: { label: "Réinitialiser mon mot de passe", href: params.resetUrl }
  });
}

export function buildAllyAdminStatusEmail(params: {
  displayName: string;
  verificationStatus?: string | null;
  publishStatus?: string | null;
  onboardingState?: string | null;
  frontendUrl: string;
}): string {
  const approved = params.verificationStatus === "VERIFIED" && params.publishStatus === "PUBLISHED";
  const rejected = params.verificationStatus === "REJECTED";
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: approved ? "Profil allié approuvé" : rejected ? "Candidature allié révisée" : "Profil allié mis à jour",
    title: approved
      ? "Votre profil allié est approuvé"
      : rejected
        ? "Votre candidature ne peut pas être approuvée pour le moment"
        : "Votre profil allié a été mis à jour par l'équipe FAB",
    intro: approved
      ? `Bonjour ${params.displayName}, bonne nouvelle : votre profil allié est approuvé et peut maintenant être visible aux familles selon son statut de publication.`
      : rejected
        ? `Bonjour ${params.displayName}, après révision, votre candidature allié ne peut pas être approuvée pour le moment.`
        : `Bonjour ${params.displayName}, l'équipe FAB a mis à jour les statuts administratifs de votre profil allié.`,
    sections: [
      {
        title: "Statut de vérification",
        body: params.verificationStatus ?? "Inchangé"
      },
      {
        title: "Statut de publication",
        body: params.publishStatus ?? "Inchangé"
      },
      {
        title: "État du parcours",
        body: params.onboardingState ?? "Inchangé"
      }
    ],
    action: { label: "Voir mon profil", href: absoluteUrl(params.frontendUrl, "/me") },
    note: rejected
      ? "Pour toute question ou correction à apporter, contactez l'équipe FAB."
      : "Ces statuts contrôlent la visibilité de votre profil et les prochaines étapes de validation."
  });
}

export function buildTeamNewAllyEmail(params: {
  displayName: string;
  email: string;
  allyTypeLabel: string;
  city: string;
  frontendUrl: string;
}): string {
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: "Nouvelle candidature allié",
    title: "Un nouvel allié attend une approbation",
    intro: "Une nouvelle candidature allié vient d'être soumise sur FAB.",
    sections: [
      { title: "Nom", body: params.displayName },
      { title: "Courriel", body: params.email },
      { title: "Type d'allié", body: params.allyTypeLabel },
      { title: "Ville", body: params.city }
    ],
    action: { label: "Ouvrir l'administration", href: absoluteUrl(params.frontendUrl, "/admin") },
    note: "Vérifiez la candidature, les déclarations et les documents requis avant publication."
  });
}

export function buildTeamNewFamilyEmail(params: {
  displayName: string;
  email: string;
  city: string;
  frontendUrl: string;
}): string {
  return buildFabEmail({
    frontendUrl: params.frontendUrl,
    eyebrow: "Nouvelle famille inscrite",
    title: "Une nouvelle famille d'accueil s'est inscrite",
    intro: "Un nouveau compte famille vient d'être créé sur FAB.",
    sections: [
      { title: "Nom", body: params.displayName },
      { title: "Courriel", body: params.email },
      { title: "Ville", body: params.city }
    ],
    action: { label: "Ouvrir l'administration", href: absoluteUrl(params.frontendUrl, "/admin") },
    note: "Vous pouvez suivre cette inscription depuis l'onglet familles de l'administration."
  });
}
