# Nidos gimtadienio ritmo zaidimas (GitHub Pages static)

Mobile-first ritmo mini-zaidimas su C# taisykliu redagavimu naršyklėje. Skirtas iPhone Safari (pirminis taikinys), veikia ir desktop naršyklėse.

## Dedikacija

UI yra emocine dedikacija lietuviu kalba:

- `Skirta Nidai - nuo Roberto. Su gimtadieniu! 🎉`
- Matoma `splash` ir `start` ekranuose be scroll iPhone perziuroje.

## Technologijos

- TypeScript (`strict`)
- Vite
- Vitest (TDD)
- Monaco Editor integracija
- Browser-side C# taisykliu kompiliavimo paslauga su WASM runtime bandymu + saugus fallback
- Canvas renderinimas (sokantis arklys)

## Paleidimas

```bash
npm install
npm run dev
```

## Kaip zaisti

1. Palauk splash ekrano su dedikacija.
2. Spausk `Pradeti zaidima`.
3. Ziurek i 4 juostu trasa: natos krenta is virsaus i apatine `hit` linija.
4. Tapsink atitinkama juosta `A S K L` tik tada, kai nata pasiekia `hit` linija.
5. Editoriuje keisk C# reikšmes (`tobulasLangas`, `geriTaskai`, `serijaIkiHype` ir t.t.).
6. Stebek statusa virs editoriaus:
   `OK (...)` reiskia, kad taisykles pritaikytos iskart zaidime.

## Testai

```bash
npm run test
```

Coverage slenkstis `>=90%` logikos moduliams (`timing`, `scoring`, `streak/hype`, `error translation`, `input normalization`, `dedication logic`).

## E2E testai (lokaliai)

```bash
npx playwright install chromium
npm run test:e2e
```

E2E padengia:

- dedikacijos matomuma splash/start ekranuose
- perejima i zaidima
- kompiliavimo statuso iseima is `Kompiliuojama...`
- mobiliam scenarijui tinkama input eiga

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages deploy

1. Sukurk branch `gh-pages` arba naudok GitHub Actions.
2. Build output yra `dist/`.
3. Jei repo pavadinimas nera root domain, Vite `base` nustatyk i `/<repo>/`.
4. Pushink `dist/` i Pages publish branch arba naudok Actions workflow.

## Architektura

- `src/core/`: deterministine zaidimo logika.
- `src/services/`: C# kompiliavimo/sandbox sluoksnis.
- `src/render/`: Canvas arklio animatorius.
- `src/ui/`: Monaco montavimas.
- `specs/`: komponentu kontraktai (spec-driven etapas).
- `tests/`: Vitest testai (TDD etapas).

## Mobile performance sprendimai

- Touch-first valdymas, be hover priklausomybiu.
- `requestAnimationFrame` pagrindu renderinimas.
- Canvas resize su DPR ir safe-area (`viewport-fit=cover`, `env(safe-area-inset-*)`).
- Debounced kompiliavimas (`150ms`) kad neapkrautu iPhone CPU.
- Lengvos CSS animacijos (`opacity/transform/text-shadow`).

## Pastabos apie C# runtime

- Integruotas WASM .NET runtime loader bandymas (`./dotnet/dotnet.js` arba CDN).
- Jei runtime nepasiekiamas, aktyvuojamas sandboxed fallback parseris, kad zaidimas liktu static-hosting suderinamas.
