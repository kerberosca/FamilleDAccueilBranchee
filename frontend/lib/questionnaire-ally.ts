/**
 * Questionnaire allié — 6 questions (3 à choix, 3 à développement).
 * Structure générique : modifier ce tableau pour changer les questions sans toucher au reste.
 */
export type AllyQuestionType = "choice" | "text";

export type AllyQuestion = {
  id: string;
  label: string;
  type: AllyQuestionType;
  options?: string[];
};

export const ALLY_QUESTIONNAIRE: AllyQuestion[] = [
  { id: "q1", label: "Quelle est votre principale motivation pour devenir allié ?", type: "choice", options: ["Aider les familles", "Revenus complémentaires", "Les deux"] },
  { id: "q2", label: "Avez-vous déjà travaillé avec des familles d'accueil ?", type: "choice", options: ["Oui", "Non", "En formation"] },
  { id: "q3", label: "Comment avez-vous connu notre plateforme ?", type: "choice", options: ["Recommandation", "Recherche en ligne", "Réseaux sociaux", "Autre"] },
  { id: "q4", label: "Décrivez en quelques lignes votre expérience ou ce que vous souhaitez apporter aux familles.", type: "text" },
  { id: "q5", label: "Quelles sont vos disponibilités habituelles (jours, créneaux) ?", type: "text" },
  { id: "q6", label: "Souhaitez-vous ajouter une information importante pour les familles ?", type: "text" }
];

export const ALLY_QUESTIONNAIRE_IDS = ALLY_QUESTIONNAIRE.map((q) => q.id);
