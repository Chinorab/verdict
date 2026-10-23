# PROGRESS — Verdict (YouCam Skin AI hackathon)

Deadline Devpost : 2026-11-02 11:45 EST. Jugement 2026-11-03 → 2026-11-20 11:45 EST (app en ligne, gratuite, sans restriction jusque-là).
Devpost slug : youcam-api-skin-ai-ecommerce. Pas de tracks (4 critères, note /5). France éligible.
Formulaire Devpost : 3 questions obligatoires en plus (surprise API, industries non exploitées, mur technique) → à préparer dans DEVPOST.md.
Repo : Chinorab/verdict, projet Vercel « verdict ».

## Décisions (2026-10-17)
- Privacy : garder la mise en page de la maquette, réécrire le texte (photo → notre serveur → YouCam, rien stocké chez nous, 24 h chez YouCam, pas de compte).
- Seuil de bruit : multiplicateur fixé APRÈS calibration (1x / 1,5x / 2x), justifié dans le README.
- Stats accueil : garder UNL 2015 + FDA + Dermatology Times + JAMA, mais seulement celles vérifiées en ligne ; trouver l'URL exacte Dermatology Times (633 marques).
- Trial de démo : jour 0 lancé via `/scripts` (vraies analyses, vraies dates) dès que l'utilisateur dépose photos + clé, jours 7 et 14 dans l'app, import des données dans l'app. Trial 14 jours → doit commencer au plus tard le 19 oct.
- L'utilisateur a le produit réel (nom à demander ; pas de marque visible dans la vidéo).

## Fait
- Maquettes téléchargées : `design/project/*.dc.html` (13 écrans, artifact 2hA4GmEmYxV25NBTAUcGsY). Tokens : fond #F3F4F1, encre #141716, bleu #2B45C4 / #7C93FF, orange alerte #B4460E, Hanken Grotesk + JetBrains Mono, angles droits.
- `.specify/` installé, `git init` (rien commité), constitution v1.0.0.
- Skill `skin-analysis-expert` installée dans ~/.claude/skills (clone inspecté, pas de npx distant) + zip dans claude-skills-zip-nouveaux.
- Scripts `/scripts` écrits et testés à blanc : `cost.mjs` (gratuit), `analyze.mjs` (dry run par défaut, `--confirm` pour payer, sauvegarde JSON + masques, ledger d'unités), `noise.mjs` (écarts raw/ui). Protocole dans `scripts/README.md`.

## Faits API à retenir
- Serveur unique `https://yce-api-01.makeupar.com`. Tâche = `/s2s/v2.1/task/skin-analysis` (v2.1, pas v2.0). Upload `/s2s/v2.0/file` + PUT obligatoire.
- HD : côté court >= 1080 px ; SD >= 480. Visage > 60 % de la largeur. < 10 Mo. jpg/png.
- Unités débitées seulement si succès. Coût par palier SD/HD et nombre de concerns : via `cost.mjs`.
- `raw_score` : sens peut différer de `ui_score` → déterminer le sens par concern pendant la calibration.
- Endpoints gratuits : `/s2s/v1.0/client/credit`, `/s2s/v2.0/credit/feature-cost`.

## Étape en cours
En attente : l'utilisateur dépose 3 photos (A, B à la suite, C après repositionnement) dans `scripts/photos/` et `YOUCAM_API_KEY` dans `.env.local`. Puis : `cost.mjs` → dry run → `--confirm` (jour 0 = calibration = début du trial démo) → `noise.mjs`.
speckit-specify FAIT (2026-10-17) : specs/001-measured-skincare-trial/spec.md, checklist OK. Décision mode juge : quick run (check-in immédiat, étiqueté « Same day test », 3 analyses) + trial démo, les deux sur l'accueil. speckit-clarify FAIT (2026-10-17), 4 questions : Keep/Return selon la promesse principale ; garde-fou dès le 1er check-in dégradé puis escalade « Consider pausing » ; export/import de sauvegarde locale (photos en option, même format que les scripts) ; 5 analyses réussies par appareil et par jour + plafond global calculé sur le coût réel. speckit-plan FAIT (2026-10-17) : plan.md, research.md, data-model.md, contracts/api.md + backup-file.md, quickstart.md. speckit-tasks FAIT (2026-10-17) : tasks.md, 89 tâches (T001-T007 = calibration, attend photos + clé). Démo publique SANS photo de visage (décision utilisateur), masques + chiffres. speckit-analyze FAIT + toutes les corrections appliquées (2026-10-17) : constitution v1.1.0 (upload direct navigateur → URL pré-signée YouCam autorisé ; plafond global = ligne de rythme + plafond journalier via /s2s/v1.0/client/credit/history ; règle « pas d'IA » limitée à l'UI). Seuil affiché sur la carte review et l'alerte santé. Check-ins fixés (0,7,14 / 0,7,14,21,28 / 0,14,28,42,56). Terme unique « check-in ». tasks.md = 91 tâches ; nouvelles : T012 sonde Camera Kit sur téléphone (taille réelle des captures, décide HD/SD), T033 évaluation lecture d'étiquettes sur 10 vraies étiquettes (SC-002). Prochaine étape : T012 (sonde Camera Kit sur téléphone, demande un déploiement preview Vercel) puis T044/T046 ; code sans clé : terminé ; calibration T001-T007 dès photos + clé.

## Découvertes du plan (2026-10-17)
- Camera Kit : global YMK, `#YMK-module` obligatoire, init({faceDetectionMode:'skincare', qualityLevel:'strict', videoQuality:'1080p', imageFormat:'blob'}) → 1920x1080 donc HD possible ; événements faceQualityChanged (hasFace/position/frontal/lighting) et faceDetectionCaptured. Aucune clé côté navigateur.
- Rétention YouCam : fichiers uploadés + task_id gardés 30 JOURS (page File Retention), pas de route de suppression → page privacy doit le dire (le brief disait 24 h).
- Rate limit YouCam : 250 req / 300 s par IP et par token.
- Upload : le navigateur PUT direct sur l'URL pré-signée YouCam (le visage ne passe pas par notre serveur) ; proxy en secours si CORS bloque. À vérifier au 1er vrai test.
- Plafonds sans base de données : cookie signé (5 analyses/jour/appareil, 10 lectures d'étiquette) + ligne budgétaire basée sur l'endpoint gratuit de solde.
- Rappels = fichier .ics avec alarmes (pas de push web).
- Démo publique : pas de photo de visage (décidé 2026-10-17).

## Implémentation (2026-10-17)
- FAIT : T008-T011, T013, T014-T027 (Phase 1 hors calibration + Phase 2). Next 16.4.2, React 19.3.1, Zod 4, idb, Phosphor (light), server-only, vitest 5, Playwright 1.64. Tests unitaires budget 11/11, tsc OK, eslint OK, lint:copy OK, build OK, aucun secret dans .next/static.
- Serveur preview : config « verdict-dev » ajoutée dans D:/claude/.claude/launch.json (port 3762).
- Accueil provisoire (src/app/page.tsx) d'après Main.dc.html, sans stats (attendent T081).
- /api/budget renvoie 503 propre tant que .env.local manque (VERDICT_COOKIE_SECRET, BUDGET_*).
- Phase 3 (US1) FAIT 2026-10-17 : T029-T032, T034-T037. schedule.ts (17 tests), claims.ts (Sonnet 5.5 + fallbacks "default"), /api/claims, écrans Scan + Claims, note JAMA vérifiée (6/18 produits avec clobetasol non déclaré, digest Dermatology Times du 14 oct). E2E new-trial : 6/6 OK mobile+desktop, 2 ignorés (chemin scan = attend une vraie lecture d'étiquette enregistrée). Bug corrigé : « N days before » affichait la marge au lieu de l'écart réel.
- Phase 4 partielle FAITE 2026-10-17 : T039, T040, T041, T042, T045, T047. baseline.ts (moyenne, bruit, seuil = max(k x bruit, plancher), choix SD/HD), config.ts à null tant que la calibration n'a pas tourné (refus de deviner), routes /api/analysis/upload et /api/analysis/task(+[taskId]) avec jeton lié à l'appareil et remboursement unique en cas d'échec, analyze-client.ts (PUT direct vers YouCam, polling 4 s, stockage immédiat des scores + masques, reprise sans repayer), addCapture/finishDay0. 45 tests unitaires OK.
- RESTE Phase 4 : T043 (proxy si CORS, dépend de T006), T044 + T046 (Camera Kit + écran capture, dépendent de T012 sonde téléphone), T048 (e2e jour 0, fixtures).
- Phase 6 (US4 verdict) FAITE 2026-10-17 : T054-T056. verdict.ts (statut par cible, strictement au-delà du seuil, suggestion selon promesse principale, aucune après la date limite), écran verdict fidèle à la maquette (barre de bruit, détail « score ±x points, threshold ±y », boutons Return/Keep enregistrés), trial-data.ts. 60 tests unitaires, e2e 8 OK / 6 ignorés (scan + verdict calibré). Les cas Keep/Return e2e passent avec une config temporaire (vérifié puis retiré) : ils s'activeront seuls quand config.ts sera rempli (T004).
- Tant que src/lib/measure/config.ts est à null, l'écran verdict affiche « measurement settings are still being calibrated » (voulu).
- e2e : tests/e2e/seed.ts injecte un trial dans IndexedDB (dates de la maquette).
- Phase 5 (US3) FAITE 2026-10-17 sauf T052 : ics.ts (fichier calendrier RFC 5545, alarmes à l'heure choisie + date limite à 9 h), timeline.ts (états done/partial/due/late/upcoming ; une seule photo par jour : le bouton vise le check-in dû le plus récent, les semaines manquées restent « missed »), écran timeline d'après la maquette (compte à rebours, règle de progression, lignes, heure de rappel modifiable, « Add to calendar »). Ligne maquette « Light matched within 3% » retirée (aucune mesure réelle). 77 tests unitaires, e2e 14 OK / 6 ignorés.
- T052 BLOQUÉ par l'écran capture (T044/T046 ← sonde T012).
- Phase 7 (US9) FAITE 2026-10-17 : page privacy réécrite d'après les vrais flux (photo → YouCam directement, rétention YouCam 30 j fichiers/tâches et 24 h résultats avec liens, étiquette → Anthropic, cookie de quota, pas de compte, jamais vendu), bouton « Delete all trial data » avec dialogue de confirmation (/privacy et /settings), bannière si le navigateur bloque le stockage, jeton --on-deadline pour le contraste en mode sombre. e2e 24 OK / 6 ignorés, 77 tests unitaires.
- Si T006 montre que le PUT direct est bloqué (CORS), réécrire la phrase « It never receives or keeps the photo ».
- Phase 11 (US7 garde-fou) FAITE 2026-10-17 sauf e2e en attente de calibration : guardrail.ts (rougeurs + acné ; niveau 1 au premier dépassement, niveau 2 si le check-in suivant confirme, retour à 0 si ça redescend), SafetyNotice d'après Safety.dc.html (lectures + seuil, conseils calmes, « not a diagnosis », Pause/Resume, Find a dermatologist → find-a-derm.aad.org, Keep measuring), affiché en premier sur timeline et verdict. Pas de mention « chin » (scores visage entier). 85 tests unitaires ; e2e 24 OK / 14 ignorés (verdict + garde-fou calibrés : vérifiés une fois avec config temporaire puis retirée).
- Contact privacy : issues GitHub, validé par l'utilisateur 2026-10-17.
- SESSION « continue sans t'arrêter » 2026-10-17 : FAIT T007 (to-backup.mjs + trial-setup.example.json), Phase 8 quick run (T062-T063), Phase 9 compare (T065-T067), Phase 10 carte review + lien partagé (T068-T070), Phase 12 backup export/import + /demo (T076-T078), landing sourcée (T081-T082), README, DEVPOST.md, docs/video-script.md (T084-T086). 102 tests unitaires ; e2e 45 OK sans config, 60 OK avec config temporaire (retirée).
- Stats landing vérifiées : 47 % de 633 marques (M11, Dermatology Times 13 oct 2026), 6/18 produits avec clobetasol non déclaré (JAMA Netw Open via DT 14 oct), 18 % (UNL 2015), FDA sans approbation.
- IMPORTANT DÉMO : un trial avec promesse 4 semaines et fenêtre 30 j donne un verdict le 12 nov (après le rendu). Le trial démo doit être plafonné à 14 jours : maxTrialDays=14 dans trial-setup.json → jour 0 le 18 oct, check-in 25 oct, verdict 1er nov.
- Bug corrigé : la regex de lint-copy bloquait 60 s+ (backtracking catastrophique) → motif linéaire.
- T083 revue Web Interface Guidelines FAITE + test 360 px.
- RESTE sans clé/photos : rien d'important ; tout le reste dépend de T001-T006 (photos + clés), T012 (sonde Camera Kit, déploiement preview), T044/T046 (écran capture), puis déploiement.
- GIT 2026-10-17 : premier commit 4ecdd42 sur main (178 fichiers, aucun secret ni photo), dépôt https://github.com/Chinorab/verdict créé en PRIVÉ (à passer en public avant la soumission : gh repo edit Chinorab/verdict --visibility public --accept-visibility-change-consequences). Identité git locale au dépôt = 196051630+Chinorab@users.noreply.github.com. .gitattributes force LF.
- 2026-10-22 : le jour 0 du 18 oct n'a pas eu lieu (pas de selfies ni de clés). Visages SYNTHÉTIQUES générés via codex-imagegen (personne fictive) dans scripts/photos/synthetic/ (a, b, c ; 1086x1448, HD ok ; README dedans). Usage limité : tester la chaîne YouCam (upload, CORS, coût, format, sens des raw_score, déterminisme) et enregistrer des fixtures. Ce n'est PAS un bruit caméra valide ni un trial réel. Everygen : abonnement inactif (402).
- Toujours bloquant : YOUCAM_API_KEY (+ ANTHROPIC_API_KEY) dans .env.local.
- 2026-10-22 DÉCISION UTILISATEUR : vrai trial court de 7 jours. Jour 0 = aujourd'hui 22 oct (3 selfies A/B/C), check-in = verdict le 29 oct (1 selfie). trial-setup.json avec "maxTrialDays": 7 → schedule [0, 7], avertissement de délai affiché (vérifié avec planTrial). .env.local CRÉÉ par Claude (clé cookie générée, clés API vides : l'utilisateur doit coller YOUCAM_API_KEY et ANTHROPIC_API_KEY) ; aucun .env.local n'existait avant.
- 2026-10-22 CLÉS OK (YouCam 67 car., Anthropic 106 car. ; jamais affichées). Solde : 1040 unités (1000 + 40 offertes). Prix v2.1 par analyse : HD 12 (1-4 concerns) / 16 (5-8) / 20 (9-12) / 22 (13-16) ; SD 9/12/14/16.
- Plan budget : calibration jour 0 A+B+C en HD 12 concerns = 60 u (A et B servent aussi de jour 0 du trial démo) ; check-in 29 oct ≈ 20 u ; réserve reprises 40 u ; tests chaîne ≈ 60 u ; reste ≈ 860 u pour le jury (quick run = 3 analyses à ~12 u = 36 u, soit ~24 juges ; plafond 5/jour/appareil).
- Historique crédits (/s2s/v1.0/client/credit/history) : exige Content-Type JSON même en GET ; forme = result.history[] {timestamp ms, action, info.credits[{amount, amount_dec}]}. src/lib/youcam.ts lit la mauvaise clé (results/histories) → à corriger après avoir vu une entrée de consommation réelle.
- 2026-10-22 TEST CHAÎNE SYNTHÉTIQUE (accord utilisateur, « No real trial for now ») : 3 analyses HD 12 concerns sur scripts/photos/synthetic a/b/c = 60 u (solde 980). Résultats dans scripts/out/synthetic (gitignoré). Appris : raw et ui vont dans le même sens 28/28 → raw = « plus haut = mieux » ; ui ≫ raw (pores raw 12-20 / ui 51-54) ; pores et rides renvoyés par région + `whole` (Verdict prend whole) ; entrées all/skin_age/resize_image ; masques en JPEG ; historique crédits : action api_skin_analysis_hd_v2, amount -20, Content-Type JSON obligatoire même en GET.
- CODE corrigé : youcam.ts (régions → whole uniquement, entrées sans raw ignorées ; unitsSpentSince lit result.history et somme les montants négatifs, pagination) ; noise.mjs (régions) ; budget-core (bug : au départ de la ligne, 1re analyse refusée → marge d'un plafond journalier ; test ajouté). /api/budget testé en réel : globalOpen true.
- config.ts REMPLI : sens raw MESURÉS ; k = 1.5 et plancher 1 point = valeurs par défaut de conception, étiquetées « non calibrées sur vraies photos » (code + README). Les tests calibrés tournent maintenant : 103 unitaires, e2e 62 OK / 4 ignorés.
- Fixture tests/fixtures/youcam/task-success-hd.json enregistrée (synthétique, chiffres seuls). README « What we learned » + DEVPOST Q1 remplis avec faits réels.
- PAS de trial réel pour l'instant (décision utilisateur). /demo affiche « still running » ; à trancher avant la vidéo : vrais selfies OU pas de trial auteur.
- 2026-10-23 T012 EN COURS : page jetable src/app/probe/kit (Camera Kit skincare, choix conteneur défaut / 1080x1920, 1080p / 1920p, strict / moderate ; affiche taille rapportée ET décodée, bouton « Copy results »). Testée en local : SDK charge, kit rendu dans la page (pas d'iframe tierce), « unsupportedResolution » sans webcam 1080p (attendu).
- VERCEL : projet anas02-projects/verdict lié (.vercel/ gitignoré), .vercelignore exclut .env*, scripts/photos, scripts/out, tests. Git DÉCONNECTÉ (vercel link l'avait connecté tout seul). AUCUNE variable d'env sur Vercel pour l'instant. 1er déploiement marqué production par Vercel : alias public verdict-ashen-seven.vercel.app SUPPRIMÉ ; restent verdict-l7h8bjysl-anas02-projects.vercel.app et verdict-anas02-projects.vercel.app, protégés (302 login Vercel). Lien de partage MCP refusé (403, connecteur sans accès au projet). Vérif sans navigateur : `MSYS_NO_PATHCONV=1 vercel curl /probe/kit --deployment <url>`.
- ATTENTION futur déploiement prod : `vercel deploy --prod` réattribuera un alias public ; ne le faire qu'au moment du lancement (T089).
- EN ATTENTE : T033 (10 étiquettes + clé Anthropic), T038 chemin scan, T028 fixtures.
- Chromium 1248 installé pour Playwright 1.64. Lancer les e2e contre le serveur dev : E2E_BASE_URL=http://localhost:3762 npx playwright test
- PARTIEL : T028 (fixtures) → attend la vraie calibration T002.
- À VÉRIFIER au 1er appel réel : forme de la réponse /s2s/v1.0/client/credit/history (unitsSpentSince dans src/lib/youcam.ts lit défensivement).
- Next 16 : lire node_modules/next/dist/docs avant d'écrire (AGENTS.md) ; LayoutProps vient de `npx next typegen`.

## Prochaines étapes
1. Jour 0 réel + calibration, consigner dans README « What we learned from the API »
2. speckit-implement → analyze
3. implement, tests playwright-cli mobile + desktop, deploy-to-vercel
4. README, DEVPOST.md, script vidéo, 5 captures
