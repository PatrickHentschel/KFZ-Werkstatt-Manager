# WerkstattClone — Demo Zugangsdaten

## App URLs

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:5273        |
| Backend   | http://localhost:3009        |
| Health    | http://localhost:3009/health |

## Login

| Feld     | Wert                        |
|----------|-----------------------------|
| E-Mail   | owner@demo-werkstatt.at     |
| Passwort | demo1234                    |
| Rolle    | owner                       |

## Werkstatt

| Feld     | Wert                        |
|----------|-----------------------------|
| Name     | Demo Werkstatt GmbH         |
| Land     | Österreich (AT)             |
| MwSt     | 20 %                        |
| Prefix   | RE                          |

## Docker starten

```bash
# Starten
docker-compose up -d

# Datenbank einrichten (nur beim ersten Start)
docker-compose exec backend npm run db:generate
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run db:seed

# Logs
docker-compose logs -f

# Stoppen
docker-compose down
```
