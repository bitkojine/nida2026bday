import { describe, expect, it, vi } from 'vitest';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';

describe('CodeCompilerService', () => {
  it('extracts dance rules from valid code', () => {
    const service = new CodeCompilerService();
    const result = service.compile(
      CSHARP_TEMPLATE.replace('0.05f', '0.08f')
        .replace('Spalva.SMELIO', 'Spalva.MELYNA')
        .replace('false;', 'true;')
        .replace('KepuresTipas.KLASIKINE', 'KepuresTipas.KAUBOJAUS')
        .replace('OroEfektas.SAULETA', 'OroEfektas.ZAIBAS'),
    );

    expect(result.success).toBe(true);
    expect(result.rules.tobulasLangas).toBe(0.08);
    expect(result.rules.arklioSpalva).toBe('MELYNA');
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

  it('fails compile when class declaration keyword is broken', () => {
    const service = new CodeCompilerService();
    const result = service.compile(
      CSHARP_TEMPLATE.replace('public class DanceRules', 'publik class DanceRules'),
    );

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
      .replace('50;', '2;');

    const result = service.compile(edited);
    expect(result.success).toBe(true);
    expect(result.rules.tobuliTaskai).toBe(1000);
    expect(result.rules.geriTaskai).toBe(5);
    expect(result.rules.serijaIkiHype).toBe(2);
  });

  it('accepts enum-based assignments for hat and weather', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace(
      'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
      'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
    ).replace(
      'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
      'public OroEfektas oroEfektas = OroEfektas.SNIEGAS;',
    );

    const result = service.compile(edited);
    expect(result.success).toBe(true);
    expect(result.rules.kepuresTipas).toBe('KARUNA');
    expect(result.rules.oroEfektas).toBe('SNIEGAS');
  });

  it('reads eye color from editable method and falls back for unknown enum value', () => {
    const service = new CodeCompilerService();
    const coloredEyes = CSHARP_TEMPLATE.replace('return Spalva.JUODA;', 'return Spalva.ROZINE;');
    const invalidEyes = CSHARP_TEMPLATE.replace('return Spalva.JUODA;', 'return Spalva.NEON;');

    const ok = service.compile(coloredEyes);
    expect(ok.success).toBe(true);
    expect(ok.rules.akiuSpalva).toBe('ROZINE');

    const bad = service.compile(invalidEyes);
    expect(bad.success).toBe(true);
    expect(bad.rules.akiuSpalva).toBe('JUODA');
  });

  it('fails compile when eye-color method uses invalid return type or missing return', () => {
    const service = new CodeCompilerService();
    const wrongReturnType = CSHARP_TEMPLATE.replace(
      `public Spalva AkiuSpalva()
    {
        return Spalva.JUODA;
    }`,
      `public string AkiuSpalva()
    {
        return "JUODA";
    }`,
    );
    const missingReturn = CSHARP_TEMPLATE.replace(
      'return Spalva.JUODA;',
      '// no return here on purpose',
    );

    expect(service.compile(wrongReturnType).success).toBe(false);
    expect(service.compile(missingReturn).success).toBe(false);
  });

  it('accepts enum members without type prefix for fields and eye-color method', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace(
      'public Spalva arklioSpalva = Spalva.SMELIO;',
      'public Spalva arklioSpalva = MELYNA;',
    )
      .replace(
        'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
        'public KepuresTipas kepuresTipas = KARUNA;',
      )
      .replace(
        'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
        'public OroEfektas oroEfektas = SNIEGAS;',
      )
      .replace('return Spalva.JUODA;', 'return ROZINE;');

    const result = service.compile(edited);
    expect(result.success).toBe(true);
    expect(result.rules.arklioSpalva).toBe('MELYNA');
    expect(result.rules.kepuresTipas).toBe('KARUNA');
    expect(result.rules.oroEfektas).toBe('SNIEGAS');
    expect(result.rules.akiuSpalva).toBe('ROZINE');
  });

  it('fails compile for invalid enum members in fields', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace(
      'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
      'public KepuresTipas kepuresTipas = KepuresTipas.PIRATAS;',
    ).replace(
      'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
      'public OroEfektas oroEfektas = OroEfektas.AUDRA;',
    );

    const result = service.compile(edited);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('kepuresTipas');
    expect(result.errors.join(' ')).toContain('oroEfektas');
  });

  it('fails compile for malformed numeric and boolean field assignments', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace(
      'public int geriTaskai = 50;',
      'public int geriTaskai = abc;',
    ).replace('public bool suKepure = false;', 'public bool suKepure = maybe;');

    const result = service.compile(edited);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('geriTaskai');
    expect(result.errors.join(' ')).toContain('suKepure');
  });

  it('fails compile when enum syntax is broken (missing commas)', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace('SMELIO,', 'SMELIO');

    const result = service.compile(edited);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('Enum Spalva');
  });

  it('fails compile when required enum declaration keyword is broken', () => {
    const service = new CodeCompilerService();
    const edited = CSHARP_TEMPLATE.replace('public enum OroEfektas', 'pubic enum OroEfektas');

    const result = service.compile(edited);
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toContain('OroEfektas');
  });

  it('releases parser tree for syntax-valid source', () => {
    const service = new CodeCompilerService();
    const deleteSpy = vi.fn();
    const rootNode = {
      hasError: false,
      isError: false,
      isMissing: false,
      childCount: 0,
      child: () => null,
    };
    const parseSpy = vi.fn(() => ({ rootNode, delete: deleteSpy }));
    (service as unknown as { syntaxParser: { parse: (source: string) => unknown } }).syntaxParser =
      {
        parse: parseSpy,
      };

    const result = service.compile(CSHARP_TEMPLATE);
    expect(result.success).toBe(true);
    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('releases parser tree for syntax-error source', () => {
    const service = new CodeCompilerService();
    const deleteSpy = vi.fn();
    const errorNode = {
      hasError: true,
      isError: true,
      isMissing: false,
      startPosition: { row: 1, column: 2 },
      childCount: 0,
      child: () => null,
    };
    const rootNode = {
      hasError: true,
      isError: false,
      isMissing: false,
      childCount: 1,
      child: () => errorNode,
    };
    const parseSpy = vi.fn(() => ({ rootNode, delete: deleteSpy }));
    (service as unknown as { syntaxParser: { parse: (source: string) => unknown } }).syntaxParser =
      {
        parse: parseSpy,
      };

    const result = service.compile(CSHARP_TEMPLATE);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('sintaksės klaidą');
    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
