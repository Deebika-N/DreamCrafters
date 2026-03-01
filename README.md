# DreamCrafters
Activity Point Program

## **MERN Scaffold**

This workspace contains a minimal MERN stack scaffold under `backend/` and `frontend/`.

**Files created**:
- [backend](backend)
- [frontend](frontend)

**Quick start**:
1. Backend: install and run (from `backend`)

```powershell
cd backend
npm install
# set MONGO_URI in .env or use local MongoDB
npm run dev
```

2. Frontend: install and run (from `frontend`)

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the backend API at `http://localhost:5000/api` by default. Set `VITE_API_URL` in `frontend/.env` to change it.
