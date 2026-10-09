import type { HelpContent } from "./types";

/** Contenu de la page Aide (français). Chaque sujet ne s'affiche qu'aux comptes
 *  concernés (voir `audience`). Garder les libellés identiques à ceux du site. */
export const helpFr: HelpContent = {
  topics: [
    // ── Compte ────────────────────────────────────────────────────────
    {
      id: "profil", audience: "everyone", group: "account",
      title: "Mon profil et mon compte",
      summary: "Photo, bio, compétences, mot de passe, suppression du compte.",
      link: { href: "/profile", label: "Ouvrir Mon profil" },
      blocks: [
        { type: "list", items: [
          "**Photo, bio, compétences, liens** (LinkedIn, GitHub, site) : cliquez sur l'élément à modifier, puis enregistrez.",
          "**Expériences et certifications** : boutons « Ajouter » dans chaque bloc.",
          "**Mot de passe** : en bas de Mon profil. Oublié ? Utilisez « Mot de passe oublié ? » sur la page de connexion : le lien reçu est valable 24 heures et ne sert qu'une fois.",
          "**Supprimer mon compte** : en bas de Mon profil. La suppression est définitive.",
        ] },
      ],
    },
    {
      id: "candidature", audience: "candidate", group: "account",
      title: "Ma candidature",
      summary: "Devenir membre de Data Afrique Hub.",
      blocks: [
        { type: "steps", items: [
          "Si ce n'est pas déjà fait, cliquez sur **Adhérer** sur le site et remplissez le formulaire de candidature.",
          "Votre candidature est examinée par l'équipe. Vous recevez la réponse par email.",
          "Une fois accepté, vous devenez **Membre** : votre numéro de membre est attribué automatiquement et de nouvelles rubriques apparaissent dans votre menu (Mon département, Mes points, Mes cotisations, Ma carte).",
        ] },
        { type: "p", text: "En attendant, vous pouvez vous inscrire aux événements depuis la page **Événements** du site. Si vous vous êtes déjà inscrit avec le même email, le formulaire se remplit tout seul." },
      ],
    },
    {
      id: "annuaire", audience: "member", group: "account",
      title: "Apparaître dans l'annuaire public",
      summary: "Votre profil est masqué tant que vous ne l'activez pas.",
      link: { href: "/profile#visibilite", label: "Régler ma visibilité" },
      blocks: [
        { type: "p", text: "Le site présente les membres qui le souhaitent dans un annuaire public, pour faire connaître la communauté et vos compétences auprès des partenaires." },
        { type: "table", head: ["", "Ce qui est concerné"], rows: [
          ["Affiché si vous l'activez", "nom, photo, rôle, département, compétences, bio, expériences, certifications, liens"],
          ["Jamais affiché", "email, téléphone, CV"],
        ] },
        { type: "p", text: "Activez ou désactivez l'interrupteur **Apparaître dans l'annuaire public** dans Mon profil, à tout moment." },
      ],
    },
    {
      id: "carte", audience: "member", group: "member",
      title: "Ma carte de membre",
      summary: "Télécharger, imprimer ou partager votre carte.",
      link: { href: "/member-card", label: "Ouvrir Ma carte" },
      blocks: [
        { type: "p", text: "Votre carte affiche votre numéro de membre, votre fonction et votre date d'adhésion. **Télécharger** l'enregistre pour l'imprimer ; **Partager** copie son lien. Sans numéro, votre adhésion n'est pas encore validée." },
      ],
    },
    // ── Membre ────────────────────────────────────────────────────────
    {
      id: "taches", audience: "member", group: "member",
      title: "Mes tâches",
      summary: "Suivre, soumettre et faire valider vos tâches.",
      link: { href: "/my-department", label: "Ouvrir Mon département" },
      blocks: [
        { type: "p", text: "**Mon département** a trois onglets : **Mes tâches**, **Projets** et **Équipe**. Quand une tâche vous est confiée, vous recevez un email « Nouvelle tâche »." },
        { type: "steps", items: [
          "Dans **Mes tâches**, lisez la description (« Voir plus » pour l'afficher en entier).",
          "Indiquez votre avancement : À faire, En cours ou Bloquée.",
          "Quand c'est terminé, cliquez sur **Soumettre**. Ajoutez si besoin un mot ou un lien pour votre responsable.",
          "Votre responsable **valide** la tâche (vous gagnez les points) ou la **renvoie** avec ce qu'il reste à ajuster : corrigez, puis soumettez à nouveau.",
        ] },
        { type: "p", text: "Chaque tâche vaut **de 1 à 5 points**, fixés par le responsable selon l'effort demandé." },
        { type: "table", head: ["Situation", "Effet"], rows: [
          ["Rendue avant l'échéance", "+1 point"],
          ["Travail remarquable", "+1 point"],
          ["Rendue en retard", "−1 point (1 point au minimum)"],
        ] },
        { type: "note", text: "Les points sont accordés à la validation et comptent au mois où la tâche est rendue." },
      ],
    },
    {
      id: "points-etape", audience: "member", group: "member",
      title: "Points d'étape",
      summary: "Le court bilan mensuel envoyé par votre responsable.",
      link: { href: "/my-points", label: "Ouvrir Mes points" },
      blocks: [
        { type: "p", text: "Ce n'est pas une évaluation : c'est l'occasion de dire comment vous vivez votre implication et ce qui peut être amélioré." },
        { type: "steps", items: [
          "Dans **Mes points**, cliquez sur **Remplir** à côté de « Un point d'étape vous attend ».",
          "Notez-vous de 1 à 5 sur cinq critères, puis répondez aux deux questions.",
          "Envoyez. Vous pouvez modifier vos réponses tant que votre responsable n'a pas répondu.",
          "Votre responsable confirme et vous envoie un retour. Le point d'étape vaut de 1 à 5 points.",
        ] },
      ],
    },
    {
      id: "points", audience: "member", group: "member",
      title: "Mes points",
      summary: "Vos points du mois, du trimestre ou de l'année.",
      link: { href: "/my-points", label: "Ouvrir Mes points" },
      blocks: [
        { type: "p", text: "Vos points viennent des tâches validées, des points d'étape et des cotisations réglées. Vous y trouvez l'historique et les retours de vos responsables." },
      ],
    },
    {
      id: "cotisations", audience: "contributor", group: "member",
      title: "Mes cotisations",
      summary: "Déclarer un paiement avec sa preuve.",
      link: { href: "/my-contributions", label: "Ouvrir Mes cotisations" },
      blocks: [
        { type: "callout", title: "Pourquoi votre cotisation compte",
          text: "Data Afrique Hub vit grâce à ses membres. Votre cotisation finance directement ce que la communauté vous apporte :",
          items: [
            "la plateforme, le site et les emails que vous utilisez chaque jour ;",
            "les événements, ateliers et formations, souvent gratuits pour les participants ;",
            "les projets communautaires et les hackathons, où vous montez en compétences ;",
            "la présence de la communauté auprès des partenaires, qui ouvre des opportunités à ses membres.",
          ],
          footer: "500 FCFA par mois, c'est 6 000 FCFA par an : peu pour chacun, mais, réunies, les cotisations permettent à la communauté de grandir sans dépendre uniquement des sponsors. Toutes les recettes et dépenses sont tenues dans la caisse par la trésorerie. Et chaque mois réglé vous rapporte aussi 5 points." },
        { type: "table", head: ["Vous êtes", "Cotisation mensuelle"], rows: [
          ["Membre", "500 FCFA"],
          ["Responsable de département ou membre du bureau", "1 000 FCFA"],
        ] },
        { type: "p", text: "Vous pouvez payer un mois, une période ou l'année entière." },
        { type: "steps", items: [
          "Payez par Mobile Money ou virement.",
          "Dans **Mes cotisations**, cliquez sur **Déclarer un paiement**.",
          "Cochez les mois payés et joignez une capture de la preuve (JPG, PNG ou WebP, 5 Mo maximum).",
          "Cliquez sur **Envoyer pour validation**. La trésorerie vérifie et valide : vous recevez un reçu par email.",
        ] },
        { type: "note", text: "Un rappel peut vous être envoyé dans les dix derniers jours du mois si le mois n'est ni payé ni déclaré." },
      ],
    },
    // ── Départements ──────────────────────────────────────────────────
    {
      id: "gestionnaire", audience: "projectManager", group: "department",
      title: "Gestionnaire de projets",
      summary: "Créer les projets du département et y assigner des tâches.",
      link: { href: "/my-department", label: "Ouvrir Mon département" },
      blocks: [
        { type: "p", text: "Votre responsable vous a désigné gestionnaire de projets. Vous organisez le travail, mais vous ne validez pas les tâches : la validation et les points restent au responsable." },
        { type: "steps", items: [
          "**Projets → Nouveau projet**, en 3 étapes : choisissez un modèle (projet data, événement, formation ou de zéro), le nom et, si vous voulez, l'objectif et l'échéance ; listez les premières tâches avec leur personne et leurs points ; vérifiez, puis créez.",
          "Dans le tableau du projet, tapez un titre dans **+ Ajouter une tâche…** puis Entrée. Cliquez ensuite sur la carte, puis **Modifier la tâche** pour la décrire avec l'éditeur, choisir la personne, l'échéance et les points (1 à 5).",
          "Enregistrez : la personne reçoit un email avec la description et un lien vers ses tâches.",
        ] },
        { type: "note", text: "Le tableau range les tâches en quatre colonnes : À faire, En cours, À valider, Validées. Vos droits s'arrêtent si vous quittez le département ou si le responsable vous les retire." },
      ],
    },
    {
      id: "responsable", audience: "lead", group: "department",
      title: "Responsable de département",
      summary: "Équipe, gestionnaires, validation des tâches, points d'étape.",
      link: { href: "/my-department", label: "Ouvrir Mon département" },
      blocks: [
        { type: "p", text: "Le responsable et le co-responsable gèrent leur département avec trois onglets : **Aujourd'hui** (tout ce qui attend une action : tâches à valider, points d'étape à confirmer, retards), **Projets** et **Équipe**. Ils gèrent tous les projets du département, y compris ceux créés par d'autres." },
        { type: "list", items: [
          "**Équipe → Ajouter un membre** ; **Terminer l'adhésion** quand quelqu'un quitte le département.",
          "**Gestionnaires de projets** (haut de l'onglet Équipe) : choisissez un membre puis **Ajouter**. Il crée des projets et assigne des tâches, sans les valider.",
          "**Valider une tâche** : groupe « À valider » en orange → **Valider** (cochez « Travail remarquable » pour +1 point) ou **Renvoyer** avec ce qu'il reste à faire. Personne ne valide sa propre tâche.",
          "**Équipe → Points d'étape → Lancer un point d'étape** : mois évalué, date limite, membres concernés. Puis **Lire et confirmer** : ajustez les scores (seuls les vôtres comptent) et envoyez un retour.",
          "**Classement** : les membres les plus impliqués de votre département.",
        ] },
      ],
    },
    // ── Sections de gestion ───────────────────────────────────────────
    {
      id: "evenements", audience: "section:events", group: "management",
      title: "Événements",
      summary: "Créer, publier, suivre les inscrits, envoyer des rappels.",
      link: { href: "/manage/events", label: "Ouvrir Événements" },
      blocks: [
        { type: "list", items: [
          "**Créer** : Nouvel événement → titre, dates, lieu ou lien, image, intervenants. Brouillon ou publication.",
          "**Inscrits** : le nombre s'affiche sur chaque événement ; la liste s'exporte en Excel.",
          "**Rappel aux inscrits** : choisissez un modèle (avant / après l'événement), ajustez, envoyez-vous un test, puis envoyez.",
          "**Tous les participants** : par période ou pour des événements choisis, exportable.",
        ] },
      ],
    },
    {
      id: "membres", audience: "section:members", group: "management",
      title: "Membres",
      summary: "L'annuaire complet des membres.",
      link: { href: "/manage/members", label: "Ouvrir Membres" },
      blocks: [
        { type: "p", text: "Consultez tous les membres et leurs profils. La modification des rôles et la suppression de comptes restent réservées à l'administrateur." },
      ],
    },
    {
      id: "departements", audience: "section:departments", group: "management",
      title: "Départements",
      summary: "Créer les départements et nommer leurs responsables.",
      link: { href: "/manage/departments", label: "Ouvrir Départements" },
      blocks: [
        { type: "p", text: "Créez, renommez ou supprimez un département et nommez son responsable et son co-responsable. Vous accédez à tous les départements avec les mêmes possibilités qu'un responsable." },
      ],
    },
    {
      id: "actualites", audience: "section:news", group: "management",
      title: "Actualités",
      summary: "Rédiger, programmer et modérer les articles.",
      link: { href: "/manage/actualites", label: "Ouvrir Actualités" },
      blocks: [
        { type: "p", text: "Rédigez un article avec l'éditeur, choisissez une catégorie et une image, puis enregistrez en brouillon, publiez ou programmez la publication. Vous pouvez supprimer les commentaires inappropriés." },
      ],
    },
    {
      id: "emails", audience: "section:emails", group: "management",
      title: "Emails aux membres",
      summary: "Écrire à un ou plusieurs membres.",
      link: { href: "/manage/emails", label: "Ouvrir Emails" },
      blocks: [
        { type: "steps", items: [
          "Choisissez un modèle : annonce, convocation, appel à volontaires, félicitations ou message libre.",
          "Choisissez les destinataires : des membres un par un, ou un groupe (tous, bureau, responsables, un département).",
          "Rédigez : {prénom} et {nom} sont remplacés pour chaque destinataire. Ajoutez un bouton d'action si besoin.",
          "**M'envoyer un test**, vérifiez, puis envoyez.",
        ] },
        { type: "note", text: "Chacun reçoit son propre email, sans voir les autres adresses. Suivez l'avancement dans **Historique** et renvoyez aux échecs si besoin. L'envoi est bloqué s'il dépasse le quota d'emails du jour." },
      ],
    },
    {
      id: "tresorerie", audience: "section:treasury", group: "management",
      title: "Trésorerie",
      summary: "Valider les paiements, relancer, tenir la caisse.",
      link: { href: "/treasury", label: "Ouvrir Trésorerie" },
      blocks: [
        { type: "list", items: [
          "**À valider** : les paiements déclarés avec leur preuve. Vérifiez le montant, puis **Valider** ou **Refuser** avec un motif. Le membre reçoit un reçu et ses points.",
          "**Membres** : qui a réglé quel mois. Dans les dix derniers jours du mois, **Envoyer le rappel** prévient ceux qui n'ont ni payé ni déclaré (une fois par mois). La fiche d'un membre permet d'enregistrer un paiement reçu directement.",
          "**Caisse** : recettes et dépenses de l'association, indépendamment des cotisations.",
        ] },
        { type: "note", text: "Chaque nouvelle déclaration vous est signalée par email." },
      ],
    },
    {
      id: "classement", audience: "section:ranking", group: "management",
      title: "Classement de la communauté",
      summary: "Membre du mois, membre de l'année, ajustements de points.",
      link: { href: "/ranking", label: "Ouvrir Classement" },
      blocks: [
        { type: "p", text: "Le classement de toute la communauté, par mois, trimestre ou année. L'icône de médaille sur une ligne désigne le **membre du mois** ou **de l'année**. Vous pouvez corriger les points d'un membre : le motif est obligatoire et reste tracé." },
      ],
    },
    {
      id: "candidatures", audience: "section:applications", group: "management",
      title: "Candidatures",
      summary: "Examiner les demandes d'adhésion.",
      link: { href: "/memberships", label: "Ouvrir Candidatures" },
      blocks: [
        { type: "p", text: "Ouvrez une candidature (avec le CV), puis acceptez-la ou refusez-la. Le candidat est prévenu par email ; accepté, il devient membre. Vous êtes averti par email à chaque nouvelle candidature." },
      ],
    },
    // ── Administration ────────────────────────────────────────────────
    {
      id: "acces", audience: "admin", group: "admin",
      title: "Gestion des accès",
      summary: "Accorder les sections, nommer un administrateur.",
      link: { href: "/manage/access", label: "Ouvrir Gestion des accès" },
      blocks: [
        { type: "steps", items: [
          "Cherchez le membre, ou filtrez sur « Avec des accès ».",
          "Cochez les sections qu'il peut gérer, puis **Enregistrer les accès**. Le changement est immédiat.",
        ] },
        { type: "list", items: [
          "Seuls les membres actifs reçoivent des sections ; un membre redevenu candidat ou visiteur les perd.",
          "**Nommer administrateur** donne accès à tout, y compris à la Gestion des accès : à accorder avec parcimonie. On ne peut ni retirer son propre rôle ni le dernier administrateur.",
          "Dans **Membres**, l'administrateur modifie le rôle, le poste et le département d'un utilisateur, désactive ou supprime un compte.",
        ] },
      ],
    },
  ],
  faq: [
    { audience: "everyone", q: "Je ne reçois pas les emails.", a: "Vérifiez vos courriers indésirables, puis l'adresse de votre compte dans Mon profil." },
    { audience: "everyone", q: "Une rubrique a disparu de mon menu.", a: "L'administrateur a modifié vos accès. Demandez-lui si vous en avez besoin pour votre rôle." },
    { audience: "candidate", q: "Quand saurai-je si ma candidature est acceptée ?", a: "Dès qu'elle est examinée : la réponse arrive par email, et votre menu s'enrichit si elle est acceptée." },
    { audience: "contributor", q: "Mon paiement n'apparaît pas.", a: "Une déclaration reste « En attente » jusqu'à sa validation par la trésorerie. Refusée, son motif est indiqué dans Mes cotisations." },
    { audience: "member", q: "Ma tâche a été renvoyée.", a: "Lisez la raison sous la tâche, corrigez, puis cliquez à nouveau sur Soumettre." },
    { audience: "member", q: "Je ne vois pas mon département.", a: "Vous n'êtes rattaché à aucun département pour le moment. Demandez à un responsable de vous ajouter." },
    { audience: "member", q: "Mon profil n'est pas sur le site.", a: "Il est masqué par défaut : activez « Apparaître dans l'annuaire public » dans Mon profil." },
    { audience: "lead", q: "Un membre ne voit pas sa tâche.", a: "Vérifiez qu'elle lui est bien assignée et qu'il fait toujours partie du département (onglet Équipe)." },
  ],
};
