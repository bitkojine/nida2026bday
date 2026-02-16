# Nidos gimtadienio ritmo žaidimas

Mobile-first ritmo žaidimas su gyvu C# taisyklių redagavimu naršyklėje.

- Pirminis taikinys: iPhone Safari
- Taip pat palaikoma: desktop Chrome/Safari/Edge (per Chromium/WebKit testus)
- Deploy: statinis build į GitHub Pages

## Turinys

- [Greita pradžia](#greita-pradžia)
- [Kas įgyvendinta](#kas-įgyvendinta)
- [Kaip žaisti](#kaip-žaisti)
- [C# redagavimo kontraktas](#c-redagavimo-kontraktas)
- [Šablonai](#šablonai)
- [Išsaugojimas localStorage](#išsaugojimas-localstorage)
- [Poraštė ir diagnostika](#poraštė-ir-diagnostika)
- [Testavimas](#testavimas)
- [Skriptai](#skriptai)
- [Deploy](#deploy)
- [Projekto struktūra](#projekto-struktūra)
- [Pokyčių žurnalas](#pokyčių-žurnalas)

## Greita pradžia

Reikalavimai:

- `Node.js` 20+
- `npm`

Paleidimas:

```bash
npm install
npm run dev
```

Build ir preview:

```bash
npm run build
npm run preview
```

## Kas įgyvendinta

- 4 juostų ritmo žaidimas (`← ↓ ↑ →`) su rankiniu valdymu ir autoplay
- C# studija su gyvu taisyklių pritaikymu
- Keičiamo aukščio kodo langas su apsauga nuo nekontroliuojamo auto-didėjimo
- 5 mokymosi misijos su nuolat išsaugomu progresu (`0/5` -> `5/5`)
- Šablonų mygtukų atrakinimas po visų misijų
- Arklio vaizdo keitimai per C#:
  - kūno, karčių ir akių spalva
  - kepurė ir kepurės tipas
  - oro efektas (saulėta/lietinga/sniegas/žaibas)
- Vieningas oro fono renderis:
  - mažame arklio vaizde
  - dideliame puslapio fone
- `Pavojinga zona` poraštėje:
  - pilnas žaidimo reset (misijos, garsas, C# kodas ir susijusi būsena)
  - privalomas patvirtinimas su tekstu `yes reset`
  - po reset atliekamas programos perkrovimas
  - atskiras „tik C# kodo“ reset su patvirtinimu `reset code` (be progreso/garso atstatymo ir be perkrovimo)
- Našumo ir saugyklos diagnostika poraštėje su stabilia „placeholder“ įkrovos būsena

## Kaip žaisti

1. Atidaryk puslapį, žaidimas startuoja iš karto.
2. Spausk rodyklių mygtukus kai natos kerta hit liniją.
3. Atverk `C# studija: keisk žaidimo taisykles`.
4. Redaguok C# ir stebėk pokyčius realiu laiku.
5. Eik per misijas nuo `1 / 5` iki `5 / 5` ir atrakink šablonus.

## C# redagavimo kontraktas

Žaidime rodoma C# klasė su enum reikšmėmis ir laukais, kuriuos galima keisti. Dabartinis šablonas:

- `KepuresTipas`: `KLASIKINE`, `KAUBOJAUS`, `KARUNA`, `RAGANOS`
- `OroEfektas`: `SAULETA`, `LIETINGA`, `SNIEGAS`, `ZAIBAS`
- `Spalva`: `SMELIO`, `TAMSIAI_RUDA`, `RUDA`, `JUODA`, `BALTA`, `AUKSINE`, `ROZINE`, `MELYNA`, `ZALIA`, `VIOLETINE`, `ORANZINE`

Keičiami laukai/metodas:

- `tobulasLangas`
- `gerasLangas`
- `tobuliTaskai`
- `geriTaskai`
- `serijaIkiUzsivedimo`
- `arklioSpalva`
- `karciuSpalva`
- `suKepure`
- `kepuresTipas`
- `oroEfektas`
- `AkiuSpalva()`

Pastaba: parseris palaiko ir enum reikšmes be tipo prefikso (pvz. `KARUNA`), bet rekomenduojamas pilnas variantas (pvz. `KepuresTipas.KARUNA`) dėl aiškumo.

## Šablonai

- Yra 6 šablonai greitam eksperimentavimui po visų misijų įvykdymo.
- Šablonai keičia visą redaguojamą taisyklių rinkinį (langus, taškus, hype slenkstį, spalvas, kepurę, orą ir akių spalvą).
- Šablonai įrašomi kaip redaktoriaus kodas, todėl jų efektas išlieka po perkrovimo.

## Išsaugojimas localStorage

Naudojami raktai:

- `nida2026bday:puzzlesSolvedCount:v1`
  - saugo kiek misijų jau įvykdyta (`0..5`)
- `nida2026bday:soundMuted:v1`
  - saugo garso būseną (`1` arba nėra rakto)
- `nida2026bday:editorSource:v1`
  - saugo naujausią C# redaktoriaus turinį
  - redaguotas kodas išlieka po puslapio perkrovimo ir naujos versijos reload

Legacy migracija:

- `nida2026bday:puzzlesUnlocked:v1` nebenaudojamas kaip pagrindinė būsena
- jei randamas su reikšme `1`, sistema automatiškai suteikia `5/5` progresą naujame rakte ir seną raktą pašalina
- tai apsaugo nuo progreso praradimo pereinant iš senos sistemos

## Poraštė ir diagnostika

`ℹ️ Papildoma informacija apie žaidimą` skiltyje yra:

- garso vizualizatorius
- našumo statistika (`kadr./s`, kadro laikas, atmintis, natos, dalelės, garso balsai)
- vietinės saugyklos diagnostika:
  - raktų kiekis
  - mūsų raktų būsena
  - apytikslis užimtumas
  - naršyklės `storage estimate` jei prieinama
  - visų mūsų raktų reikšmės; C# kodo raktui rodoma tik eilučių skaičiaus santrauka
- `Pavojinga zona` su dviem atstatymo režimais:
  - pilnas žaidimo reset (`yes reset`) + puslapio perkrovimas
  - tik C# kodo reset (`reset code`)

Įkrovos būsena:

- statistika turi fiksuotą eilučių struktūrą nuo pirmo renderio
- kol duomenys ruošiami, rodomi aiškūs `tikrinama...` placeholder elementai
- dėl to turinys „nešokinėja“ tarp eilučių skaičiaus

## Testavimas

Unit + coverage:

```bash
npm run test
```

E2E (Playwright):

```bash
npx playwright install chromium webkit
npm run test:e2e
```

Pilnas paketas (`typecheck + unit + e2e`):

```bash
npm run test:all
```

Aktyvūs E2E profiliai:

- `desktop-chromium`
- `iphone-12-pro-max` (WebKit)
- `iphone-15-pro` (WebKit)

Pagrindinės E2E aprėptys:

- misijų progresas per visus etapus (`0..5`), perkrovimai ir regresijos
- legacy rakto migracija į naują progreso sistemą
- pilnas reset ir tik C# kodo reset (įskaitant patvirtinimo frazes)
- redaktoriaus kodo išsaugojimas/perkrovimas ir klaidų atkūrimas
- iPhone landscape/portrait ir desktop išdėstymo stabilumas
- oro fono (mažo + didelio) renderio stabilumas ir ribiniai atvejai

## Skriptai

```bash
npm run dev
npm run typecheck
npm run lint
npm run format
npm run test
npm run test:watch
npm run test:e2e
npm run test:all
npm run check
npm run build
npm run preview
```

## Deploy

Workflow failai:

- `.github/workflows/deploy-pages.yml` - build/deploy į GitHub Pages
- `.github/workflows/e2e.yml` - atskiras E2E pipeline

Deploy eiga:

1. Push į `main`
2. Generuojamas statinis build (`dist/`)
3. Artifact publikuojamas per GitHub Pages

## Projekto struktūra

- `src/core` - ritmo, timing, scoring logika ir tipai
- `src/services` - C# kompiliavimo/runtime sluoksnis
- `src/render` - arklio ir oro efektų renderinimas
- `src/ui` - misijos, šablonai, editoriaus UX
- `src/main.ts` - app bootstrap, wiring, state orchestration
- `tests` - Vitest vienetiniai testai
- `e2e` - Playwright scenarijai
- `specs` - modulių specifikacijos

## Pokyčių žurnalas

### 2026-02-16

- Misijų progresas saugomas per-misiją rakte `nida2026bday:puzzlesSolvedCount:v1`
- Legacy raktas `nida2026bday:puzzlesUnlocked:v1` migruojamas ir pašalinamas
- Pridėta `Pavojinga zona` su pilnu reset, patvirtinimu (`yes reset`) ir puslapio perkrovimu
- Pridėtas C# kodo išsaugojimas rakte `nida2026bday:editorSource:v1`
- Pridėtas atskiras `reset code` srautas, kuris atstato tik C# kodą
- Suvienodintas mažo ir didelio oro fono renderinimas
- Poraštės statistika atnaujinta su fiksuota placeholder įkrovos būsena
