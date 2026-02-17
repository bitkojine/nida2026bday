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
- [Atminties nutekėjimų prevencijos architektūra](#atminties-nutekėjimų-prevencijos-architektūra)
- [Test double inventorius](#test-double-inventorius)
- [30 sekundžių patikros biudžetas](#30-sekundžių-patikros-biudžetas)
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
- Rankinis „tikro C# kompiliatoriaus“ patikrinimas per API mygtuką C# studijoje
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
- „Kodas nesikompiliuoja“ pranešimai:
  - mažame arklio vaizde (su `?` išskleidimu ir vidiniu slinkimu ilgam tekstui)
  - desktop kairiame puslapio stulpelyje
  - abu pranešimai paslepiami, kai kodas vėl validus
- `Pavojinga zona` poraštėje:
  - pilnas žaidimo reset (misijos, garsas, C# kodas ir susijusi būsena)
  - privalomas patvirtinimas su tekstu `yes reset`
  - po reset atliekamas programos perkrovimas
  - atskiras „tik C# kodo“ reset su patvirtinimu `reset code` (be progreso/garso atstatymo ir be perkrovimo)
  - papildomas mygtukas visų misijų atrakinimui su paslėptu patvirtinimo kodu
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

Kodo tikrinimas:

- naudojamas `tree-sitter` C# WASM analizatorius + papildomos projekto taisyklės
- jei WASM aplinka nepasiekiama, taikomas atsarginis struktūrinis tikrinimas
- kai tikrinimas nepraeina, žaidimas pereina į techninės klaidos vizualinį režimą (miegantis arklys, techninis fonas)

Tikro kompiliatoriaus mygtukas:

- C# studijoje yra mygtukas `Patikrinti tikru C# kompiliatoriumi`
- jis siunčia dabartinį kodą į backend API (`/api/csharp/compile`)
- rodo Roslyn verdictą (`kodas kompiliuojasi` / `NESIKOMPILIUOJA`) ir klaidų sąrašą
- jei API nepasiekiamas ar nesukonfigūruotas, rodomas aiškus pranešimas

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

## Poraštė ir diagnostika

`ℹ️ Papildoma informacija apie žaidimą` skiltyje yra:

- garso vizualizatorius
- našumo statistika (`kadr./s`, kadro laikas, atmintis, natos, dalelės, garso balsai)
- resursų gyvavimo ciklo statistika:
  - aktyvūs/pikiniai klausytojai
  - aktyvūs/pikiniai timeout/interval/RAF
  - aktyvūs/pikiniai `AbortController`
  - aktyvūs/pikiniai `ResizeObserver`
  - aktyvūs/pikiniai C# sintaksės medžiai
- vietinės saugyklos diagnostika:
  - raktų kiekis
  - mūsų raktų būsena
  - apytikslis užimtumas
  - naršyklės `storage estimate` jei prieinama
  - visų mūsų raktų reikšmės; C# kodo raktui rodoma tik eilučių skaičiaus santrauka
- `Pavojinga zona` su trimis veiksmais:
  - pilnas žaidimo reset (`yes reset`) + puslapio perkrovimas
  - tik C# kodo reset (`reset code`)
  - visų misijų atrakinimas (paslėptas patvirtinimo kodas)

Įkrovos būsena:

- statistika turi fiksuotą eilučių struktūrą nuo pirmo renderio
- kol duomenys ruošiami, rodomi aiškūs `tikrinama...` placeholder elementai
- dėl to turinys „nešokinėja“ tarp eilučių skaičiaus

## Atminties nutekėjimų prevencijos architektūra

Šis projektas taiko „resource ownership“ modelį, kad sumažintų app lygio atminties nutekėjimus:

- vienas centralizuotas resursų skaitiklis (`src/core/resourceTracker.ts`)
- vienas async resursų wrapper sluoksnis (`src/core/trackedAsync.ts`)
- vienas sintaksės medžių valdymo taškas (`src/services/syntaxTreeResource.ts`)
- vienas event binding sluoksnis (`src/ui/lifecycleBindings.ts`)

Praktinės taisyklės:

- nenaudoti tiesiogiai `addEventListener/removeEventListener` feature kode
- nenaudoti tiesiogiai `setTimeout/setInterval/requestAnimationFrame` ir jų `clear/cancel` API
- nenaudoti tiesiogiai `new AbortController()`
- nenaudoti tiesiogiai parser `parse(...)` medžių be `withParsedSyntaxTree(...)`

Vietoje to naudoti wrapperius:

- `bindTrackedEventListener(...)` ir esamus `bind*` helperius
- `setTrackedTimeout(...)`, `clearTrackedTimeout(...)`
- `setTrackedInterval(...)`, `clearTrackedInterval(...)`
- `requestTrackedAnimationFrame(...)`, `cancelTrackedAnimationFrame(...)`
- `createTrackedAbortController()`
- `withParsedSyntaxTree(...)`

Kodėl šis dizainas geras:

- aiški nuosavybė: kiekvienas resursas turi apibrėžtą sukūrimo ir sunaikinimo vietą
- matomumas: aktyvūs ir pikiniai resursai rodomi poraštėje runtime metu
- priverstinė disciplina: CI check blokuoja naujus tiesioginius API naudojimus
- mažesnė regresijų rizika: leak klasė gaudoma architektūriškai, ne vien lokaliais pataisymais

Tradeoff (ką paaukojame):

- daugiau boilerplate: daugiau helperių ir scope/disposer kodų
- mažesnis „greitas rašymas“: paprasti event/timer scenarijai tampa ilgesni
- daugiau priežiūros: ownership check taisyklės gali reikalauti atnaujinimų keičiant architektūrą
- dalinė migracija silpnina garantijas: jei naujas kelias apeina wrapperius, rizika sugrįžta
- skaitikliai matuoja app resursų gyvavimo tvarką, bet ne absoliučią naršyklės atmintį

Rezultatas: sąmoningai keičiame patogumą į patikimumą. Šiame projekte tai laikoma teisingu kompromisu.

## Test double inventorius

Tikslas: turėti pilną dabartinių test double naudojimų sąrašą ir palaipsniui mažinti jų kiekį, ypač ten, kur galima testuoti realų srautą.

### Vitest mock/stub (`vi.fn`, `vi.stubEnv`, `globalThis.fetch` stub)

- `tests/compileFeedbackRace.test.ts`
- `tests/compileFeedback.test.ts`
- `tests/realCompilerService.test.ts`
- `tests/syntaxTreeResource.test.ts`
- `tests/codeCompilerService.test.ts`
- `tests/lifecycleBindings.test.ts`
- `tests/runtimeScope.test.ts`

### Rankiniai fake objektai / klasės testuose

- `tests/lifecycleBindings.test.ts`
  - `FakeEventHub`
  - `FakeResizeObserver`
- `tests/gameAudio.test.ts`
  - `FakeAudioParam`
  - `FakeAudioNode`
  - `FakeGainNode`
  - `FakeOscillatorNode`
  - `FakeBiquadFilterNode`
  - `FakeWaveShaperNode`
  - `FakeAudioContext`
- `tests/trackedAsync.test.ts`
  - `FakeWindowTimers`

### E2E tinklo test doubles (`page.route` / `route.fulfill`)

- `e2e/game.spec.ts`
  - real compiler endpoint intercept scenarijus (`page.route(...)`, `route.fulfill(...)`)

### Pastaba dėl krypties

- kryptis: mažinti test double naudojimą ten, kur tai ne būtina
- prioritetas: kritinius srautus (mobilus veikimas, real compiler mygtukas, progreso išsaugojimas, perf) laikyti kuo arčiau realaus runtime elgesio
- prieš šalinant test double, užtikrinti ekvivalentišką ar geresnę aprėptį realiais integraciniais/E2E testais

## 30 sekundžių patikros biudžetas

Greitam kasdieniam darbui naudojame vieną komandą:

```bash
npm run check:30s
```

Tikslas:

- išlaikyti grįžtamąjį ryšį maždaug iki 30 s
- anksti pagauti realias regresijas (logika, build, iPhone kritinis srautas)
- pilnus, lėtesnius rinkinius palikti nightly/atskiriems CI workflow

Kas įeina į `check:30s`:

- `npm run lint` - gaudo kokybės ir potencialių bugų signalus statinėje analizėje
- `npm run format:check` - užtikrina vienodą formatą ir sumažina triukšmą diff'uose
- `npm run typecheck` - pagauna tipų kontraktų lūžius prieš runtime
- `npm run test:fast` - greitas unit scenarijų tinklas kritinei logikai
- `npm run check:resource-ownership` - draudžia tiesioginius `tree-sitter` `.parse(...)`, `addEventListener/removeEventListener` ir timer/RAF/`AbortController` API naudojimus už wrapper failų ribų
- `npm run check:localstorage-keys` - saugo localStorage raktų kontraktą nuo netyčinių lūžių
- `npm run check:mission-template-contract` - tikrina misijų ir šablonų suderinamumą
- `npm run build` - garantuoja, kad tikrinamas naujausias produkcinis build iš dabartinio kodo
- `npm run check:smoke-mobile` - iPhone WebKit smoke (`@smoke30`) per `vite preview`, t. y. testuojamas ką tik sugeneruotas `dist`

`check:30s` vykdymo tvarka (1:1):

1. `npm run lint`
2. `npm run format:check`
3. `npm run typecheck`
4. `npm run test:fast`
5. `npm run check:resource-ownership`
6. `npm run check:localstorage-keys`
7. `npm run check:mission-template-contract`
8. `npm run build`
9. `npm run check:smoke-mobile`

Dabartinis biudžeto panaudojimas:

- paskutinis pilnas paleidimas: apie `15.7 s`
- tai sudaro apie `52%` iš `30 s` biudžeto

Kodėl tai laikome „high value“:

- padengia didžiausią riziką šiame projekte: mobilų veikimą, progreso saugojimą ir C# redagavimo srautą
- sugauna dažniausias regresijų klases dar prieš pilnus E2E
- suteikia garantiją, kad 30s cikle tikrinamas ir naujausias build artefaktas, ne tik source būsena
- leidžia greitai iteruoti (mobilus-first), nelaukiant ilgo pipeline

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
- pilnas reset ir tik C# kodo reset (įskaitant patvirtinimo frazes)
- misijų atrakinimo „cheat“ dialogas (tik su teisingu kodu)
- redaktoriaus kodo išsaugojimas/perkrovimas ir klaidų atkūrimas
- iPhone landscape/portrait ir desktop išdėstymo stabilumas
- oro fono (mažo + didelio) renderio stabilumas ir ribiniai atvejai
- compile-fail pranešimų elgsena (rodyti/slėpti, `?` išskleidimas)
- greitų C# redagavimų (invalid -> valid) stabilumas, kad laimi paskutinis pakeitimas

Greitas kasdienis vartai (apie 30 s):

```bash
npm run check:30s
```

Backend integracijos patikra (Render Roslyn API):

```bash
npm run check:real-compiler-backend
```

Ši patikra tikrina:

- `/health` atsaką
- valid C# kompiliavimo atvejį
- invalid C# atmetimo atvejį su klaidomis

## Skriptai

```bash
npm run dev
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run test
npm run test:watch
npm run test:e2e
npm run test:all
npm run check:smoke-mobile
npm run check:30s
npm run check
npm run build
npm run preview
```

## Deploy

Workflow failai:

- `.github/workflows/deploy-pages.yml` - build/deploy į GitHub Pages (`gh-pages` šaką)
- `.github/workflows/e2e.yml` - atskiras E2E pipeline

Gyvi URL:

- Produkcija (`main`): `https://bitkojine.github.io/nida2026bday/`
- Šios darbo šakos preview: `https://bitkojine.github.io/nida2026bday/codex/pr-all-current-changes-2026-02-16/`

Feature branch preview mechanizmas:

- Trigger šakos:
  - `main`
  - `feature/**`
  - `codex/**`
- Deploy taikiniai (vienoje `gh-pages` šakoje):
  - `main` -> `gh-pages` šakninis katalogas (`/`)
  - `feature/*` arba `codex/*` -> atitinkamas subkatalogas (`/<branch-name>/`)
- URL formatas:
  - `https://bitkojine.github.io/nida2026bday/<branch-name>/`

Svarbu GitHub Pages nustatymuose:

- `Settings -> Pages -> Build and deployment`
- `Source`: `Deploy from a branch`
- `Branch`: `gh-pages`
- `Folder`: `/(root)`

Kaip tai veikia praktiškai:

1. Push į `main` atnaujina produkciją (`/nida2026bday/`).
2. Push į `feature/**` ar `codex/**` sukuria/atnaujina preview URL subkataloge.
3. Produkcija ir preview egzistuoja kartu, be merge į `main`.

Papildomas backend (tikram C# kompiliatoriui):

- `backend/RealCompilerApi` - .NET 8 minimal API su Roslyn
- `render.yaml` - Render Free paslaugos konfigūracija
- `FRONTEND_ORIGIN` (Render env) turi būti tavo GitHub Pages origin (pvz. `https://bitkojine.github.io`)
- frontend env `VITE_REAL_COMPILER_API_URL` turi rodyti į Render API (žr. `.env.example`)

Render diegimo žingsniai:

1. Render dashboard pasirink `Blueprint` ir prijunk šį repo (naudos `render.yaml`)
2. Patikrink, kad paslauga `nida2026bday-real-compiler` pakilo ir `/health` grąžina `ok=true`
3. Frontend build aplinkoje nustatyk `VITE_REAL_COMPILER_API_URL=https://<tavo-service>.onrender.com`
4. Perkrauk/deploy frontend, tada C# studijos mygtukas naudos tikrą Roslyn tikrinimą

Deploy eiga:

1. Push į palaikomą šaką (`main`, `feature/**` arba `codex/**`)
2. Generuojamas statinis build (`dist/`) su atitinkamu `base` keliu
3. Turinis publikuojamas į `gh-pages` (root arba branch subkatalogą)

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
- Pridėta `Pavojinga zona` su pilnu reset, patvirtinimu (`yes reset`) ir puslapio perkrovimu
- Pridėtas C# kodo išsaugojimas rakte `nida2026bday:editorSource:v1`
- Pridėtas atskiras `reset code` srautas, kuris atstato tik C# kodą
- Pridėtas visų misijų atrakinimo veiksmas su paslėptu patvirtinimo kodu
- Suvienodintas mažo ir didelio oro fono renderinimas
- Poraštės statistika atnaujinta su fiksuota placeholder įkrovos būsena
