# Nidos gimtadienio ritmo žaidimas (GitHub Pages, static)

Mobile-first ritmo žaidimas su gyvu C# taisyklių redagavimu naršyklėje.  
Pirminis taikinys: iPhone Safari. Taip pat veikia desktop naršyklėse.

## Kas čia yra

- 4 juostų ritmo trasa su rodyklių valdymu (`← ↓ ↑ →`)
- C# studija žaidimo taisyklėms keisti realiu laiku
- Mokymosi misijos (`0/5` -> `5/5`) su šablonų atrakinimo atlygiu
- Šokantis arklys (`canvas`) su spalvų, kepurių ir oro efektų valdymu per C#
- Lietuviška UI ir dedikacija:
  - `Skirta Nidai – nuo Roberto. Su gimtadieniu! 🎉`
  - rodoma žaidimo apačioje visada

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
5. Stebėk kompiliavimo būseną:
   - `Paruošta (.NET WASM)` arba
   - `Paruošta (Suderinamas režimas)`

## Ką reiškia kompiliavimo būsena

- `Paruošta (.NET WASM)` reiškia, kad C# kodas veikia per `.NET WebAssembly` naršyklėje.
- `Paruošta (Suderinamas režimas)` reiškia, kad pilnas `.NET` vykdymas nebuvo pasiekiamas, todėl naudojamas vietinis suderinamas taisyklių vertinimas.
- Abiem atvejais žaidimas veikia ir tavo pakeitimai taikomi iš karto.

Jei matai klaidą po redagavimo:

1. Patikrink, ar neužmiršai kabliataškio `;`.
2. Patikrink, ar visi skliaustai `{ }` uždaryti poromis.
3. Redaguok tik pažymėtą `GALI KEISTI` sritį.
4. Po pakeitimo palauk trumpai (apie `0.1-0.2 s`), kol būsena vėl taps `Paruošta`.

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

## Architektūra

- `src/core/` - deterministinė ritmo/scoring/timing logika
- `src/services/` - C# compile/runtime/fallback sluoksnis
- `src/render/` - arklio animatorius ir efektai
- `src/ui/` - editorius, šablonai, misijos, compile UI
- `specs/` - spec-driven modulio kontraktai
- `tests/` - Vitest testai
- `e2e/` - Playwright scenarijai

## Mobile-first sprendimai

- Touch-first UI, be hover priklausomybės
- Safe-area palaikymas (`viewport-fit=cover`, `env(safe-area-inset-*)`)
- iPhone fokusavimo zoom prevencija redaktoriuje (no-zoom viewport + mobile editor font sizing)
- `requestAnimationFrame` renderis ir lengvos animacijos

## Pastabos apie C# runtime

- Pirmiausia bandoma `.NET WASM` aplinka naršyklėje.
- Jei nepavyksta, įjungiamas suderinamas fallback režimas.
- Abiem režimais žaidimo taisyklės atsinaujina gyvai.
