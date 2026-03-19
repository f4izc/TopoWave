# TopoWave - VHF/SHF Path Profiler

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/Plotly.js-3.4-3F4F75?style=flat-square&logo=plotly" alt="Plotly">
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet" alt="Leaflet">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

**TopoWave** est une application web pour radioamateurs permettant d'analyser la propagation radio VHF/UHF/SHF entre deux stations. Elle calcule le profil de terrain, la ligne de visée et détecte les obstructions potentielles.

![TopoWave Screenshot](https://via.placeholder.com/800x400/050505/00FF41?text=TopoWave+Terrain+Profile)

## Fonctionnalités

### Calculs Radio
- **Conversion Maidenhead** : Support des locators 6 à 10 caractères (précision de ~5km à ~3m)
- **Distance & Azimut** : Calcul géodésique Haversine et Great Circle
- **Modèle Terre 4/3** : Réfraction atmosphérique VHF+ (Reff = 8500 km)
- **Ligne de Visée (LoS)** : Analyse d'obstruction avec indicateur CLEAR/OBSTRUCTED
- **Zone de Fresnel** : Calcul pour les bandes 2m, 70cm, 21cm, 13cm, 3cm

### Interface
- **Thème tactique sombre** : Interface style "Night Ops" optimisée pour les radioamateurs
- **Graphique interactif** : Visualisation Plotly avec terrain, LoS et zone de Fresnel
- **Carte interactive** : Sélection des positions avec recherche d'adresse (OpenStreetMap)
- **Responsive** : Adapté mobile et desktop
- **Partage** : Génération de liens partageables avec paramètres pré-remplis

### Données
- **API Élévation** : Open-TopoData (SRTM 30m) - gratuite et sans clé API
- **Stateless** : Aucune base de données, persistance localStorage uniquement

## Technologies

### Frontend
| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 19.0 | Framework UI |
| Tailwind CSS | 3.4 | Styling |
| Plotly.js | 3.4 | Graphiques terrain |
| Leaflet | 1.9 | Carte interactive |
| Shadcn/UI | - | Composants UI |
| Lucide React | 0.507 | Icônes |

### Backend
| Technologie | Version | Usage |
|-------------|---------|-------|
| Python | 3.11 | Runtime |
| FastAPI | 0.110 | API REST |
| httpx | 0.28 | Client HTTP async |
| Pydantic | 2.6 | Validation données |

### APIs Externes
- **Open-TopoData** : Données d'élévation SRTM 30m (gratuit, ~100 req/jour)
- **OpenStreetMap Nominatim** : Géocodage pour recherche d'adresse

## Déploiement

### Option 1 : Render (Recommandé - Gratuit)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Forkez ce repository sur GitHub
2. Connectez-vous à [Render](https://render.com)
3. Cliquez sur "New" → "Blueprint"
4. Sélectionnez votre repository
5. Render détectera automatiquement le `render.yaml` et créera :
   - `topowave-api` : Backend FastAPI (Web Service gratuit)
   - `topowave` : Frontend React (Static Site gratuit)

**Note** : Le backend gratuit s'endort après 15min d'inactivité (~30s au réveil).

### Option 2 : Développement local

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

#### Frontend
```bash
cd frontend
yarn install
yarn start
```

L'application sera accessible sur `http://localhost:3000`

## Configuration

### Variables d'environnement

**Frontend** (`.env`)
```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Backend** (`.env`)
```env
CORS_ORIGINS=http://localhost:3000
```

## Utilisation

### Saisie manuelle
1. Entrez les locators Maidenhead des deux stations (6-10 caractères)
2. Définissez les hauteurs d'antennes AGL
3. Optionnel : sélectionnez une bande pour afficher la zone de Fresnel
4. Cliquez sur "CALCULER LE PROFIL"

### Sélection sur carte
1. Cliquez sur l'icône 📍 à côté du champ locator
2. Recherchez une adresse ou cliquez sur la carte
3. Le locator 10 caractères est automatiquement calculé

### Partage
1. Configurez votre profil
2. Cliquez sur l'icône de partage 🔗 dans le header
3. Copiez l'URL et partagez-la

## API Reference

### GET /api/
Retourne les informations de l'API.

### GET /api/bands
Retourne la liste des bandes amateur supportées.

### POST /api/calculate-path
Calcule le profil de terrain entre deux stations.

**Request Body:**
```json
{
  "locator_a": "JN18DU55IX",
  "locator_b": "IN96GC45AB",
  "height_a": 10,
  "height_b": 15,
  "num_points": 50,
  "band": "2m"
}
```

**Response:**
```json
{
  "station_a": { "locator": "JN18DU55IX", "latitude": 48.858, "longitude": 2.294, "elevation": 83 },
  "station_b": { "locator": "IN96GC45AB", "latitude": 42.123, "longitude": -3.456, "elevation": 450 },
  "distance_km": 416.26,
  "azimuth_ab": 225.9,
  "azimuth_ba": 43.1,
  "elevation_profile": [...],
  "is_clear": false,
  "obstruction_point": { "distance_km": 125.4, "elevation": 892 },
  "fresnel_clearance_percent": null,
  "band": "2m",
  "frequency_mhz": 144.0
}
```

## Format Maidenhead

| Longueur | Format | Précision | Exemple |
|----------|--------|-----------|---------|
| 6 | AA00aa | ~5 km | JN18DU |
| 8 | AA00aa00 | ~500 m | JN18DU55 |
| 10 | AA00aa00aa | ~3 m | JN18DU55IX |

## Développement

Ce projet a été développé avec [Emergent](https://emergent.sh), une plateforme de développement assistée par IA qui permet de créer des applications full-stack rapidement.

### Prérequis
- Node.js 18+
- Python 3.11+
- yarn

### Structure du projet
```
/app
├── backend/
│   ├── server.py          # API FastAPI
│   ├── requirements.txt   # Dépendances Python
│   └── .env              # Configuration
├── frontend/
│   ├── src/
│   │   ├── App.js        # Composant principal
│   │   ├── App.css       # Styles spécifiques
│   │   └── index.css     # Styles globaux + thème
│   ├── package.json      # Dépendances Node
│   └── .env              # Configuration
└── README.md
├── CHANGELOG.md          # Historique des versions
├── render.yaml           # Configuration Render Blueprint
```

## Roadmap

- [ ] Export PDF/CSV des profils
- [ ] Mode hors-ligne avec cache élévation
- [ ] Calcul multi-hop (relais)
- [ ] Intégration données météo pour réfraction avancée
- [ ] PWA pour installation mobile

## Licence

MIT License - Voir [LICENSE](LICENSE)

## Contact

**Développeur** : contact@fizc.com

---

<p align="center">
  <i>73 de TopoWave - Pour les radioamateurs, par les radioamateurs</i>
</p>
