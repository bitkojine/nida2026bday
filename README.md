# Nidos gimtadienio ritmo žaidimas (GitHub Pages, static)

Mobile-first ritmo žaidimas su gyvu C# taisyklių redagavimu naršyklėje.  
Pirminis taikinys: iPhone Safari. Taip pat veikia desktop naršyklėse.

## Kas čia yra

- 4 juostų ritmo trasa su rodyklių valdymu (`← ↓ ↑ →`)
- C# studija žaidimo taisyklėms keisti realiu laiku
- Mokymosi misijos (`0/5` -> `5/5`) su šablonų atrakinimo atlygiu
- Šokantis arklys (`canvas`) su spalvų, kepurių ir oro efektų valdymu per C#
- Gyvi našumo rodikliai poraštėje (lietuviški: `kadr./s`, `ms`, atmintis, garso balsai, dalelės)
- Lietuviška UI ir dedikacija:
  - `Skirta Nidai – nuo Roberto. Su gimtadieniu! 🎉`
  - rodoma iškart po pagrindiniu pavadinimu

## Technologijos

- TypeScript (`strict` įjungtas)
- Vite
- Vitest + Coverage (`@vitest/coverage-v8`)
- Playwright (desktop + iPhone profilis)
- Monaco Editor
- Canvas renderinimas
- C# taisyklių vykdymas per `.NET WASM` bandymą su saugiu fallback parseriu

## Paleidimas lokaliai

```bash
npm install
npm run dev
```

Atidaryk adresą iš terminalo (`vite` output), dažniausiai `http://127.0.0.1:5173`.

## Kaip žaisti

1. Atidaryk žaidimą, jis startuoja iškart (be splash/start ekranų).
2. Spausk rodyklių mygtukus apačioje (`← ↓ ↑ →`) kai nata kerta `hit` liniją.
3. Atverk `C# studija: keisk žaidimo taisykles`.
4. Keisk C# laukus, pvz.:
   - `tobulasLangas`, `gerasLangas`
   - `tobuliTaskai`, `geriTaskai`
   - `serijaIkiUzsivedimo`
   - `arklioSpalva`, `karciuSpalva`
   - `suKepure`, `kepuresTipas`, `oroEfektas`
5. Pakeitimai pritaikomi automatiškai po trumpos akimirkos.

Jei matai klaidą po redagavimo:

1. Patikrink, ar neužmiršai kabliataškio `;`.
2. Patikrink, ar visi skliaustai `{ }` uždaryti poromis.
3. Redaguok tik pažymėtą `GALI KEISTI` sritį.
4. Po pakeitimo palauk trumpai (apie `0.1-0.2 s`), kol taisyklės persikompiliuos.

## Testai

### Unit + coverage

```bash
npm run test
```

### E2E

```bash
npx playwright install chromium webkit
npm run test:e2e
```

### Viskas (typecheck + unit + e2e)

```bash
npm run test:all
```

## Kiti naudingi skriptai

```bash
npm run lint
npm run format
npm run build
npm run preview
```

## GitHub Actions / Deploy

Workflow failai:

- `.github/workflows/deploy-pages.yml` - build + deploy į GitHub Pages
- `.github/workflows/e2e.yml` - atskiras E2E pipeline (Chromium + WebKit)

Deploy modelis:

1. Push į `main` paleidžia `deploy-pages` workflow.
2. Statinis build (`dist/`) publikuojamas per GitHub Pages Actions.
3. E2E workflow yra atskiras ir neužblokuoja deploy artefakto generavimo.

## Home Screen (iPhone)

- Pridėtas `site.webmanifest` ir iOS `apple-touch-icon`.
- Home Screen pavadinimas: `Arklio Ritmas`.
- Naudojama brandinta ikona iš `public/icons/`.

## Architektūra

- `src/core/` - deterministinė ritmo/scoring/timing logika
- `src/services/` - C# compile/runtime/fallback sluoksnis
- `src/render/` - arklio animatorius ir efektai
- `src/ui/` - editorius, šablonai, misijos, redagavimo UX
- `specs/` - spec-driven modulio kontraktai
- `tests/` - Vitest testai
- `e2e/` - Playwright scenarijai

## Mobile-first sprendimai

- Touch-first UI, be hover priklausomybės
- Safe-area palaikymas (`viewport-fit=cover`, `env(safe-area-inset-*)`)
- iPhone fokusavimo zoom prevencija redaktoriuje (no-zoom viewport + mobile editor font sizing)
- Optimizuotas iPhone landscape išdėstymas (safe-area + sumažinti aukščiai, kad viskas tilptų patogiai)
- Adaptyvus vizualinis FPS mobiliuose:
  - autoplay: ~36 kadr./s
  - manual: ~45 kadr./s
  - desktop: ~60 kadr./s
- `requestAnimationFrame` renderis ir lengvos animacijos

## Pastabos apie C# runtime

- Pirmiausia bandoma `.NET WASM` aplinka naršyklėje.
- Jei nepavyksta, įjungiamas suderinamas fallback režimas.
- Abiem režimais žaidimo taisyklės atsinaujina gyvai.
