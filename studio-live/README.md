# OpenMontage Web Studio

AGPLv3 web interface built from the exported Lovable project, with original OpenMontage data pinned in src/data/upstream.json.

## Build and test

```sh
npm ci
npm test
npm run build
```

## Vercel

Import moosamusa/openmontage-web-studio. Select `studio-live` as Root Directory and Vite as the framework. Build: `npm run build`; Output: `dist`. No provider secrets are required or stored on Vercel.

## Worker

The original Lovable FastAPI adapter is preserved in `../web-studio/worker/`. Deploy it separately on a persistent container host with Python, Node and FFmpeg. Configure its access token, CORS origin allowlist, upstream checkout and project storage. Set the HTTPS worker URL and worker access token in the website's Worker settings. Provider API keys must remain on the worker. No worker is currently provisioned by this website deployment.

## Working browser functionality

- IndexedDB project library and uploaded files
- All 12 creative pipeline manifests (plus an internal smoke-test pipeline in the catalogue)
- 5 upstream styles, 148 tool catalogue entries
- Brief, reference URL, duration, ratio/resolution/fps, budget and approval configuration
- Stage artifacts, start/submit/approve/revision transitions, sequential unlocks
- Script sections, scene descriptions/durations, take selection and asset attachments
- Local asset upload/viewing, editable timeline planning
- JSON metadata import/export, decision history and stage-state replay
- Worker health/capabilities, project/asset sync, direct tool jobs, job polling, actual cost retrieval, artifact downloads when connected

## Important limits

This is not full feature parity with the complete agentic OpenMontage toolkit. Autonomous LLM orchestration, research, provider selection, all quality gates, real-time video preview/composition, multi-user authorization and managed worker hosting are not implemented. Stage JSON is syntax-checked, not validated against every upstream artifact schema. Script/scenes/timeline edits are local planning data and are not automatically converted into a render composition. Jobs require explicit valid tool inputs. Generation/render tools require the worker, dependencies, credentials or GPU hardware. There are no simulated generation successes or fake rendered videos.

The upstream repository is preserved at the repository root. The unfinished original Lovable export is in `web-studio/`; `studio-live/` is the Vercel-compatible client application.

JSON export excludes uploaded bytes. Back up assets separately. Data belongs to this browser/origin and is not synced to an account automatically.
