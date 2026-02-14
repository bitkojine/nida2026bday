import { describe, expect, it } from 'vitest';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';

describe('CodeCompilerService', () => {
  it('extracts dance rules from valid code', () => {
    const service = new CodeCompilerService();
    const result = service.compile(
      CSHARP_TEMPLATE.replace('0.05f', '0.08f')
        .replace('"#d6b48a"', '"#112233"')
        .replace('false;', 'true;')
        .replace('"KLASIKINE"', '"KAUBOJAUS"')
        .replace('"SAULETA"', '"ZAIBAS"'),
    );

    expect(result.success).toBe(true);
    expect(result.rules.tobulasLangas).toBe(0.08);
    expect(result.rules.arklioSpalva).toBe('#112233');
    expect(result.rules.suKepure).toBe(true);
    expect(result.rules.kepuresTipas).toBe('KAUBOJAUS');
    expect(result.rules.oroEfektas).toBe('ZAIBAS');
  });

  it('returns translated error for missing class', () => {
    const service = new CodeCompilerService();
    const result = service.compile('public class SomethingElse {}');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('pavadinimas');
  });

  it('guards invalid brackets', () => {
    const service = new CodeCompilerService();
    const result = service.compile('public class DanceRules {');

    expect(result.success).toBe(false);
  });

  it('enforces sandbox clamps', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace('100;', '99999;')
      .replace('10;', '1;')
      .replace('"#d6b48a"', '"pink"')
      .replace('"KLASIKINE"', '"PIRATAS"')
      .replace('"SAULETA"', '"AUDRA"');

    const result = service.compile(edited);
    expect(result.success).toBe(true);
    expect(result.rules.tobuliTaskai).toBe(1000);
    expect(result.rules.serijaIkiHype).toBe(2);
    expect(result.rules.arklioSpalva).toBe('#d6b48a');
    expect(result.rules.kepuresTipas).toBe('KLASIKINE');
    expect(result.rules.oroEfektas).toBe('SAULETA');
  });
});
