#!/bin/bash
# À exécuter sur le VPS après git push (connexion : ssh root@<IP>)
set -e
cd ~/fab
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# Si de nouvelles migrations Prisma ont été ajoutées :
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
echo "Déploiement terminé."
