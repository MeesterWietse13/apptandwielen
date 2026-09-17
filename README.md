# Tandwielenlab

Een interactieve leeromgeving waarin leerlingen tandwielen, kettingoverbrengingen en samengestelde machines bouwen, testen en onderzoeken.

## Zones

- Ontdekzone voor vrij bouwen en experimenteren
- Labzone met begeleide ontdekopdrachten
- Buildzone met bouwuitdagingen
- Mijn ontdekkingen met de voortgang van de leerling

De app bewaart de persoonlijke voortgang lokaal in de browser. De gedeelde machinegalerij kan optioneel met PostgreSQL worden verbonden.

## Lokaal starten

```bash
npm install
npm run dev
```

Open daarna `http://localhost:3000`.

## Controle

```bash
npm run lint
npm run typecheck
npm run test:mechanics
npm run test:missions
npm run build
```

## Optionele database

Kopieer `.env.example` naar `.env.local` en vul `DATABASE_URL` in om de gedeelde machinegalerij te activeren. Zonder database blijft de simulator volledig bruikbaar.

