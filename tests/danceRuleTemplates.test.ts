import { describe, expect, it } from 'vitest';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';
import { DANCE_RULE_TEMPLATES, applyDanceRuleTemplate } from '../src/ui/danceRuleTemplates';

describe('danceRuleTemplates', () => {
  it('ships six templates for quick experimentation', () => {
    expect(DANCE_RULE_TEMPLATES).toHaveLength(6);
  });

  it('applies each template by replacing editable DanceRules fields', () => {
    for (const template of DANCE_RULE_TEMPLATES) {
      const result = applyDanceRuleTemplate(CSHARP_TEMPLATE, template.id);
      expect(result).toContain(`public float tobulasLangas = ${template.values.tobulasLangas};`);
      expect(result).toContain(`public float gerasLangas = ${template.values.gerasLangas};`);
      expect(result).toContain(`public int tobuliTaskai = ${template.values.tobuliTaskai};`);
      expect(result).toContain(`public int geriTaskai = ${template.values.geriTaskai};`);
      expect(result).toContain(
        `public int serijaIkiUzsivedimo = ${template.values.serijaIkiUzsivedimo};`,
      );
      expect(result).toContain(`public string arklioSpalva = ${template.values.arklioSpalva};`);
      expect(result).toContain(`public string karciuSpalva = ${template.values.karciuSpalva};`);
      expect(result).toContain(`public bool suKepure = ${template.values.suKepure};`);
      expect(result).toContain(`public string kepuresTipas = ${template.values.kepuresTipas};`);
      expect(result).toContain(`public string oroEfektas = ${template.values.oroEfektas};`);
    }
  });

  it('returns original code for unknown template id', () => {
    expect(applyDanceRuleTemplate(CSHARP_TEMPLATE, 'nezinomas')).toBe(CSHARP_TEMPLATE);
  });

  it('uses varied hat types across templates for exploration', () => {
    const withHat = DANCE_RULE_TEMPLATES.filter((template) => template.values.suKepure === 'true');
    expect(withHat.length).toBeGreaterThanOrEqual(5);

    const hatTypes = new Set(withHat.map((template) => template.values.kepuresTipas));
    expect(hatTypes.has('"KAUBOJAUS"')).toBe(true);
    expect(hatTypes.has('"KARUNA"')).toBe(true);
    expect(hatTypes.has('"RAGANOS"')).toBe(true);
    expect(hatTypes.size).toBeGreaterThanOrEqual(3);
  });
});
