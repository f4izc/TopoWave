# VHF-SHF Path Profiler - PRD

## Original Problem Statement
Application web "Stateless" (sans base de données) nommée "VHF-SHF Path Profiler" pour radioamateurs avec:
- Saisie de deux Maidenhead Grid Locators et hauteurs d'antennes AGL
- Conversion des locators en coordonnées décimales
- Calculs géodésiques: distance (Haversine) et azimut (Great Circle)
- Profil d'élévation via API Open-TopoData (SRTM 30m)
- Modélisation radio avec facteur K (4/3 Earth, Reff=8500km)
- Analyse d'obstruction et ligne de visée
- Zone de Fresnel optionnelle pour bandes amateur (2m, 70cm, 21cm, 13cm, 3cm)
- Interface tactique sombre

## User Personas
- **Radioamateurs VHF/UHF/SHF**: Utilisateurs techniques qui planifient des liaisons radio et ont besoin d'analyser la propagation entre deux points

## Core Requirements
1. ✅ Conversion Maidenhead → Lat/Lon (centre du carreau)
2. ✅ Calcul distance Haversine
3. ✅ Calcul azimut Great Circle (bidirectionnel)
4. ✅ Échantillonnage N points (configurable, défaut 50)
5. ✅ API élévation Open-TopoData (SRTM 30m)
6. ✅ Modèle Terre 4/3 (Reff = 8500 km)
7. ✅ Ligne de visée avec correction courbure
8. ✅ Détection obstruction avec indicateur CLEAR/OBSTRUCTED
9. ✅ Zone de Fresnel pour bandes 2m/70cm/21cm/13cm/3cm
10. ✅ Graphique Plotly.js (terrain + LoS + Fresnel)
11. ✅ Persistance localStorage
12. ✅ Interface tactique sombre

## What's Been Implemented (March 2026)
- Backend FastAPI complet avec tous les calculs radio
- Frontend React avec thème tactique (JetBrains Mono + Rajdhani)
- Graphique Plotly.js avec terrain, ligne de visée, zone Fresnel
- Dashboard métriques (distance, azimuts, altitude, status)
- Validation des locators Maidenhead (4-8 caractères)
- Persistance localStorage des paramètres
- Gestion erreurs API élévation

## Tech Stack
- Backend: Python/FastAPI
- Frontend: React + Tailwind CSS + Plotly.js
- API externe: Open-TopoData (SRTM 30m)
- Pas de base de données (stateless)

## Prioritized Backlog

### P0 - Completed
- Tous les requirements de base implémentés

### P1 - Future Enhancements
- Export PDF du profil
- Historique des calculs (localStorage)
- Mode hors ligne avec cache élévation

### P2 - Nice to Have
- Carte interactive pour sélection des points
- Calcul multi-hop (relais)
- Intégration données météo pour réfraction

## Next Tasks
- Amélioration UX mobile (responsive)
- Export des résultats (CSV/JSON)
