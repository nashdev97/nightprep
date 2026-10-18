# NightPrep

Prep sheet for an independent food truck. The owner enters tonight's stop. The app forecasts how many of each item to cook, finds a similar past night, and writes the sidewalk sign.

Open-weight Gemma writes the copy, so recipe notes and margins do not have to go through a closed chat model. TabPFN-3.5 forecasts units from the truck's own sales table. A general chatbot guesses. This fits the history.

## Flow

1. Forecast units (TabPFN-3.5, or a history mean when no key is set).
2. Hybrid search for a similar night (Tiger Data pgvector, or a local seed).
3. Live event search (SerpApi).
4. Sign and story (Gemma via Ollama, or Gemma on Google AI Studio).
5. Save the run (MongoDB Atlas).
6. Durable retry of the save and index (Temporal).
7. Spoken cook brief (ElevenLabs).
8. Spans on each step (Sentry).

Mastra runs that sequence as the `night-prep` workflow. A Mastra agent with the same tools is registered for follow-up questions.

## Run

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000. With no keys, the sheet still builds from the bundled 48-night history and a template sign. The source chips say which provider ran.

Local databases:

```bash
docker compose up -d mongo tiger
```

Then in `.env.local`:

```
MONGODB_URI=mongodb://127.0.0.1:27017
TIGER_DATABASE_URL=postgres://nightprep:nightprep@127.0.0.1:5432/nightprep
```

Temporal needs the worker in a second terminal:

```bash
docker compose up -d temporal temporal-db
npm run worker
```

## Keys

Put secrets in `.env.local` only. Do not commit them.

| Variable | Create it |
| --- | --- |
| `PRIOR_API_KEY` | Sign up at https://platform.priorlabs.ai, accept the non-commercial license, open API Keys |
| `GOOGLE_API_KEY` | https://aistudio.google.com/apikey — model `gemma-4-26b-a4b-it` |
| Ollama | Install from https://ollama.com/download, then `ollama pull gemma3:4b` |
| `MONGODB_URI` | https://www.mongodb.com/cloud/atlas free cluster, database user, connection string |
| `TIGER_DATABASE_URL` | https://console.cloud.timescale.com — enable pgvector |
| `SERPAPI_KEY` | https://serpapi.com/users/sign_up |
| `ELEVENLABS_API_KEY` | https://elevenlabs.io — API key in profile |
| `SENTRY_DSN` | https://sentry.io — Node project DSN |
| Render | https://dashboard.render.com — Blueprint from `render.yaml` |
| DigitalOcean | https://cloud.digitalocean.com/apps — or a GPU Droplet running Ollama |

Hacktoberfest partner credits: https://hacktoberfest.com/my/promos

## Challenge

[Hacktoberfest Open-Source AI Challenge: Week 2](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) (event 80). Theme: Side Hustle. Submissions due October 18, 2026, 11:59 PM PDT. Tags: `#devchallenge` `#hf26challenge`. One new project, started inside the window.
