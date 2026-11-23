<div align="center">

![Bannière Shiori](./public/banner.svg)

<br />

[![Next.js](https://img.shields.io/badge/Next.js-15.5-07080C?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-0E1017?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-0E1017?style=for-the-badge&logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-0E1017?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0E1017?style=for-the-badge&logo=framer&logoColor=E5484D)](https://www.framer.com/motion/)
[![Recharts](https://img.shields.io/badge/Recharts-2.15-0E1017?style=for-the-badge&logo=chartdotjs&logoColor=F0B95B)](https://recharts.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%2B_RLS-0E1017?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.com/)
[![AniList](https://img.shields.io/badge/AniList-GraphQL_%2B_OAuth_2.0-0E1017?style=for-the-badge&logo=anilist&logoColor=02A9FF)](https://anilist.co/)
[![PWA](https://img.shields.io/badge/PWA-Installable-0E1017?style=for-the-badge&logo=pwa&logoColor=F472B6)](https://web.dev/progressive-web-apps/)

<br />

**Shiori (栞 — *marque-page* en japonais)** est une application web full-stack de suivi d'animés et de mangas conçue autour d'une interface nocturne éditoriale (*Obsidienne, Akane Crimson & Or Kinpaku*).  
Elle réunit gestion de bibliothèque, calendrier simulcast, découverte avancée par envies, statistiques analytiques, traduction automatique des synopsis, synchronisation bidirectionnelle **AniList** et **Supabase**, ainsi qu'un espace communautaire avec messagerie privée.

[Fonctionnalités](#-fonctionnalités) • [Stack technique](#-stack-technique) • [Arborescence](#-arborescence-du-projet) • [Installation](#-installation-et-démarrage) • [Variables d'environnement](#-variables-denvironnement) • [Base de données](#-base-de-données-supabase) • [API & Sécurité](#-architecture-api--sécurité)

</div>

---

## ✨ Fonctionnalités

### 📚 Bibliothèque personnelle & Suivi (`/library`, `/media/[id]`)
- **Suivi complet Anime & Manga** : statuts (`En cours`, `Terminé`, `À voir`, `En pause`, `Abandonné`), incrémentation rapide d'épisodes/chapitres en 1 clic (`+1` avec complétion automatique au dernier épisode et promotion depuis `À voir`), notes personnelles, notes privées, dates et compteur de relectures/revisionnages.
- **3 modes d'affichage** : Grille cinématographique, Liste détaillée et Tableau compact.
- **Studio de filtres en verre dépoli (0 `<select>` natif)** : pilules tactiles 1-clic pour la **Note personnelle** et la **Progression**, menus déroulants personnalisés `LuxurySelect` avec **recherche intégrée** et **compteurs en direct** (Genre, Studio/Auteur, Format, Collection), grille compacte 4 colonnes pour les Années, icônes saisonnières et barre persistante de **Filtres actifs** retirables individuellement.
- **Collections & Favoris** : création de collections personnalisées (`CollectionsManagerPanel`) et classement ordonné des favoris (`FavoritesOrganizer`).
- **Import / Export portable** : export **CSV (RFC-4180)** et **JSON**, plus import direct depuis un compte **AniList** ou un fichier JSON.

### 🧭 Découverte & Catalogue AniList (`/discover`, `/`)
- **Recherche & exploration temps réel** connectées à l'API GraphQL d'AniList (avec jeu de secours local `anilist-seed.json`).
- **14 ambiances « Envies » (`MOOD_PRESETS`)** et **142 critères combinables** répartis en 5 catégories (*Genres, Situations, Univers & Lieux, Thèmes & Styles, Public*).
- **Filtres avancés** : format, année, saison, statut de diffusion, fourchette de note (`/10`), plage personnalisée de nombre d'épisodes/chapitres, et option *Masquer ma bibliothèque*.
- **Palette de commandes globale (`Ctrl+K` / `⌘K`)** : recherche instantanée de titres et navigation rapide depuis n'importe quelle page.
- **Traduction automatique des synopsis à la volée** (`/api/translate`) : sélection **FR / EN / ES / IT** dans la barre de navigation et les paramètres, mise en cache partagée dans `public.media_translations` et assainissement HTML strict (`sanitizeSynopsisHtml`).

### 🗓️ Sorties hebdomadaires & Calendrier Simulcast (`/episodes`, `/calendar`)
- **Suivi hebdomadaire des épisodes** : strip rapide en page d'accueil (`HomeWeeklyCheckStrip`) et vue dédiée `/episodes` synchronisée avec les horaires de diffusion AniList (`watching-airing`).
- **Calendrier simulcast & explorateur de saisons** : conversion automatique des créneaux de diffusion entre heure locale, **UTC** et **JST** (`calendar-utils.ts`).

### 📊 Statistiques, Shiori Wrapped & Badges (`/stats`)
- **Analytique visuelle (Recharts)** : répartition des statuts, distribution des notes, genres dominants, volumes d'épisodes/chapitres et temps de visionnage estimé (`src/lib/stats.ts`).
- **Shiori Wrapped** : récapitulatif annuel basé sur les données réelles de votre bibliothèque (`ShioriWrappedCard`).
- **Système de 39 badges déblocables** (`src/lib/badges.ts`) avec toast de déblocage animé (`BadgeUnlockToast`) et épinglage sur le profil public (`PinnedBadgesRow`).

### 👥 Communauté, Affinité & Messagerie (`/community`, `/profile/[username]`, `/messages`)
- **Fil d'activité communautaire** : filtrage par catégorie (*Tout, Favoris, Terminés, Notes, Badges, Doubleurs*), likes, commentaires et suivi des **seiyū / doubleurs favoris** (`VoiceActorFavoritesManager`).
- **Profils publics & Score de compatibilité** (`src/lib/affinity.ts`, `ProfileAffinityCard`) : calcul automatique du pourcentage d'affinité entre deux membres, liste des favoris partagés et **3 recommandations personnalisées** extraites de la bibliothèque visitée.
- **Amis, Blocage & Modération** : demandes d'amis, blocage bilatéral (`user_blocks` + fonction SQL `is_pair_blocked()`), et signalement de contenus (`content_reports`).
- **Messagerie privée** (`/messages`) : conversations 1-à-1 avec vue adaptative mobile plein écran et notifications temps réel dans la cloche de navigation (`NotificationsPopover`).

### 🎨 Personnalisation, PWA & Synchronisation Cloud (`/settings`)
- **8 thèmes prédéfinis** (*Akane Crimson, Sakura Velvet, Cyber Tokyo, Violet Améthyste, Jade Kyōto, Kinpaku Impérial, Bleu Océanique, Corail Sunset*), **6 atmosphères de surface** (*Obsidienne, OLED Pur, Minuit Indigo, Velours Prune, Ardoise Douce, Teinte Assortie*), **3 styles de coins** et **6 effets d'ambiance animés sur canvas** (*Sakura, Momiji, Neige, Lucioles, Pluie néon, Étoiles*).
- **Mode hybride local + cloud** : utilisable immédiatement en mode invité (`localStorage`) ou avec synchronisation cloud **Supabase** et **OAuth 2.0 bidirectionnel AniList**.
- **Progressive Web App (PWA)** : manifeste web (`public/manifest.json`), raccourcis d'application, Service Worker network-first (`public/sw.js`), page hors-ligne dédiée (`public/offline.html`) et gestion complète des *safe areas* iOS (`viewportFit: "cover"`).
- **Contrôle RGPD intégré** : export complet des données personnelles au format JSON (`GET /api/account`) et suppression définitive du compte (`DELETE /api/account`).

---

## 🛠️ Stack technique

| Couche | Technologies & versions |
| :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) `15.5.29` (App Router, SSR, Route Handlers, Middleware) |
| **Interface** | [React](https://react.dev/) `19.1`, [TypeScript](https://www.typescriptlang.org/) `5.8`, [Tailwind CSS](https://tailwindcss.com/) `4.1` (`@tailwindcss/postcss`) |
| **Animations & UI** | [Framer Motion](https://www.framer.com/motion/) `12.6`, [Lucide React](https://lucide.dev/) `0.503`, `clsx` + `tailwind-merge` |
| **Visualisation** | [Recharts](https://recharts.org/) `2.15` |
| **Typographie** | `Plus Jakarta Sans`, `Cormorant Garamond`, `JetBrains Mono` (`next/font/google`) |
| **Backend & Données** | [Supabase](https://supabase.com/) (`@supabase/supabase-js ^2.49.4`, `@supabase/ssr ^0.6.1`), PostgreSQL + Row Level Security (RLS), fallback serveur local |
| **Intégrations externes** | API GraphQL **AniList** (+ OAuth 2.0 bidirectionnel), traduction automatique avec cache Supabase |
| **Qualité & Tests** | ESLint `9.39` (`eslint-config-next`), TypeScript strict (`tsc --noEmit`), runner natif `node --test` (11 tests unitaires & stress-test 2 000 entrées) |

---

## 📁 Arborescence du projet

```text
shiori/
├── public/
│   ├── apple-touch-icon.png
│   ├── banner.svg                            # Bannière vectorielle Shiori (README)
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon.svg
│   ├── manifest.json                         # Manifeste PWA & raccourcis mobiles
│   ├── offline.html                          # Page de repli hors-ligne
│   └── sw.js                                 # Service Worker PWA (network-first + precache)
├── src/
│   ├── middleware.ts                         # Rafraîchissement SSR des sessions Supabase
│   ├── app/
│   │   ├── layout.tsx                        # Layout racine, polices, métadonnées, viewport safe-area
│   │   ├── template.tsx                      # Transitions de pages
│   │   ├── globals.css                       # Tokens CSS, variables dynamiques de thèmes & glassmorphism
│   │   ├── page.tsx                          # Accueil cinématographique
│   │   ├── loading.tsx / error.tsx / global-error.tsx / not-found.tsx
│   │   ├── robots.ts / sitemap.ts            # SEO dynamique
│   │   ├── library/                          # Bibliothèque (layout + page + studio de filtres)
│   │   ├── discover/                         # Découverte & filtres combinés
│   │   ├── episodes/                         # Suivi des épisodes hebdomadaires
│   │   ├── calendar/                         # Calendrier simulcast & saisons
│   │   ├── media/[id]/                       # Fiche détaillée d'un animé ou manga
│   │   ├── stats/                            # Analytique, Shiori Wrapped & badges
│   │   ├── community/                        # Fil communautaire, membres & seiyū
│   │   ├── profile/[username]/               # Profil public & carte d'affinité
│   │   ├── messages/                         # Messagerie privée
│   │   ├── settings/                         # Apparence, langues, sync AniList, PWA & RGPD
│   │   ├── auth/
│   │   │   ├── callback/route.ts             # Callback OAuth Supabase
│   │   │   └── anilist/callback/route.ts     # Callback OAuth 2.0 AniList
│   │   └── api/
│   │       ├── account/route.ts              # Export RGPD JSON & suppression de compte
│   │       ├── anilist/                      # route, import, sync, activity, recommendations, staff, watching-airing
│   │       ├── auth/                         # register, login, logout, me + anilist/{start,status,disconnect}
│   │       ├── community/                    # profiles, [username], friends, activity/{sync,[id]/like,[id]/comments}, blocks, reports
│   │       ├── messages/route.ts             # Envoi & lecture des messages privés
│   │       ├── notifications/realtime/route.ts
│   │       ├── translate/route.ts            # Traduction à la volée + cache Supabase
│   │       └── user/sync/route.ts            # Synchronisation bibliothèque/préférences
│   ├── components/
│   │   ├── auth/                             # AuthModal
│   │   ├── badges/                           # BadgeIcon, BadgesShowcase, BadgeUnlockToast, PinnedBadgesRow
│   │   ├── calendar/                         # CalendarClient
│   │   ├── discover/                         # DiscoverClient, MoodCarousel
│   │   ├── episodes/                         # HomeWeeklyCheckStrip, WeeklyEpisodeTracker
│   │   ├── favorites/                        # FavoritesOrganizer
│   │   ├── home/                             # HomeDashboardClient, HomeCuratedTabsSection, HomeMoodAndRouletteSection, HomeCommunityPulseSection
│   │   ├── layout/                           # Navbar, Footer, CommandPalette, ThemeQuickPopover, LanguageQuickPopover, ToastContainer
│   │   ├── library/                          # CollectionsManagerPanel
│   │   ├── media/                            # HeroShowcase, MediaCard, MediaRail, MediaDetailClient, ContinueWatchingSection, LibraryTrackerCard, PersonalizedRecommendationsSection, QuickEditModal, TrailerModal, TranslatedSynopsis
│   │   ├── motion/                           # AmbientCanvas, MotionPrimitives, MotionRoot, NavigationProgress
│   │   ├── notifications/                    # NotificationsPopover
│   │   ├── pwa/                              # PwaRegistrar
│   │   ├── settings/                         # ThemeSettingsCard, AmbianceSettingsCard, DisplayPreferencesCard, AniListImportCard, PwaInstallCard
│   │   ├── social/                           # CommunityClient, ActivityCard, AniListActivityFeed, PublicProfileClient, ProfileAffinityCard, FriendActionButton, MessagesClient, VoiceActorFavoritesManager
│   │   └── ui/                               # LuxurySelect, UserAvatar
│   ├── context/
│   │   └── ShioriContext.tsx                 # État global (bibliothèque, thème, langue, auth, sync, badges, toasts)
│   ├── data/
│   │   ├── anilist-seed.json                 # Catalogue de secours local
│   │   └── default-library.ts                # Bibliothèque de démonstration en mode invité
│   ├── hooks/
│   │   └── useDragScroll.ts                  # Défilement tactile/glisser sur les rails horizontaux
│   ├── lib/
│   │   ├── affinity.ts                       # Algorithme de compatibilité & recommandations croisées
│   │   ├── anilist.ts                        # Client GraphQL AniList avec mise en cache & fallback
│   │   ├── badges.ts                         # Définition & moteur d'évaluation des 39 badges
│   │   ├── calendar-utils.ts                 # Conversion de fuseaux horaires (Local / UTC / JST)
│   │   ├── discover-taxonomy.ts              # 14 ambiances & 142 tags/genres structurés
│   │   ├── i18n.ts                           # Langues FR/EN/ES/IT & assainissement HTML des synopsis
│   │   ├── library-utils.ts                  # Filtrage, tri, progression & export CSV RFC-4180
│   │   ├── stats.ts                          # Analytique bibliothèque & générateur Shiori Wrapped
│   │   ├── theme.ts                          # 8 thèmes, 6 surfaces & script anti-FOUC
│   │   ├── utils.ts                          # Utilitaires partagés (`cn`, formatage)
│   │   ├── server/                           # anilist-oauth.ts, auth-store.ts, rate-limit.ts, social-store.ts
│   │   └── supabase/                         # client.ts, server.ts, sync.ts
│   └── types/
│       └── media.ts                          # Types TypeScript (médias, bibliothèque, social, thèmes, filtres)
├── supabase/
│   ├── schema.sql                            # Schéma PostgreSQL complet + politiques RLS
│   └── migrations/
│       └── 20261123_shiori_v2_enhancements.sql # Durcissement RLS, blocage mutuel & modération
├── tests/
│   └── shiori-core.test.ts                   # 11 tests unitaires & stress-test (2 000 entrées)
├── .env.example                              # Modèle de variables d'environnement
├── eslint.config.mjs                         # Configuration ESLint 9 Flat Config
├── next.config.ts                            # Images distantes & en-têtes HTTP de sécurité
├── postcss.config.mjs                        # Plugin PostCSS Tailwind v4
├── tsconfig.json                             # Configuration TypeScript stricte
└── package.json                              # Dépendances et scripts NPM
```

---

## 🚀 Installation et démarrage

### Prérequis
- **Node.js** `20+` (recommandé : `22 LTS` pour le support natif de `node --test` avec TypeScript)
- **npm** `10+`
- Un projet **Supabase** *(optionnel : l'application fonctionne immédiatement en mode local sans configuration cloud)*

### 1. Cloner le dépôt et installer les dépendances

```bash
git clone https://github.com/rita05ctrs-design/Shiori.git
cd Shiori
npm install
```

### 2. Configurer l'environnement

Copiez le fichier modèle puis renseignez vos clés si vous activez Supabase ou AniList OAuth :

```bash
cp .env.example .env.local
```

*(Sous Windows PowerShell : `Copy-Item .env.example .env.local`)*

### 3. Lancer en développement

```bash
npm run dev
```

L'application est disponible sur **http://localhost:3000**.

### Commandes disponibles

| Commande | Description |
| :--- | :--- |
| `npm run dev` | Démarre le serveur Next.js en mode développement (`http://localhost:3000`) |
| `npm run build` | Compile l'application optimisée pour la production |
| `npm run start` | Démarre le serveur de production sur le build compilé |
| `npm run typecheck` | Vérifie le typage TypeScript sans émission (`tsc --noEmit`) |
| `npm run lint` | Analyse le code avec ESLint 9 (`eslint .`) |
| `npm test` | Exécute les 11 tests unitaires et de charge (`node --test tests/*.test.ts`) |

---

## 🔐 Variables d'environnement

Toutes les variables sont optionnelles pour démarrer en mode local/invité. Configurez-les dans `.env.local` (ou dans les variables de votre hébergeur en production) selon les services activés :

| Variable | Requis pour | Visibilité | Description |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sync cloud & auth | Publique | URL de votre projet Supabase (`https://<id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sync cloud & auth | Publique | Clé publique `anon` Supabase (protégée par les politiques RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Suppression `auth.users` | **Serveur uniquement** | Clé `service_role` utilisée uniquement par `DELETE /api/account` pour supprimer aussi l'entrée `auth.users` |
| `NEXT_PUBLIC_SITE_URL` | Redirections OAuth | Publique | URL canonique du site (ex. `http://localhost:3000` en local) |
| `ANILIST_CLIENT_ID` | Sync AniList OAuth 2.0 | **Serveur uniquement** | Identifiant client de votre application développeur AniList |
| `ANILIST_CLIENT_SECRET` | Sync AniList OAuth 2.0 | **Serveur uniquement** | Secret client AniList (ne jamais exposer côté client) |
| `NEXT_PUBLIC_ANILIST_REDIRECT_URI` | Sync AniList OAuth 2.0 | Publique | URL de callback déclarée sur AniList (ex. `http://localhost:3000/auth/anilist/callback`) |
| `SHIORI_SESSION_SECRET` | Mode auth local | **Serveur uniquement** | Secret de signature des sessions locales (généré automatiquement dans `.shiori-data/` si absent) |
| `SHIORI_DATA_DIR` | Mode auth local | **Serveur uniquement** | Dossier personnalisé de stockage des fichiers JSON locaux (défaut : `.shiori-data/`) |

---

## 🗄️ Base de données Supabase

Le schéma PostgreSQL complet se trouve dans `supabase/schema.sql`, complété par la migration incrémentale non destructive `supabase/migrations/20261123_shiori_v2_enhancements.sql`.

### Tables principales (14 tables protégées par RLS)
- **Utilisateurs & bibliothèque** : `profiles`, `library_entries`, `user_collections`, `user_badges`, `user_anilist_stats`
- **Social & messagerie** : `friendships`, `activity_events`, `activity_likes`, `activity_comments`, `direct_messages`, `notifications`
- **Traduction & modération** : `media_translations`, `user_blocks`, `content_reports`

### Initialisation sur un nouveau projet Supabase
1. Ouvrez le **SQL Editor** de votre projet Supabase.
2. Exécutez `supabase/schema.sql` pour créer les tables, index et politiques RLS de base.
3. Exécutez `supabase/migrations/20261123_shiori_v2_enhancements.sql` pour activer la fonction `public.is_pair_blocked()`, les politiques de blocage bilatéral, les tables de modération et les règles RLS renforcées.

---

## 🛡️ Architecture API & Sécurité

- **En-têtes HTTP de sécurité** (`next.config.ts`) : `Strict-Transport-Security` (HSTS preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, suppression de `X-Powered-By`, et `Cache-Control: no-store` sur toutes les routes `/api/*`.
- **Isolation par utilisateur** : vérification systématique de la session sur les routes privées, politiques RLS PostgreSQL et blocage mutuel appliqué aux profils, demandes d'amis et messages privés.
- **Protection contre les abus** : limiteur de débit côté serveur (`src/lib/server/rate-limit.ts`) sur l'authentification, les interactions sociales, la traduction et la messagerie.
- **Assainissement HTML** : liste blanche stricte des balises de mise en forme (`<br>`, `<i>`, `<em>`, `<b>`, `<strong>` sans attributs) dans `src/lib/i18n.ts`.
- **Cookies sécurisés** : `httpOnly`, `sameSite`, et `secure` automatique en production (`NODE_ENV=production`) pour les sessions et tokens AniList OAuth.

---

## 🧪 Tests automatisés

La suite `tests/shiori-core.test.ts` couvre 11 scénarios critiques :
- Calcul de progression (`clampProgress`, auto-complétion, promotion `PLAN_TO_WATCH`, pourcentages sûrs)
- Filtrage & tri combinés de la bibliothèque et échappement CSV RFC-4180
- Analytique des statistiques & génération du **Shiori Wrapped**
- Conversions de fuseaux horaires du calendrier (`UTC` vs `JST` au passage de minuit)
- Algorithme de compatibilité & recommandations sans doublons
- Évaluation déterministe des 39 badges et normalisation des langues
- Test de charge et de résilience aux données manquantes sur une bibliothèque de **2 000 entrées**

```bash
npm run typecheck && npm run lint && npm test
```
