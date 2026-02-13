const MESSAGES: Array<[RegExp, string]> = [
  [/expected/i, 'Atrodo, kad trūksta simbolio. Patikrink kabliataškius ir skliaustus.'],
  [/identifier/i, 'Kintamojo arba metodo pavadinimas neatpažintas.'],
  [/cannot convert/i, 'Tipai nesutampa. Patikrink skaičių ir logikos tipus.'],
  [/brace|\{|\}/i, 'Patikrink, ar visi atidaromi skliaustai turi uždaromus porininkus.'],
];

export function translateCompilerError(error: string): string {
  const normalized = error.trim();

  if (normalized.length === 0) {
    return 'Nepavyko sukompiliuoti kodo. Bandyk dar kartą.';
  }

  const found = MESSAGES.find(([re]) => re.test(normalized));
  if (found) {
    return found[1];
  }

  return `Neatpažinta kompiliavimo klaida: ${normalized}`;
}
