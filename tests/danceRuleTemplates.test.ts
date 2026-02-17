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
      expect(result).toContain(`return ${template.values.akiuSpalva};`);
      expect(result).toContain(`public Spalva arklioSpalva = ${template.values.arklioSpalva};`);
      expect(result).toContain(`public Spalva karciuSpalva = ${template.values.karciuSpalva};`);
      expect(result).toContain(`public bool suKepure = ${template.values.suKepure};`);
      expect(result).toContain(
        `public KepuresTipas kepuresTipas = ${template.values.kepuresTipas};`,
      );
      expect(result).toContain(`public OroEfektas oroEfektas = ${template.values.oroEfektas};`);
    }
  });

  it('returns original code for unknown template id', () => {
    expect(applyDanceRuleTemplate(CSHARP_TEMPLATE, 'nezinomas')).toBe(CSHARP_TEMPLATE);
  });

  it('uses varied hat types across templates for exploration', () => {
    const withHat = DANCE_RULE_TEMPLATES.filter((template) => template.values.suKepure === 'true');
    expect(withHat.length).toBeGreaterThanOrEqual(5);

    const hatTypes = new Set(withHat.map((template) => template.values.kepuresTipas));
    expect(hatTypes.has('KepuresTipas.KAUBOJAUS')).toBe(true);
    expect(hatTypes.has('KepuresTipas.KARUNA')).toBe(true);
    expect(hatTypes.has('KepuresTipas.RAGANOS')).toBe(true);
    expect(hatTypes.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps templates visually and mood-wise diverse', () => {
    const weatherTypes = new Set(
      DANCE_RULE_TEMPLATES.map((template) => template.values.oroEfektas),
    );
    const eyeColors = new Set(DANCE_RULE_TEMPLATES.map((template) => template.values.akiuSpalva));
    const bodyManePairs = new Set(
      DANCE_RULE_TEMPLATES.map(
        (template) => `${template.values.arklioSpalva}/${template.values.karciuSpalva}`,
      ),
    );

    expect(weatherTypes.size).toBeGreaterThanOrEqual(3);
    expect(eyeColors.size).toBeGreaterThanOrEqual(5);
    expect(bodyManePairs.size).toBe(DANCE_RULE_TEMPLATES.length);
  });
});
