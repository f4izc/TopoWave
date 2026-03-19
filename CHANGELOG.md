# Changelog

Toutes les modifications notables de TopoWave sont documentées ici.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.3.0] - 2026-03-19

### Ajouté
- **Message de réveil serveur** : Indication visuelle quand le backend se réveille (plan gratuit Render)
- Configuration pour déploiement Render (render.yaml)
- README séparés pour frontend et backend
- Documentation de déploiement complète
- Timeout 60s pour les requêtes API (cold start)

### Modifié
- Structure du projet optimisée pour déploiement multi-services
- Meilleure gestion des erreurs réseau

---

## [1.2.0] - 2026-03-19

### Ajouté
- **Lien de partage** : Bouton dans le header pour générer une URL avec tous les paramètres
- **Locators 10 caractères** : Support AA00aa00aa pour précision ~3m
- **Recherche d'adresse** : Barre de recherche OpenStreetMap dans la carte
- Dialogue de partage avec copie dans le presse-papier

### Modifié
- Validation des locators : 6-10 caractères (au lieu de 4-8)
- Carte affiche le locator 10 caractères par défaut
- Labels mis à jour "LOCATOR (6-10 CAR.)"

---

## [1.1.0] - 2026-03-19

### Ajouté
- **Carte interactive** : Sélection des positions via Leaflet avec tuiles CARTO sombres
- Boutons map picker (📍) à côté des champs locator
- Conversion automatique coordonnées → locator Maidenhead

### Modifié
- **Renommage** : "VHF-SHF Path Profiler" → "TopoWave"
- **Bouton calculer** : Texte noir sur fond vert (meilleure visibilité)
- **Status OBSTRUCTED** : Affiché en rouge
- **Status CLEAR** : Affiché en vert
- Interface responsive mobile complète

### Corrigé
- Visibilité du texte du bouton en état désactivé

---

## [1.0.0] - 2026-03-19

### Ajouté
- **Calculs géodésiques** : Distance Haversine, Azimut Great Circle bidirectionnel
- **Profil d'élévation** : Échantillonnage N points via API Open-TopoData (SRTM 30m)
- **Modèle Terre 4/3** : Réfraction atmosphérique VHF+ (Reff = 8500 km)
- **Ligne de visée** : Analyse d'obstruction avec indicateur CLEAR/OBSTRUCTED
- **Zone de Fresnel** : Calcul pour bandes 2m, 70cm, 21cm, 13cm, 3cm
- **Graphique Plotly** : Visualisation terrain + LoS + Fresnel
- **Thème tactique** : Interface sombre style "Night Ops"
- **Persistance** : LocalStorage pour mémoriser les paramètres
- Validation des locators Maidenhead
- Points d'échantillonnage configurables (10-200)

### Technique
- Backend FastAPI (Python)
- Frontend React 19 + Tailwind CSS
- Plotly.js pour visualisation
- API Open-TopoData pour élévation (gratuit)
