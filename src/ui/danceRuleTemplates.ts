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
    akiuSpalva: string;
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
      tobulasLangas: '0.035f',
      gerasLangas: '0.095f',
      tobuliTaskai: '210',
      geriTaskai: '110',
      serijaIkiUzsivedimo: '5',
      akiuSpalva: 'Spalva.AUKSINE',
      arklioSpalva: 'Spalva.ROZINE',
      karciuSpalva: 'Spalva.VIOLETINE',
      suKepure: 'true',
      kepuresTipas: 'KepuresTipas.RAGANOS',
      oroEfektas: 'OroEfektas.ZAIBAS',
    },
  },
  {
    id: 'svelnus-srautas',
    labelLt: 'Švelnus Srautas',
    descriptionLt: 'Rami mėlyna paletė, klasikinė kepurė ir švelnus lietus.',
    values: {
      tobulasLangas: '0.1f',
      gerasLangas: '0.24f',
      tobuliTaskai: '115',
      geriTaskai: '70',
      serijaIkiUzsivedimo: '14',
      akiuSpalva: 'Spalva.BALTA',
      arklioSpalva: 'Spalva.MELYNA',
      karciuSpalva: 'Spalva.RUDA',
      suKepure: 'false',
      kepuresTipas: 'KepuresTipas.KLASIKINE',
      oroEfektas: 'OroEfektas.LIETINGA',
    },
  },
  {
    id: 'uzsivedimo-raketa',
    labelLt: 'Užsivedimo Raketa',
    descriptionLt: 'Ryškios „raketos“ spalvos, klasikinė kepurė ir greitas tempas.',
    values: {
      tobulasLangas: '0.055f',
      gerasLangas: '0.13f',
      tobuliTaskai: '170',
      geriTaskai: '95',
      serijaIkiUzsivedimo: '3',
      akiuSpalva: 'Spalva.ORANZINE',
      arklioSpalva: 'Spalva.ORANZINE',
      karciuSpalva: 'Spalva.TAMSIAI_RUDA',
      suKepure: 'true',
      kepuresTipas: 'KepuresTipas.KLASIKINE',
      oroEfektas: 'OroEfektas.SAULETA',
    },
  },
  {
    id: 'audros-sokis',
    labelLt: 'Audros Šokis',
    descriptionLt: 'Tamsios audros spalvos ir kaubojaus kepurė lietuje.',
    values: {
      tobulasLangas: '0.04f',
      gerasLangas: '0.11f',
      tobuliTaskai: '185',
      geriTaskai: '90',
      serijaIkiUzsivedimo: '6',
      akiuSpalva: 'Spalva.VIOLETINE',
      arklioSpalva: 'Spalva.JUODA',
      karciuSpalva: 'Spalva.TAMSIAI_RUDA',
      suKepure: 'true',
      kepuresTipas: 'KepuresTipas.KAUBOJAUS',
      oroEfektas: 'OroEfektas.LIETINGA',
    },
  },
  {
    id: 'sniego-puota',
    labelLt: 'Sniego Puota',
    descriptionLt: 'Sniego nuotaika, plačios paklaidos ir stabili serija.',
    values: {
      tobulasLangas: '0.095f',
      gerasLangas: '0.22f',
      tobuliTaskai: '130',
      geriTaskai: '82',
      serijaIkiUzsivedimo: '11',
      akiuSpalva: 'Spalva.MELYNA',
      arklioSpalva: 'Spalva.BALTA',
      karciuSpalva: 'Spalva.AUKSINE',
      suKepure: 'true',
      kepuresTipas: 'KepuresTipas.KARUNA',
      oroEfektas: 'OroEfektas.SNIEGAS',
    },
  },
  {
    id: 'karnavaline-kepure',
    labelLt: 'Karnavalinė Karūna',
    descriptionLt: 'Šventinės spalvos, auksinė karūna ir linksma scena.',
    values: {
      tobulasLangas: '0.06f',
      gerasLangas: '0.145f',
      tobuliTaskai: '165',
      geriTaskai: '88',
      serijaIkiUzsivedimo: '7',
      akiuSpalva: 'Spalva.ZALIA',
      arklioSpalva: 'Spalva.ZALIA',
      karciuSpalva: 'Spalva.ORANZINE',
      suKepure: 'true',
      kepuresTipas: 'KepuresTipas.KARUNA',
      oroEfektas: 'OroEfektas.ZAIBAS',
    },
  },
];

function replaceField(source: string, field: string, value: string): string {
  const pattern = new RegExp(`(public\\s+[A-Za-z_]\\w*\\s+${field}\\s*=\\s*)([^;]+)(;)`, 'i');
  return source.replace(pattern, `$1${value}$3`);
}

function replaceEyeColorMethod(source: string, value: string): string {
  return source.replace(
    /(public\s+[A-Za-z_]\w*\s+AkiuSpalva\s*\(\s*\)\s*\{[\s\S]*?return\s+)(?:[A-Za-z_]\w*\.)?[A-Za-z_]\w*(\s*;[\s\S]*?\})/i,
    `$1${value}$2`,
  );
}

export function applyDanceRuleTemplate(source: string, templateId: string): string {
  const template = DANCE_RULE_TEMPLATES.find((candidate) => candidate.id === templateId);
  if (!template) {
    return source;
  }

  let next = source;
  for (const [field, value] of Object.entries(template.values)) {
    if (field === 'akiuSpalva') {
      continue;
    }
    next = replaceField(next, field, value);
  }
  next = replaceEyeColorMethod(next, template.values.akiuSpalva);

  return next;
}
