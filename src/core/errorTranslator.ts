const MESSAGES: Array<[RegExp, string]> = [
  [/expected/i, 'Atrodo, kad truksta simbolio. Patikrink kabliataskius ir skliaustus.'],
  [/identifier/i, 'Kintamojo arba metodo pavadinimas neatpazintas.'],
  [/cannot convert/i, 'Tipai nesutampa. Patikrink skaiciu ir logikos tipus.'],
  [/brace|\{|\}/i, 'Patikrink, ar visi atidaromi skliaustai turi uzdaromus porininkus.'],
];

export function translateCompilerError(error: string): string {
  const normalized = error.trim();

  if (normalized.length === 0) {
    return 'Nepavyko sukompiliuoti kodo. Bandyk dar karta.';
  }

  const found = MESSAGES.find(([re]) => re.test(normalized));
  if (found) {
    return found[1];
  }

  return `Nepazinta kompiliavimo klaida: ${normalized}`;
}
