export const ALLY_COURSE_VERSION = "faba-v1";
export const ALLY_COURSE_TITLE = "Formation des Alliés – Comprendre et soutenir les familles d'accueil";

export type TrainingSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  cards?: { title: string; body: string }[];
  callout?: string;
};

export type TrainingLesson = {
  key: string;
  number: number;
  title: string;
  eyebrow: string;
  estimatedMinutes: number;
  summary: string;
  videoUrl?: string;
  sections: TrainingSection[];
};

export const ALLY_TRAINING_LESSONS: TrainingLesson[] = [
  {
    key: "devenez-un-formidable-soutien",
    number: 1,
    title: "Devenez un formidable soutien",
    eyebrow: "Bienvenue dans le réseau FAB",
    estimatedMinutes: 12,
    summary: "Découvrir la mission des alliés et la différence qu'une présence fiable peut faire.",
    videoUrl: "https://player.vimeo.com/video/1210649943",
    sections: [
      {
        title: "Une communauté autour des familles",
        paragraphs: [
          "Accueillir un enfant transforme le quotidien d'une famille. Les alliés FAB forment un réseau de personnes disponibles pour offrir une aide simple, humaine et prévisible.",
          "Vous n'avez pas à tout connaître ni à tout régler. Votre présence, vos gestes concrets et le respect de vos engagements constituent déjà un soutien important."
        ],
        callout: "Un bon allié ne remplace personne : il ajoute une présence sécurisante autour de la famille."
      },
      {
        title: "Ce que vous apprendrez",
        cards: [
          { title: "Comprendre", body: "Reconnaître les réalités des familles d'accueil et les effets possibles du trauma complexe." },
          { title: "Soutenir", body: "Proposer une aide concrète qui répond aux besoins exprimés par la famille." },
          { title: "Respecter", body: "Protéger la confidentialité, les limites et le rythme de chacun." }
        ]
      }
    ]
  },
  {
    key: "bien-comprendre-avant-de-sengager",
    number: 2,
    title: "Bien comprendre avant de s'engager",
    eyebrow: "La réalité des familles d'accueil",
    estimatedMinutes: 20,
    summary: "Comprendre le placement, les défis du quotidien et la posture attendue d'un allié.",
    sections: [
      {
        title: "Qu'est-ce qu'une famille d'accueil?",
        paragraphs: [
          "Une famille d'accueil ouvre son milieu de vie à un enfant qui ne peut temporairement ou durablement demeurer dans sa famille d'origine. Elle offre sécurité, stabilité, soins et affection, en collaboration avec plusieurs intervenants.",
          "Le placement peut survenir pour différentes raisons : négligence, violence, incapacité temporaire d'un parent, grande instabilité ou besoin de protection. L'histoire exacte demeure confidentielle."
        ]
      },
      {
        title: "Des défis souvent invisibles",
        bullets: [
          "Composer avec des rendez-vous, des transitions et des contacts supervisés.",
          "Accompagner des comportements liés à l'insécurité ou au vécu de l'enfant.",
          "Maintenir l'équilibre du couple, de la fratrie et de la vie professionnelle.",
          "Collaborer avec la famille d'origine et les professionnels, dans le respect du plan établi."
        ],
        callout: "On soutient la famille sans chercher à connaître les détails du dossier de l'enfant."
      },
      {
        title: "Avant de dire oui",
        cards: [
          { title: "Clarifier", body: "Demandez ce qui est réellement attendu, à quel moment et pour quelle durée." },
          { title: "Être réaliste", body: "Offrez uniquement ce que vous pouvez accomplir de façon fiable." },
          { title: "Confirmer", body: "Validez les détails pratiques et prévenez rapidement en cas de changement." }
        ]
      }
    ]
  },
  {
    key: "comprendre-le-trauma-complexe",
    number: 3,
    title: "Comprendre le trauma complexe",
    eyebrow: "Voir le besoin derrière le comportement",
    estimatedMinutes: 35,
    summary: "Décoder les réactions de protection et contribuer à un environnement sécurisant.",
    sections: [
      {
        title: "Qu'est-ce que le trauma complexe?",
        paragraphs: [
          "Le trauma complexe peut découler d'expériences difficiles répétées pendant l'enfance : négligence, violence, pertes, changements de milieu ou insécurité chronique.",
          "Contrairement à un événement difficile ponctuel, ces expériences répétées peuvent influencer la confiance, la régulation des émotions, l'attention et la façon d'entrer en relation."
        ]
      },
      {
        title: "Le cerveau cherche d'abord la sécurité",
        cards: [
          { title: "Combattre", body: "Crier, argumenter, contrôler ou repousser avant d'être blessé." },
          { title: "Fuir", body: "Éviter, se sauver, changer de sujet ou refuser une activité." },
          { title: "Se figer", body: "Ne plus répondre, sembler absent ou être incapable de choisir." },
          { title: "S'adapter", body: "Chercher à plaire à tout prix pour prévenir un conflit ou un rejet." }
        ]
      },
      {
        title: "Décoder plutôt que juger",
        bullets: [
          "Se demander : de quoi cet enfant a-t-il besoin pour se sentir en sécurité?",
          "Garder une voix calme et utiliser des phrases courtes.",
          "Offrir des choix simples plutôt que multiplier les demandes.",
          "Laisser du temps et éviter de forcer une confidence.",
          "Partager vos inquiétudes avec la famille FAB, jamais avec l'entourage."
        ],
        callout: "Le comportement est souvent une stratégie de protection apprise, pas une volonté de provoquer."
      },
      {
        title: "Des mots qui sécurisent",
        cards: [
          { title: "À dire", body: "« Tu es en sécurité ici. » « Je suis là. » « On peut prendre une pause. »" },
          { title: "À éviter", body: "« Calme-toi. » « Tu exagères. » « Pourquoi es-tu comme ça? »" }
        ]
      }
    ]
  },
  {
    key: "le-role-de-lallie",
    number: 4,
    title: "Le rôle de l'allié",
    eyebrow: "Présence, fiabilité et limites",
    estimatedMinutes: 20,
    summary: "Définir votre rôle et reconnaître les situations qui doivent être confiées à l'équipe FAB.",
    sections: [
      {
        title: "Ce qui est mon rôle",
        bullets: [
          "Écouter avec bienveillance, sans chercher à obtenir des informations confidentielles.",
          "Offrir une aide concrète convenue avec la famille.",
          "Respecter les habitudes, les consignes et les limites de la maison.",
          "Être prévisible : confirmer et respecter ses engagements.",
          "Demander du soutien à l'équipe FAB lorsqu'une situation dépasse son rôle."
        ]
      },
      {
        title: "Ce qui n'est pas mon rôle",
        cards: [
          { title: "Décider", body: "Vous ne prenez pas les décisions parentales ou cliniques à la place de la famille." },
          { title: "Conseiller", body: "Vous n'imposez pas de solution ou d'opinion non demandée." },
          { title: "Juger", body: "Vous ne comparez pas la famille, l'enfant ou la famille d'origine." },
          { title: "Intervenir", body: "Vous ne contactez pas directement la DPJ pour gérer une situation courante sans consulter FAB." }
        ],
        callout: "En cas de danger immédiat, utilisez toujours les services d'urgence appropriés."
      },
      {
        title: "Les qualités d'un allié FAB",
        bullets: ["Discret", "Ponctuel", "Respectueux", "Souple", "Calme", "Fiable"]
      }
    ]
  },
  {
    key: "offrir-un-soutien-concret",
    number: 5,
    title: "Offrir un soutien concret",
    eyebrow: "Une aide utile et réaliste",
    estimatedMinutes: 20,
    summary: "Choisir des gestes concrets avec la famille et préserver un engagement durable.",
    sections: [
      {
        title: "Exemples de soutien concret",
        cards: [
          { title: "Repas", body: "Préparer ou apporter un repas à un moment convenu." },
          { title: "Courses", body: "Faire une commission précise ou récupérer une commande." },
          { title: "Répit", body: "Offrir une présence planifiée selon les autorisations de la famille." },
          { title: "Transport", body: "Aider pour un déplacement préalablement organisé." },
          { title: "Écoute", body: "Prendre un café et accueillir ce que le parent souhaite partager." },
          { title: "Maison", body: "Donner un coup de main pour une tâche clairement définie." },
          { title: "Activités", body: "Participer à une activité familiale ou occuper la fratrie." }
        ]
      },
      {
        title: "Avant d'aider",
        bullets: [
          "Demandez : « Qu'est-ce qui vous aiderait vraiment cette semaine? »",
          "Précisez ce que vous pouvez faire et la durée disponible.",
          "Respectez un refus ou un changement de plan.",
          "Ne promettez pas davantage pour éviter de décevoir."
        ]
      },
      {
        title: "Trouver l'équilibre",
        paragraphs: [
          "Une aide durable repose sur des limites saines. Vous pouvez dire non, proposer une autre date ou choisir un geste plus simple.",
          "La fiabilité compte davantage que la quantité d'aide offerte."
        ]
      }
    ]
  },
  {
    key: "communication-et-bienveillance",
    number: 6,
    title: "Communication et bienveillance",
    eyebrow: "Créer une relation de confiance",
    estimatedMinutes: 20,
    summary: "Écouter, reformuler et communiquer sans jugement.",
    sections: [
      {
        title: "L'écoute active",
        bullets: [
          "Être pleinement présent et limiter les distractions.",
          "Reformuler : « Si je comprends bien… »",
          "Valider l'émotion sans prétendre tout comprendre.",
          "Poser des questions ouvertes seulement lorsque c'est utile.",
          "Respecter le silence et le choix de ne pas parler."
        ]
      },
      {
        title: "Une communication respectueuse",
        cards: [
          { title: "Observer", body: "Décrivez un fait sans interpréter ni accuser." },
          { title: "Écouter", body: "Cherchez d'abord à comprendre le besoin exprimé." },
          { title: "Clarifier", body: "Vérifiez les attentes, les horaires et les limites." },
          { title: "Confirmer", body: "Résumez l'entente pour éviter les malentendus." }
        ]
      },
      {
        title: "Confidentialité",
        paragraphs: [
          "Aucun nom, détail de placement, histoire vécue ou information permettant d'identifier un enfant ou une famille ne doit être partagé.",
          "Vous pouvez parler de votre implication de façon générale, sans identifier qui que ce soit."
        ],
        callout: "En cas de doute, ne partagez pas l'information et demandez conseil à l'équipe FAB."
      }
    ]
  },
  {
    key: "devenir-un-allie-fab",
    number: 7,
    title: "Devenir un allié FAB",
    eyebrow: "Passer de l'intention à l'engagement",
    estimatedMinutes: 15,
    summary: "Comprendre l'engagement FAB et la façon dont le réseau accompagne les alliés.",
    sections: [
      {
        title: "Votre engagement",
        bullets: [
          "Maintenir vos coordonnées et disponibilités à jour.",
          "Respecter les règles de confidentialité et les consignes reçues.",
          "Accepter uniquement les demandes compatibles avec vos capacités.",
          "Informer rapidement la famille en cas d'imprévu.",
          "Contacter FAB lorsque vous avez besoin d'encadrement."
        ]
      },
      {
        title: "Un réseau uni",
        paragraphs: [
          "FAB facilite la rencontre entre les familles et les alliés, mais la confiance se construit dans chaque geste du quotidien.",
          "Votre profil sera publié après la réussite de la formation, la réception des documents requis et la validation finale de l'équipe."
        ],
        callout: "Un compte, une plateforme, un suivi : tout votre parcours demeure dans FAB."
      }
    ]
  },
  {
    key: "finalisation",
    number: 8,
    title: "Finalisation",
    eyebrow: "Vérifier vos acquis",
    estimatedMinutes: 18,
    summary: "Réviser les notions clés, compléter le quiz formatif et accéder à l'examen final.",
    sections: [
      {
        title: "Avant le quiz",
        bullets: [
          "Je protège toujours la confidentialité de l'enfant et de la famille.",
          "Je cherche le besoin derrière le comportement.",
          "Je demande ce qui serait réellement aidant.",
          "Je respecte mes limites et mes engagements.",
          "Je demande l'aide de FAB lorsque la situation dépasse mon rôle."
        ]
      },
      {
        title: "La suite",
        paragraphs: [
          "Le quiz formatif comporte 12 mises en situation et vous donne une rétroaction immédiate.",
          "Lorsque tous les modules et le quiz sont complétés, l'examen final devient disponible. Vous disposez de trois essais."
        ]
      }
    ]
  }
];

export type TrainingQuestion = {
  id: string;
  prompt: string;
  answers: string[];
  correctIndex: number;
  explanation: string;
};

export const FORMATIVE_QUESTIONS: TrainingQuestion[] = [
  {
    id: "3261",
    prompt: "Une voisine vous demande pourquoi un enfant a été placé dans sa famille d'accueil. Que faites-vous?",
    answers: ["Vous racontez seulement les grandes lignes.", "Vous refusez poliment de partager des informations personnelles.", "Vous demandez à la famille biologique.", "Vous partagez ce que vous avez entendu."],
    correctIndex: 1,
    explanation: "La confidentialité protège l'enfant et la famille. Aucun détail personnel ou identifiable ne doit être partagé."
  },
  {
    id: "3262",
    prompt: "Quel type d'information un allié peut-il partager?",
    answers: ["Le nom de l'enfant.", "Les détails du dossier de la DPJ.", "Son implication de façon générale, sans identifier la famille.", "L'histoire vécue par l'enfant."],
    correctIndex: 2,
    explanation: "Un allié peut parler de son implication en termes généraux, sans révéler d'information permettant d'identifier une personne."
  },
  {
    id: "3263",
    prompt: "Un enfant crie et refuse de collaborer. Quelle est la meilleure réaction?",
    answers: ["Lui dire de se calmer immédiatement.", "Le punir pour son comportement.", "Rester calme et chercher à comprendre ce qu'il vit.", "Lui demander pourquoi il agit ainsi devant tout le monde."],
    correctIndex: 2,
    explanation: "Une posture calme, sécurisante et sans jugement aide à comprendre le besoin derrière le comportement."
  },
  {
    id: "3265",
    prompt: "Quelle phrase est la plus aidante pour un enfant qui semble inquiet?",
    answers: ["Tu fais exprès.", "Arrête ton cinéma.", "Tu es en sécurité ici.", "Pourquoi es-tu comme ça?"],
    correctIndex: 2,
    explanation: "Les phrases courtes, calmes et rassurantes contribuent à créer un sentiment de sécurité."
  },
  {
    id: "3266",
    prompt: "Quelle phrase doit être évitée?",
    answers: ["Je suis là pour toi.", "Merci de m'avoir parlé.", "On va trouver une solution ensemble.", "Calme-toi, tu exagères."],
    correctIndex: 3,
    explanation: "Une phrase qui minimise ou juge l'émotion peut augmenter l'insécurité et nuire à la confiance."
  },
  {
    id: "3267",
    prompt: "Quel est le rôle principal d'un allié FAB?",
    answers: ["Prendre les décisions à la place de la famille.", "Donner des conseils même si la famille ne les demande pas.", "Offrir une présence bienveillante, fiable et respectueuse.", "Intervenir directement auprès de la DPJ."],
    correctIndex: 2,
    explanation: "L'allié offre un soutien complémentaire. Il ne remplace ni la famille ni les professionnels."
  },
  {
    id: "3268",
    prompt: "Avant d'offrir une aide concrète à une famille, que faut-il faire?",
    answers: ["Choisir soi-même ce qui semble utile.", "Demander à la famille ce dont elle a réellement besoin.", "Organiser une activité sans prévenir.", "Insister jusqu'à ce que la famille accepte."],
    correctIndex: 1,
    explanation: "Les besoins varient. Il faut demander, clarifier et respecter la réponse reçue."
  },
  {
    id: "3269",
    prompt: "Que devez-vous faire si une situation dépasse votre rôle d'allié?",
    answers: ["Régler la situation seul.", "Publier une question dans un groupe Facebook.", "Demander du soutien à l'équipe FAB.", "Contacter directement la DPJ sans consulter personne."],
    correctIndex: 2,
    explanation: "Lorsqu'une situation dépasse le rôle de l'allié, il faut demander du soutien à l'équipe FAB."
  },
  {
    id: "3270",
    prompt: "Que signifie être un allié fiable?",
    answers: ["Promettre beaucoup de choses.", "Confirmer les détails et respecter ses engagements.", "Être toujours disponible, même lorsqu'on est épuisé.", "Décider à la place de la famille."],
    correctIndex: 1,
    explanation: "La fiabilité repose sur des engagements réalistes, confirmés et respectés."
  },
  {
    id: "3271",
    prompt: "Comment offrir une aide durable sans se surcharger?",
    answers: ["Accepter toutes les demandes.", "Ignorer ses propres limites.", "Offrir une aide réaliste selon ses capacités et ses disponibilités.", "Ne jamais demander de soutien."],
    correctIndex: 2,
    explanation: "Une aide durable commence par des limites saines et une disponibilité réaliste."
  },
  {
    id: "3272",
    prompt: "Qu'est-ce que le trauma complexe?",
    answers: ["Une réaction temporaire à un seul événement.", "Le résultat possible d'expériences difficiles répétées pendant l'enfance.", "Un comportement volontaire pour attirer l'attention.", "Un manque de discipline."],
    correctIndex: 1,
    explanation: "Le trauma complexe peut découler d'expériences difficiles répétées et d'une insécurité chronique."
  },
  {
    id: "3273",
    prompt: "Quelle attitude favorise une bonne communication avec une famille d'accueil?",
    answers: ["Donner rapidement son opinion.", "Poser beaucoup de questions personnelles.", "Écouter, reformuler et communiquer sans jugement.", "Comparer la famille avec d'autres familles."],
    correctIndex: 2,
    explanation: "L'écoute active, la reformulation, l'empathie et l'absence de jugement favorisent une communication respectueuse."
  }
];

export const FINAL_QUESTION: TrainingQuestion = {
  id: "3264",
  prompt: "Les alliés peuvent jouer un rôle important en offrant un environnement accueillant, respectueux et sécurisant aux familles d'accueil.",
  answers: ["Vrai", "Faux"],
  correctIndex: 0,
  explanation: "Une présence bienveillante, fiable et respectueuse contribue à créer un réseau sécurisant autour des familles."
};

export function publicQuestion(question: TrainingQuestion) {
  return { id: question.id, prompt: question.prompt, answers: question.answers };
}
