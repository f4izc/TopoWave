# TopoWave Frontend

Interface React pour l'application TopoWave - Profil de terrain VHF/SHF.

## Déploiement Render

Ce frontend est configuré pour être déployé sur Render.com en tant que Static Site.

### Variables d'environnement requises

| Variable | Description | Exemple |
|----------|-------------|---------|
| `REACT_APP_BACKEND_URL` | URL du backend API | `https://topowave-api.onrender.com` |

### Commandes

- **Build**: `yarn install && yarn build`
- **Output**: `build/`

## Développement local

```bash
yarn install
yarn start
```

L'application sera accessible sur `http://localhost:3000`

## Technologies

- React 19
- Tailwind CSS
- Plotly.js (graphiques)
- Leaflet (carte)
- Shadcn/UI (composants)
