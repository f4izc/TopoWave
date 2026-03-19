# TopoWave Backend

Backend FastAPI pour l'application TopoWave - Profil de terrain VHF/SHF.

## Déploiement Render

Ce backend est configuré pour être déployé sur Render.com en tant que Web Service.

### Variables d'environnement requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `CORS_ORIGINS` | Origines autorisées (séparées par virgule) | `https://topowave.onrender.com` |

### Commandes

- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Health Check

L'endpoint `/api/` retourne le statut de l'API et peut être utilisé pour le health check.

## API Endpoints

- `GET /api/` - Informations API
- `GET /api/bands` - Liste des bandes amateur
- `POST /api/calculate-path` - Calcul du profil de terrain

## Développement local

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```
