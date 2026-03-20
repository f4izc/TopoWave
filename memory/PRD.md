# TopoWave - PRD

## Original Problem Statement
Application web "Stateless" (sans base de données) nommée "TopoWave" (anciennement VHF-SHF Path Profiler) pour radioamateurs avec:
- Saisie de deux Maidenhead Grid Locators et hauteurs d'antennes AGL
- Conversion des locators en coordonnées décimales
- Calculs géodésiques: distance (Haversine) et azimut (Great Circle)
- Profil d'élévation via API Open-TopoData (SRTM 30m)
- Modélisation radio avec facteur K (4/3 Earth, Reff=8500km)
- Analyse d'obstruction et ligne de visée
- Zone de Fresnel optionnelle pour bandes amateur (6m, 4m, 2m, 1.25m, 70cm, 21cm, 13cm, 3cm)
- Interface tactique sombre
- Carte interactive pour sélection des positions (Leaflet)
- Responsive mobile

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
9. ✅ Zone de Fresnel pour bandes 6m/4m/2m/1.25m/70cm/21cm/13cm/3cm
10. ✅ Graphique Plotly.js (terrain + LoS + Fresnel)
11. ✅ Persistance localStorage
12. ✅ Interface tactique sombre
13. ✅ Carte interactive Leaflet pour sélection positions
14. ✅ Responsive mobile
15. ✅ Saisie multi-mode: Locator, Adresse, ou GPS

## What's Been Implemented

### Version 1.0 (March 2026)
- Backend FastAPI complet avec tous les calculs radio
- Frontend React avec thème tactique (JetBrains Mono + Rajdhani)
- Graphique Plotly.js avec terrain, ligne de visée, zone Fresnel
- Dashboard métriques (distance, azimuts, altitude, status)
- Validation des locators Maidenhead (6-10 caractères)
- Persistance localStorage des paramètres

### Version 1.2 - Partage & Précision
- Lien de partage avec paramètres URL (?a=...&b=...&ha=...&hb=...&n=...&band=...)
- Locators 6-10 caractères (AA00aa, AA00aa00, AA00aa00aa) pour plus de précision
- Carte affiche locator 10 caractères (précision ~3m)
- Recherche d'adresse dans la carte (OpenStreetMap Nominatim)

### Version 1.3 - Interface à onglets (March 20, 2026)
- Interface de saisie à onglets pour chaque station (A et B)
- **Onglet Locator**: Saisie directe du locator Maidenhead + sélection sur carte
- **Onglet Adresse**: Recherche géocodage via proxy backend (Nominatim)
- **Onglet GPS**: Saisie directe des coordonnées Lat/Lon avec conversion automatique en locator
- Ajout endpoint `/api/geocode` pour éviter les problèmes CORS
- Ajout des data-testid pour tous les éléments interactifs des onglets
- Correction du bug de z-index pour le dialogue de carte

## Tech Stack
- Backend: Python/FastAPI
- Frontend: React + Tailwind CSS + Plotly.js + Leaflet
- API externes: 
  - Open-TopoData (SRTM 30m) pour élévation
  - OpenStreetMap Nominatim pour géocodage (via proxy backend)
- Pas de base de données (stateless)

## Prioritized Backlog

### P0 - Completed
- ✅ Tous les requirements de base implémentés
- ✅ Corrections UI et responsive mobile
- ✅ Interface à onglets (Locator, Adresse, GPS)

### P1 - Next Tasks
- Auto-calcul lors du chargement avec paramètres URL de partage
- Export des résultats (CSV/PDF)

### P2 - Nice to Have
- Calcul multi-hop (relais)
- Intégration données météo pour réfraction
- Historique des calculs (localStorage)
- Mode hors ligne avec cache élévation

## API Endpoints
- `GET /api/`: Health check
- `GET /api/bands`: Liste des bandes radioamateur
- `GET /api/geocode?q=<address>`: Proxy géocodage Nominatim
- `POST /api/calculate-path`: Calcul du profil de terrain
