# TopoWave Backend

Backend FastAPI pour l'application TopoWave - Profil de terrain VHF/SHF.

## Dépendances

Le backend utilise uniquement 5 packages essentiels :

| Package | Version | Usage |
|---------|---------|-------|
| `fastapi` | 0.115.12 | Framework API REST |
| `uvicorn` | 0.34.2 | Serveur ASGI |
| `python-dotenv` | 1.1.0 | Variables d'environnement |
| `httpx` | 0.28.1 | Client HTTP async (Open-TopoData) |
| `pydantic` | 2.11.3 | Validation des données |

## Déploiement Render

Ce backend est configuré pour être déployé sur Render.com en tant que Web Service.

### Configuration Render

| Paramètre | Valeur |
|-----------|--------|
| **Runtime** | Python |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

### Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `CORS_ORIGINS` | Origines autorisées (séparées par virgule) | `https://topowave.onrender.com` |

### Health Check

L'endpoint `/api/` retourne le statut de l'API et peut être utilisé pour le health check.

## API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/` | Informations API |
| `GET` | `/api/bands` | Liste des bandes amateur |
| `POST` | `/api/calculate-path` | Calcul du profil de terrain |

### Exemple de requête

```bash
curl -X POST https://topowave-api.onrender.com/api/calculate-path \
  -H "Content-Type: application/json" \
  -d '{
    "locator_a": "JN18DU55",
    "locator_b": "IN96GC45",
    "height_a": 10,
    "height_b": 15,
    "num_points": 50,
    "band": "2m"
  }'
```

## Développement local

```bash
# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
uvicorn server:app --reload --port 8001
```

Le serveur sera accessible sur `http://localhost:8001`

## Structure

```
backend/
├── server.py           # Application FastAPI principale
├── requirements.txt    # Dépendances Python (5 packages)
├── .env               # Variables d'environnement (local)
└── README.md          # Ce fichier
```
