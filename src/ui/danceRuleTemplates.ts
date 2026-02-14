export interface DanceRuleTemplate {
  id: string;
  labelLt: string;
  descriptionLt: string;
  values: {
    tobulasLangas: string;
    gerasLangas: string;
    tobuliTaskai: string;
    geriTaskai: string;
    serijaIkiUzsivedimo: string;
    arklioSpalva: string;
    karciuSpalva: string;
    suKepure: string;
    kepuresTipas: string;
    oroEfektas: string;
  };
}

export const DANCE_RULE_TEMPLATES: DanceRuleTemplate[] = [
  {
    id: 'disko-zaibas',
    labelLt: 'Disko Žaibas',
    descriptionLt: 'Neoninės spalvos, smaili kepurė ir žaibo nuotaika.',
    values: {
      tobulasLangas: '0.04f',
      gerasLangas: '0.1f',
      tobuliTaskai: '180',
      geriTaskai: '95',
      serijaIkiUzsivedimo: '8',
      arklioSpalva: '"#ff93d1"',
      karciuSpalva: '"#7f2cff"',
      suKepure: 'true',
      kepuresTipas: '"RAGANOS"',
      oroEfektas: '"ZAIBAS"',
    },
  },
  {
    id: 'svelnus-srautas',
    labelLt: 'Švelnus Srautas',
    descriptionLt: 'Rami mėlyna paletė, klasikinė kepurė ir švelnus lietus.',
    values: {
      tobulasLangas: '0.09f',
      gerasLangas: '0.2f',
      tobuliTaskai: '120',
      geriTaskai: '75',
      serijaIkiUzsivedimo: '12',
      arklioSpalva: '"#9fc6e8"',
      karciuSpalva: '"#36597a"',
      suKepure: 'true',
      kepuresTipas: '"KLASIKINE"',
      oroEfektas: '"LIETINGA"',
    },
  },
  {
    id: 'uzsivedimo-raketa',
    labelLt: 'Užsivedimo Raketa',
    descriptionLt: 'Ryškios „raketos“ spalvos, klasikinė kepurė ir greitas tempas.',
    values: {
      tobulasLangas: '0.06f',
      gerasLangas: '0.14f',
      tobuliTaskai: '160',
      geriTaskai: '90',
      serijaIkiUzsivedimo: '3',
      arklioSpalva: '"#ff9f5d"',
      karciuSpalva: '"#7a2f00"',
      suKepure: 'true',
      kepuresTipas: '"KLASIKINE"',
      oroEfektas: '"SAULETA"',
    },
  },
  {
    id: 'audros-sokis',
    labelLt: 'Audros Šokis',
    descriptionLt: 'Tamsios audros spalvos ir kaubojaus kepurė lietuje.',
    values: {
      tobulasLangas: '0.035f',
      gerasLangas: '0.095f',
      tobuliTaskai: '190',
      geriTaskai: '85',
      serijaIkiUzsivedimo: '6',
      arklioSpalva: '"#7f99b7"',
      karciuSpalva: '"#2b3c54"',
      suKepure: 'true',
      kepuresTipas: '"KAUBOJAUS"',
      oroEfektas: '"LIETINGA"',
    },
  },
  {
    id: 'sniego-puota',
    labelLt: 'Sniego Puota',
    descriptionLt: 'Sniego nuotaika, plačios paklaidos ir stabili serija.',
    values: {
      tobulasLangas: '0.1f',
      gerasLangas: '0.24f',
      tobuliTaskai: '110',
      geriTaskai: '70',
      serijaIkiUzsivedimo: '14',
      arklioSpalva: '"#d7ecff"',
      karciuSpalva: '"#587087"',
      suKepure: 'true',
      kepuresTipas: '"KARUNA"',
      oroEfektas: '"SNIEGAS"',
    },
  },
  {
    id: 'karnavaline-kepure',
    labelLt: 'Karnavalinė Karūna',
    descriptionLt: 'Šventinės spalvos, auksinė karūna ir linksma scena.',
    values: {
      tobulasLangas: '0.055f',
      gerasLangas: '0.13f',
      tobuliTaskai: '150',
      geriTaskai: '80',
      serijaIkiUzsivedimo: '9',
      arklioSpalva: '"#ffc48d"',
      karciuSpalva: '"#7a3f1f"',
      suKepure: 'true',
      kepuresTipas: '"KARUNA"',
      oroEfektas: '"SAULETA"',
    },
  },
];

function replaceField(source: string, field: string, value: string): string {
  const pattern = new RegExp(
    `(public\\s+(?:float|int|string|bool)\\s+${field}\\s*=\\s*)([^;]+)(;)`,
    'i',
  );
  return source.replace(pattern, `$1${value}$3`);
}

export function applyDanceRuleTemplate(source: string, templateId: string): string {
  const template = DANCE_RULE_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (!template) {
    return source;
  }

  let next = source;
  for (const [field, value] of Object.entries(template.values)) {
    next = replaceField(next, field, value);
  }

  return next;
}
