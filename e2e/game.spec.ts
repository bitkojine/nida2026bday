import { expect, test } from '@playwright/test';

async function updateDanceRulesCode(
  page: import('@playwright/test').Page,
  mutate: (source: string) => string,
) {
  await ensureCodeStudioOpen(page);

  const fallback = page.locator('#fallbackCode');
  await expect(fallback).toBeVisible();
  const current = await fallback.inputValue();
  const next = mutate(current);
  expect(next).not.toBe(current);
  await fallback.evaluate((node, value) => {
    const textarea = node as HTMLTextAreaElement;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }, next);
  await expect
    .poll(async () => {
      return await page.evaluate(() => window.__rhythmTest?.getRules() ?? null);
    })
    .not.toBeNull();
}

async function ensureCodeStudioOpen(page: import('@playwright/test').Page): Promise<void> {
  const studio = page.locator('.code-studio');
  const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
  if (!isOpen) {
    await page.locator('.code-studio summary').click();
  }
}

async function readCodeboxMetrics(page: import('@playwright/test').Page): Promise<{
  panelHeight: number;
  editorClientHeight: number;
  editorScrollHeight: number;
  sourceLineCount: number;
  gutterLineCount: number;
  firstGutterLine: string;
}> {
  return await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#editorPanel');
    const fallback = document.querySelector<HTMLTextAreaElement>('#fallbackCode');
    const lines = document.querySelector<HTMLPreElement>('#fallbackLines');
    const source = fallback?.value ?? '';
    const sourceLineCount = Math.max(1, source.split('\n').length);
    const gutterText = lines?.textContent ?? '';
    const gutterLines = gutterText.split('\n').filter((line) => line.trim().length > 0);

    return {
      panelHeight: Math.round(panel?.getBoundingClientRect().height ?? 0),
      editorClientHeight: fallback?.clientHeight ?? 0,
      editorScrollHeight: fallback?.scrollHeight ?? 0,
      sourceLineCount,
      gutterLineCount: gutterLines.length,
      firstGutterLine: gutterLines[0] ?? '',
    };
  });
}

async function ensurePerfStackOpen(page: import('@playwright/test').Page): Promise<void> {
  const perf = page.locator('.perf-stack');
  const isOpen = await perf.evaluate((node) => (node as HTMLDetailsElement).open);
  if (!isOpen) {
    await page.locator('.perf-stack > summary').click();
  }
}

function replaceRuleValue(source: string, field: string, valueLiteral: string): string {
  const matcher = new RegExp(`(public\\s+[\\w<>]+\\s+${field}\\s*=\\s*)([^;]+)(;)`);
  return source.replace(matcher, `$1${valueLiteral}$3`);
}

function applyMissionStageRules(source: string, solvedCount: number): string {
  const stage = Math.max(0, Math.min(5, Math.trunc(solvedCount)));
  let next = source;
  next = replaceRuleValue(next, 'tobulasLangas', stage >= 1 ? '0.08f' : '0.05f');
  next = replaceRuleValue(next, 'tobuliTaskai', stage >= 2 ? '170' : '100');
  next = replaceRuleValue(next, 'geriTaskai', stage >= 2 ? '80' : '50');
  next = replaceRuleValue(next, 'serijaIkiUzsivedimo', stage >= 3 ? '4' : '10');
  next = replaceRuleValue(next, 'suKepure', stage >= 4 ? 'true' : 'false');
  next = replaceRuleValue(
    next,
    'kepuresTipas',
    stage >= 5
      ? 'KepuresTipas.KARUNA'
      : stage >= 4
        ? 'KepuresTipas.KAUBOJAUS'
        : 'KepuresTipas.KLASIKINE',
  );
  next = replaceRuleValue(
    next,
    'oroEfektas',
    stage >= 5 ? 'OroEfektas.ZAIBAS' : 'OroEfektas.SAULETA',
  );
  next = replaceRuleValue(next, 'arklioSpalva', stage >= 5 ? 'Spalva.ORANZINE' : 'Spalva.SMELIO');
  return next;
}

async function playUpcomingTapWithOffset(
  page: import('@playwright/test').Page,
  offsetSec: number,
  minAheadSec = 0.12,
) {
  await expect
    .poll(async () => {
      return await page.evaluate(
        ({ safeMinAheadSec, safeOffsetSec }) => {
          const note = window.__rhythmTest?.peekUpcomingTapAny(safeMinAheadSec);
          if (!note) {
            return { ok: false, score: window.__rhythmTest?.read().score ?? 0 };
          }

          window.__rhythmTest?.playLaneAt(note.lane, note.timeSec + safeOffsetSec);
          return { ok: true, score: window.__rhythmTest?.read().score ?? 0 };
        },
        {
          safeMinAheadSec: Math.max(0, minAheadSec),
          safeOffsetSec: offsetSec,
        },
      );
    })
    .toMatchObject({ ok: true });
}

test.describe('Rhythm game flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __E2E_SILENT_AUDIO__?: boolean }).__E2E_SILENT_AUDIO__ = true;
    });
  });

  test('shows dedication at bottom and game is active immediately', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#heroCopy')).toContainText('🎁 Šokanti Arklio Ritmo Dovana');
    await expect(page.locator('#heroCopy')).toContainText(
      'Skirta Nidai – nuo Roberto. Su gimtadieniu! 🎉',
    );
    await expect(page.locator('#heroCopy')).toContainText('Versija:');
    await expect(page.locator('#autoplayToggle')).toHaveText('Žaisti automatiškai: TAIP');

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules() ?? null);
      })
      .not.toBeNull();
  });

  test('boots cleanly when localStorage access is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      const blockedAccess = () => {
        throw new DOMException('Blocked by browser policy', 'SecurityError');
      };
      try {
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get: blockedAccess,
        });
      } catch {
        try {
          Storage.prototype.getItem = blockedAccess;
          Storage.prototype.setItem = blockedAccess;
          Storage.prototype.removeItem = blockedAccess;
        } catch {
          // Ignore patch failures in restricted engines.
        }
      }
    });

    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#heroCopy')).toContainText('🎁 Šokanti Arklio Ritmo Dovana');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public class DanceRules');
  });

  test('mute button toggles sound state with Lithuanian labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const muteToggle = page.locator('#muteToggle');
    await expect(muteToggle).toHaveText('Garsas: ĮJUNGTAS');

    await muteToggle.click();
    await expect(muteToggle).toHaveText('Garsas: IŠJUNGTAS');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readAudioRuntime() ?? null);
      })
      .toMatchObject({ userMuted: true, outputMuted: true });

    await muteToggle.click();
    await expect(muteToggle).toHaveText('Garsas: ĮJUNGTAS');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readAudioRuntime() ?? null);
      })
      .toMatchObject({ userMuted: false });
  });

  test('mute setting is remembered after page reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const muteToggle = page.locator('#muteToggle');
    await expect(muteToggle).toHaveText('Garsas: ĮJUNGTAS');
    await muteToggle.click();
    await expect(muteToggle).toHaveText('Garsas: IŠJUNGTAS');

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#muteToggle')).toHaveText('Garsas: IŠJUNGTAS');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readAudioRuntime() ?? null);
      })
      .toMatchObject({ userMuted: true });
  });

  test('C# code is remembered after reload via localStorage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensureCodeStudioOpen(page);
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'tobulasLangas', '0.09f'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().tobulasLangas ?? null);
      })
      .toBe(0.09);

    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.localStorage.getItem('nida2026bday:editorSource:v1') ?? null,
        );
      })
      .toContain('public float tobulasLangas = 0.09f;');

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public float tobulasLangas = 0.09f;');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().tobulasLangas ?? null);
      })
      .toBe(0.09);
  });

  test('danger zone confirmation requires exact phrase and supports cancel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensurePerfStackOpen(page);
    const openButton = page.locator('#resetProgressButton');
    const dialog = page.locator('#resetProgressDialog');
    const input = page.locator('#resetProgressConfirmInput');
    const cancel = page.locator('#resetProgressCancelButton');
    const confirm = page.locator('#resetProgressConfirmButton');

    await openButton.click();
    await expect(dialog).toBeVisible();
    await expect(confirm).toBeDisabled();

    await input.fill('YES RESET');
    await expect(confirm).toBeDisabled();

    await input.fill('yes reset');
    await expect(confirm).toBeEnabled();

    await cancel.click();
    await expect(dialog).not.toBeVisible();
  });

  test('danger zone code reset confirmation requires exact phrase and supports cancel', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensurePerfStackOpen(page);
    const openButton = page.locator('#resetCodeButton');
    const dialog = page.locator('#resetCodeDialog');
    const input = page.locator('#resetCodeConfirmInput');
    const cancel = page.locator('#resetCodeCancelButton');
    const confirm = page.locator('#resetCodeConfirmButton');

    await openButton.click();
    await expect(dialog).toBeVisible();
    await expect(confirm).toBeDisabled();

    await input.fill('RESET CODE');
    await expect(confirm).toBeDisabled();

    await input.fill('reset code');
    await expect(confirm).toBeEnabled();

    await cancel.click();
    await expect(dialog).not.toBeVisible();
  });

  test('danger zone mission unlock dialog accepts only valid hidden cheat code', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensurePerfStackOpen(page);
    const openButton = page.locator('#unlockAllMissionsButton');
    const dialog = page.locator('#unlockAllMissionsDialog');
    const input = page.locator('#unlockAllMissionsConfirmInput');
    const cancel = page.locator('#unlockAllMissionsCancelButton');
    const confirm = page.locator('#unlockAllMissionsConfirmButton');

    await openButton.click();
    await expect(dialog).toBeVisible();
    await expect(confirm).toBeDisabled();

    await input.fill('bad-code');
    await page.waitForTimeout(120);
    await expect(confirm).toBeDisabled();

    await cancel.click();
    await expect(dialog).not.toBeVisible();
  });

  test('danger zone hidden cheat code marks all missions as complete and persists', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('0 / 5');

    await ensurePerfStackOpen(page);
    await page.locator('#unlockAllMissionsButton').click();

    const cheatCode = String.fromCharCode(109, 97, 107, 101, 109, 101, 112, 97, 115, 115);
    await page.locator('#unlockAllMissionsConfirmInput').fill(cheatCode);
    await expect(page.locator('#unlockAllMissionsConfirmButton')).toBeEnabled();
    await page.locator('#unlockAllMissionsConfirmButton').click();

    await expect(page.locator('#unlockAllMissionsDialog')).not.toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();
    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1') ?? null,
        );
      })
      .toBe('5');

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeVisible();
  });

  test('danger zone reset clears progress and restores default state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensureCodeStudioOpen(page);
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 3));
    await expect(page.locator('#puzzleProgress')).toHaveText('3 / 5');

    const muteToggle = page.locator('#muteToggle');
    await muteToggle.click();
    await expect(muteToggle).toHaveText('Garsas: IŠJUNGTAS');

    await ensurePerfStackOpen(page);
    await page.locator('#resetProgressButton').click();
    await page.locator('#resetProgressConfirmInput').fill('yes reset');
    await page.locator('#resetProgressConfirmButton').click();

    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('0 / 5');
    await expect(page.locator('#muteToggle')).toHaveText('Garsas: ĮJUNGTAS');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          return {
            solvedCount: window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
            soundMuted: window.localStorage.getItem('nida2026bday:soundMuted:v1'),
            legacyUnlock: window.localStorage.getItem('nida2026bday:puzzlesUnlocked:v1'),
            source: window.__rhythmTest?.readEditorSource() ?? '',
          };
        });
      })
      .toMatchObject({
        solvedCount: null,
        soundMuted: null,
        legacyUnlock: null,
      });

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public float tobulasLangas = 0.05f;');
  });

  test('danger zone code reset resets only code and keeps progress/sound', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await ensureCodeStudioOpen(page);
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 3));
    await expect(page.locator('#puzzleProgress')).toHaveText('3 / 5');

    const muteToggle = page.locator('#muteToggle');
    await muteToggle.click();
    await expect(muteToggle).toHaveText('Garsas: IŠJUNGTAS');

    await ensureCodeStudioOpen(page);
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'tobulasLangas', '0.095f'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().tobulasLangas ?? null);
      })
      .toBe(0.095);

    await ensurePerfStackOpen(page);
    await page.locator('#resetCodeButton').click();
    await page.locator('#resetCodeConfirmInput').fill('reset code');
    await page.locator('#resetCodeConfirmButton').click();

    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public float tobulasLangas = 0.05f;');
    await expect(page.locator('#puzzleProgress')).toHaveText('3 / 5');
    await expect(page.locator('#muteToggle')).toHaveText('Garsas: IŠJUNGTAS');

    await expect
      .poll(async () => {
        return await page.evaluate(() => ({
          solvedCount: window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
          soundMuted: window.localStorage.getItem('nida2026bday:soundMuted:v1'),
          editorSource: window.localStorage.getItem('nida2026bday:editorSource:v1'),
        }));
      })
      .toMatchObject({
        solvedCount: '3',
        soundMuted: '1',
      });

    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.localStorage.getItem('nida2026bday:editorSource:v1') ?? '',
        );
      })
      .toContain('public float tobulasLangas = 0.05f;');
  });

  test('danger zone code reset applies immediately without full page reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const autoplayToggle = page.locator('#autoplayToggle');
    await autoplayToggle.click();
    await expect(autoplayToggle).toHaveText('Žaisti automatiškai: NE');

    await ensureCodeStudioOpen(page);
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'tobulasLangas', '0.095f'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().tobulasLangas ?? null);
      })
      .toBe(0.095);

    await ensurePerfStackOpen(page);
    await page.locator('#resetCodeButton').click();
    await page.locator('#resetCodeConfirmInput').fill('reset code');
    await page.locator('#resetCodeConfirmInput').press('Enter');

    await expect(page.locator('#resetCodeDialog')).not.toBeVisible();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(autoplayToggle).toHaveText('Žaisti automatiškai: NE');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public float tobulasLangas = 0.05f;');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().tobulasLangas ?? null);
      })
      .toBe(0.05);
  });

  test('danger zone code reset recovers from invalid editor code back to default', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    await page.locator('#fallbackCode').evaluate((node) => {
      const textarea = node as HTMLTextAreaElement;
      const broken = textarea.value.replace(
        'public int geriTaskai = 50;',
        'public int geriTaskai = ;',
      );
      textarea.value = broken;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public int geriTaskai = ;');

    await ensurePerfStackOpen(page);
    await page.locator('#resetCodeButton').click();
    await page.locator('#resetCodeConfirmInput').fill('reset code');
    await page.locator('#resetCodeConfirmButton').click();

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public int geriTaskai = 50;');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules().geriTaskai ?? null);
      })
      .toBe(50);
    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.localStorage.getItem('nida2026bday:editorSource:v1') ?? '',
        );
      })
      .toContain('public int geriTaskai = 50;');
  });

  test('audio visualizer stays active with both įjungtas and išjungtas garsas', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.locator('.perf-stack > summary').click();
    const footer = page.locator('.perf-stack .perf-stack-body');
    await expect(footer.locator(':scope > #audioVisualizer')).toBeVisible();
    await expect(footer.locator(':scope > #perfStats')).toBeVisible();
    await expect(footer.locator('#perfStats')).not.toContainText('Versija:');

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const note = window.__rhythmTest?.peekUpcomingTapAny(0.2);
          if (!note) {
            return { ok: false, peak: 0 };
          }
          window.__rhythmTest?.playLaneAt(note.lane, note.timeSec);
          const viz = window.__rhythmTest?.readAudioVisualizer();
          return { ok: true, peak: viz?.peak ?? 0 };
        });
      })
      .toMatchObject({ ok: true });

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readAudioVisualizer().peak ?? 0);
      })
      .toBeGreaterThan(0);

    await page.locator('#muteToggle').click();
    await expect(page.locator('#muteToggle')).toHaveText('Garsas: IŠJUNGTAS');

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const note = window.__rhythmTest?.peekUpcomingTapAny(0.2);
          if (!note) {
            return { ok: false, peak: 0 };
          }
          window.__rhythmTest?.playLaneAt(note.lane, note.timeSec);
          const viz = window.__rhythmTest?.readAudioVisualizer();
          return { ok: true, peak: viz?.peak ?? 0 };
        });
      })
      .toMatchObject({ ok: true });

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readAudioVisualizer().peak ?? 0);
      })
      .toBeGreaterThan(0);
  });

  test('footer localStorage diagnostics show all key values and code line count only', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', '3');
      window.localStorage.setItem('nida2026bday:soundMuted:v1', '1');
      window.localStorage.setItem(
        'nida2026bday:editorSource:v1',
        `public class DanceRules
{
    public int tobuliTaskai = 123;
}
`,
      );
    });
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.locator('.perf-stack > summary').click();
    const footerStats = page.locator('#perfStats');
    await expect(footerStats).toContainText('nida2026bday:puzzlesSolvedCount:v1=3');
    await expect(footerStats).toContainText('nida2026bday:soundMuted:v1=1');
    await expect(footerStats).toContainText('nida2026bday:editorSource:v1=eilučių skaičius: 4');
    await expect(footerStats).not.toContainText('public class DanceRules');
    await expect(footerStats).not.toContainText('public int tobuliTaskai = 123;');
  });

  test('template buttons load preset code and apply gameplay changes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const studio = page.locator('.code-studio');
    const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!isOpen) {
      await page.locator('.code-studio summary').click();
    }

    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.09f;')
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 210;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 120;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 3;')
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
          'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
        )
        .replace(
          'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
          'public OroEfektas oroEfektas = OroEfektas.ZAIBAS;',
        )
        .replace(
          'public Spalva arklioSpalva = Spalva.SMELIO;',
          'public Spalva arklioSpalva = Spalva.ORANZINE;',
        ),
    );

    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    await page.locator('.template-btn[data-template-id="uzsivedimo-raketa"]').click();
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public int serijaIkiUzsivedimo = 3;');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('return Spalva.ORANZINE;');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.serijaIkiHype).toBe(3);
    expect(rules?.suKepure).toBe(true);
    expect(rules?.oroEfektas).toBe('SAULETA');
    expect(rules?.akiuSpalva).toBe('ORANZINE');
  });

  test('codebox supports resize and expands editable area height', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const studio = page.locator('.code-studio');
    const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!isOpen) {
      await page.locator('.code-studio summary').click();
    }

    const panel = page.locator('.editor-panel');
    const resizeMode = await panel.evaluate((el) => window.getComputedStyle(el).resize);
    expect(resizeMode).toBe('none');

    const fallback = page.locator('#fallbackCode');
    await expect(fallback).toBeVisible();
    const beforeHeight = await fallback.evaluate((el) => (el as HTMLElement).clientHeight);
    const beforePanelHeight = await panel.evaluate((el) => el.getBoundingClientRect().height);

    const resizeHandle = page.locator('#editorResizer');
    await expect(resizeHandle).toBeVisible();
    await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.editor-panel');
      const handle = document.querySelector<HTMLElement>('#editorResizer');
      if (!panel || !handle) {
        return;
      }
      const startY = panel.getBoundingClientRect().bottom - 6;
      handle.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY + 140,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY + 140,
        }),
      );
    });

    await expect
      .poll(async () => {
        return await panel.evaluate((el) => el.getBoundingClientRect().height);
      })
      .toBeGreaterThan(beforePanelHeight + 80);

    await expect
      .poll(async () => {
        return await fallback.evaluate((el) => (el as HTMLElement).clientHeight);
      })
      .toBeGreaterThan(beforeHeight + 80);
  });

  test('codebox opens without vertical scroll on initial load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    const fallback = page.locator('#fallbackCode');
    await expect(fallback).toBeVisible();

    const hasVerticalOverflow = await fallback.evaluate((el) => {
      const textarea = el as HTMLTextAreaElement;
      return textarea.scrollHeight > textarea.clientHeight + 1;
    });

    expect(hasVerticalOverflow).toBe(false);
  });

  test('codebox autosize stays bounded after reload and keeps line numbers visible', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#fallbackCode')).toBeVisible();

    const initial = await readCodeboxMetrics(page);
    expect(initial.firstGutterLine.trim()).toBe('1');
    expect(initial.gutterLineCount).toBeGreaterThanOrEqual(initial.sourceLineCount);
    expect(initial.gutterLineCount).toBeLessThan(initial.sourceLineCount * 8);
    expect(initial.panelHeight).toBeLessThanOrEqual(Math.max(220, initial.editorScrollHeight + 24));
    expect(initial.editorClientHeight + 1).toBeGreaterThanOrEqual(initial.editorScrollHeight);

    await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('#editorPanel');
      if (!panel) {
        return;
      }
      panel.style.height = '1800px';
      window.dispatchEvent(new Event('resize'));
    });

    await expect
      .poll(async () => {
        const metrics = await readCodeboxMetrics(page);
        return metrics.panelHeight - metrics.editorScrollHeight;
      })
      .toBeLessThanOrEqual(24);

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#fallbackCode')).toBeVisible();

    const afterReload = await readCodeboxMetrics(page);
    expect(afterReload.firstGutterLine.trim()).toBe('1');
    expect(afterReload.gutterLineCount).toBeGreaterThanOrEqual(afterReload.sourceLineCount);
    expect(afterReload.gutterLineCount).toBeLessThan(afterReload.sourceLineCount * 8);
    expect(afterReload.panelHeight).toBeLessThanOrEqual(
      Math.max(220, afterReload.editorScrollHeight + 24),
    );
    expect(afterReload.editorClientHeight + 1).toBeGreaterThanOrEqual(
      afterReload.editorScrollHeight,
    );
  });

  test('passes all learning missions step-by-step and unlocks templates', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const studio = page.locator('.code-studio');
    const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!isOpen) {
      await page.locator('.code-studio summary').click();
    }

    const progress = page.locator('#puzzleProgress');
    await expect(progress).toHaveText('0 / 5');
    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source.replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.08f;'),
    );
    await expect(progress).toHaveText('1 / 5');

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 170;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 80;'),
    );
    await expect(progress).toHaveText('2 / 5');

    await updateDanceRulesCode(page, (source) =>
      source.replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 4;'),
    );
    await expect(progress).toHaveText('3 / 5');

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
          'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
        ),
    );
    await expect(progress).toHaveText('4 / 5');

    await updateDanceRulesCode(page, (source) =>
      source
        .replace(
          'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
          'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
        )
        .replace(
          'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
          'public OroEfektas oroEfektas = OroEfektas.ZAIBAS;',
        )
        .replace(
          'public Spalva arklioSpalva = Spalva.SMELIO;',
          'public Spalva arklioSpalva = Spalva.ORANZINE;',
        ),
    );
    await expect(progress).toHaveText('5 / 5');

    await expect(page.locator('#puzzleDone')).toBeVisible();
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();
  });

  test('mission progress is remembered after reload before all missions are done', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const studio = page.locator('.code-studio');
    const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!isOpen) {
      await page.locator('.code-studio summary').click();
    }

    const progress = page.locator('#puzzleProgress');
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      source.replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.08f;'),
    );
    await expect(progress).toHaveText('1 / 5');

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 170;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 80;'),
    );
    await expect(progress).toHaveText('2 / 5');

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('2 / 5');
    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();
  });

  test('mission progress persists across reload at every milestone from 0 to 5', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    const progress = page.locator('#puzzleProgress');
    await expect(progress).toHaveText('0 / 5');

    for (let solved = 1; solved <= 5; solved += 1) {
      await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, solved));
      await expect(progress).toHaveText(`${solved} / 5`);

      if (solved < 5) {
        await expect(page.locator('#templateReward')).toBeHidden();
        await expect(page.locator('#templateLockNote')).toBeVisible();
      } else {
        await expect(page.locator('#templateReward')).toBeVisible();
        await expect(page.locator('#templateLockNote')).toBeHidden();
      }

      await page.reload();
      await expect(page.locator('#gameScreen')).toBeVisible();
      await expect(page.locator('#puzzleProgress')).toHaveText(`${solved} / 5`);
      await ensureCodeStudioOpen(page);

      if (solved < 5) {
        await expect(page.locator('#templateReward')).toBeHidden();
        await expect(page.locator('#templateLockNote')).toBeVisible();
      } else {
        await expect(page.locator('#templateReward')).toBeVisible();
        await expect(page.locator('#templateLockNote')).toBeHidden();
      }
    }
  });

  test('mission progress does not regress after lowering rules and reloading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    const progress = page.locator('#puzzleProgress');
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 3));
    await expect(progress).toHaveText('3 / 5');

    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 0));
    await expect(progress).toHaveText('3 / 5');

    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#puzzleProgress')).toHaveText('3 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();
  });

  test('with persisted partial progress, replaying completed missions does not double-count and new mission still advances', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', '2');
    });
    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    const progress = page.locator('#puzzleProgress');
    await expect(progress).toHaveText('2 / 5');

    // Re-applying already completed early-mission values must not increase progress.
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 2));
    await expect(progress).toHaveText('2 / 5');

    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
        );
      })
      .toBe('2');

    // First not-yet-completed mission should still advance normally.
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 3));
    await expect(progress).toHaveText('3 / 5');
    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
        );
      })
      .toBe('3');

    // Dropping rules after advancement must not regress persisted progress.
    await updateDanceRulesCode(page, (source) => applyMissionStageRules(source, 0));
    await expect(progress).toHaveText('3 / 5');
    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('3 / 5');
  });

  test('with persisted full progress, replaying or downgrading code keeps templates unlocked', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', '5');
    });
    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    // Even after changing rules away from defaults, persisted completion remains authoritative.
    await updateDanceRulesCode(page, (source) =>
      source.replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 130;'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    await expect
      .poll(async () => {
        return await page.evaluate(() =>
          window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
        );
      })
      .toBe('5');
  });

  test('mission progress storage gracefully handles invalid persisted values', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', '-2');
    });
    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('0 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeHidden();

    await page.evaluate(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', '999');
    });
    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    await page.evaluate(() => {
      window.localStorage.setItem('nida2026bday:puzzlesSolvedCount:v1', 'not-a-number');
    });
    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('0 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeHidden();
    await expect(page.locator('#templateLockNote')).toBeVisible();
  });

  test('legacy unlock key is migrated to solved-count progress and then removed', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.removeItem('nida2026bday:puzzlesSolvedCount:v1');
      window.localStorage.setItem('nida2026bday:puzzlesUnlocked:v1', '1');
    });

    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await ensureCodeStudioOpen(page);
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          return {
            solvedCount: window.localStorage.getItem('nida2026bday:puzzlesSolvedCount:v1'),
            legacyUnlock: window.localStorage.getItem('nida2026bday:puzzlesUnlocked:v1'),
          };
        });
      })
      .toEqual({ solvedCount: '5', legacyUnlock: null });
  });

  test('missions still complete when required changes are applied in different order', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const studio = page.locator('.code-studio');
    const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
    if (!isOpen) {
      await page.locator('.code-studio summary').click();
    }

    const progress = page.locator('#puzzleProgress');
    await expect(progress).toHaveText('0 / 5');

    // Apply late-mission values first, then fill early-mission requirements last.
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.ZAIBAS'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.MELYNA'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'serijaIkiUzsivedimo', '4'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) => replaceRuleValue(source, 'suKepure', 'true'));
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', 'KepuresTipas.KARUNA'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) => replaceRuleValue(source, 'geriTaskai', '80'));
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) => replaceRuleValue(source, 'tobuliTaskai', '170'));
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'tobulasLangas', '0.08f'),
    );
    await expect(progress).toHaveText('5 / 5');

    await expect(page.locator('#puzzleDone')).toBeVisible();
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();
  });

  test('last mission remains stable when required values are edited in mixed order', async ({
    page,
  }) => {
    const reachLastMissionGate = async (): Promise<void> => {
      await page.goto('/');
      await expect(page.locator('#gameScreen')).toBeVisible();

      const studio = page.locator('.code-studio');
      const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
      if (!isOpen) {
        await page.locator('.code-studio summary').click();
      }

      await updateDanceRulesCode(page, (source) =>
        source
          .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.08f;')
          .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 170;')
          .replace('public int geriTaskai = 50;', 'public int geriTaskai = 80;')
          .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 4;')
          .replace('public bool suKepure = false;', 'public bool suKepure = true;')
          .replace(
            'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
            'public KepuresTipas kepuresTipas = KepuresTipas.KARUNA;',
          ),
      );

      await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    };

    // Order A + backtracking: weather first, then color, then intentionally break/recover.
    await reachLastMissionGate();
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.ZAIBAS'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.MELYNA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.SAULETA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.LIETINGA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.SMELIO'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.MELYNA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', 'KepuresTipas.KAUBOJAUS'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', 'KepuresTipas.KARUNA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');

    // Reset persisted mission progress and code to validate order-B mission logic from a fresh gate.
    await page.evaluate(() => {
      window.localStorage.removeItem('nida2026bday:puzzlesSolvedCount:v1');
      window.localStorage.removeItem('nida2026bday:editorSource:v1');
    });

    // Order B + backtracking: color first, then weather, then intentionally break/recover.
    await reachLastMissionGate();
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.MELYNA'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.ZAIBAS'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.SMELIO'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', 'OroEfektas.SNIEGAS'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', 'Spalva.VIOLETINE'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');

    await page.reload();
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await page.locator('.code-studio summary').click();
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();
  });

  test('autoplay increases score without manual input', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const score = page.locator('#score');
    const baseScore = Number((await score.textContent()) ?? '0');

    await expect
      .poll(async () => Number((await score.textContent()) ?? '0'), {
        timeout: 5000,
      })
      .toBeGreaterThan(baseScore);
  });

  test('autoplay correctly holds long notes and scores after hold completion', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
      window.__rhythmTest?.resetScore();
    });

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readHoldState().autoHeldLanes ?? 0);
      })
      .toBeGreaterThan(0);

    const duringHoldScore = Number((await page.locator('#score').textContent()) ?? '0');

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readHoldState().autoHeldLanes ?? 0);
      })
      .toBe(0);

    await expect
      .poll(async () => Number((await page.locator('#score').textContent()) ?? '0'))
      .toBeGreaterThan(duringHoldScore);
  });

  test('supports touch-style gameplay input on lane buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const score = page.locator('#score');

    await page.locator('.input-row button').first().click();
    await expect
      .poll(async () => Number((await score.textContent()) ?? '0'))
      .toBeGreaterThanOrEqual(0);
    await expect(page.locator('#laneHighway')).toBeVisible();
    await expect.poll(async () => await page.locator('.note').count()).toBeGreaterThan(0);
  });

  test('renders non-empty pixels on game canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await expect
      .poll(async () => {
        return await page.locator('#horseCanvas').evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return 0;
          }

          const x = Math.max(0, Math.floor(canvas.width / 2));
          const y = Math.max(0, Math.floor(canvas.height / 2));
          return ctx.getImageData(x, y, 1, 1).data[3];
        });
      })
      .toBeGreaterThan(0);

    await expect
      .poll(async () => {
        return await page.locator('#horseCanvas').evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return 0;
          }

          const x = Math.max(0, canvas.width - 2);
          const y = Math.max(0, canvas.height - 2);
          return ctx.getImageData(x, y, 1, 1).data[3];
        });
      })
      .toBeGreaterThan(0);
  });

  test('character canvas does not stay side-squeezed after repeated reloads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    for (let i = 0; i < 3; i += 1) {
      if (i > 0) {
        await page.reload();
        await expect(page.locator('#gameScreen')).toBeVisible();
      }

      await expect
        .poll(async () => {
          return await page.evaluate(() => {
            const game = document.querySelector<HTMLElement>('#gameScreen');
            const horseCanvas = document.querySelector<HTMLCanvasElement>('#horseCanvas');
            if (!game || !horseCanvas) {
              return { ok: false, ratio: 0 };
            }
            const gameStyle = window.getComputedStyle(game);
            const horizontalPadding =
              Number.parseFloat(gameStyle.paddingLeft || '0') +
              Number.parseFloat(gameStyle.paddingRight || '0');
            const containerInnerWidth = Math.max(1, game.clientWidth - horizontalPadding);
            const canvasCssWidth = horseCanvas.getBoundingClientRect().width;
            return {
              ok: true,
              ratio: canvasCssWidth / containerInnerWidth,
              canvasCssWidth,
              containerInnerWidth,
            };
          });
        })
        .toMatchObject({ ok: true });

      const ratio = await page.evaluate(() => {
        const game = document.querySelector<HTMLElement>('#gameScreen');
        const horseCanvas = document.querySelector<HTMLCanvasElement>('#horseCanvas');
        if (!game || !horseCanvas) {
          return 0;
        }
        const gameStyle = window.getComputedStyle(game);
        const horizontalPadding =
          Number.parseFloat(gameStyle.paddingLeft || '0') +
          Number.parseFloat(gameStyle.paddingRight || '0');
        const containerInnerWidth = Math.max(1, game.clientWidth - horizontalPadding);
        return horseCanvas.getBoundingClientRect().width / containerInnerWidth;
      });
      expect(ratio).toBeGreaterThanOrEqual(0.92);
    }
  });

  test('weather background stays correctly rendered after codebox resize', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await ensureCodeStudioOpen(page);

    const resizeHandle = page.locator('#editorResizer');
    await expect(resizeHandle).toBeVisible();
    await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.editor-panel');
      const handle = document.querySelector<HTMLElement>('#editorResizer');
      if (!panel || !handle) {
        return;
      }
      const startY = panel.getBoundingClientRect().bottom - 6;
      handle.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY + 140,
        }),
      );
      window.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientY: startY + 140,
        }),
      );
    });

    const sample = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#weatherSceneCanvas');
      if (!canvas) {
        return null;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      const w = canvas.width;
      const h = canvas.height;
      const top = ctx.getImageData(Math.floor(w * 0.5), Math.floor(h * 0.14), 1, 1).data;
      const bottom = ctx.getImageData(Math.floor(w * 0.5), Math.floor(h * 0.9), 1, 1).data;
      return {
        top: { r: top[0], g: top[1], b: top[2], a: top[3] },
        bottom: { r: bottom[0], g: bottom[1], b: bottom[2], a: bottom[3] },
      };
    });

    expect(sample).not.toBeNull();
    if (!sample) {
      return;
    }
    expect(sample.top.a).toBeGreaterThan(0);
    expect(sample.bottom.a).toBeGreaterThan(0);
    // Top should stay sky-like (blue channel dominant).
    expect(sample.top.b).toBeGreaterThanOrEqual(sample.top.r);
    // Bottom should stay ground-like (green channel dominant).
    expect(sample.bottom.g).toBeGreaterThanOrEqual(sample.bottom.b);
  });

  test('sun remains visible inside top-right corner of large background', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const brightSunPixels = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('#weatherSceneCanvas');
      if (!canvas) {
        return 0;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return 0;
      }

      const xStart = Math.floor(canvas.width * 0.72);
      const yStart = 0;
      const width = Math.max(1, Math.floor(canvas.width * 0.28));
      const height = Math.max(1, Math.floor(canvas.height * 0.3));
      const data = ctx.getImageData(xStart, yStart, width, height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a > 0 && r >= 220 && g >= 175 && b <= 170) {
          count += 1;
        }
      }
      return count;
    });

    expect(brightSunPixels).toBeGreaterThan(40);
  });

  test('keeps game panel within viewport width', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const box = await page.locator('#gameScreen').boundingBox();
    expect(box).not.toBeNull();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) {
      return;
    }

    expect(box.width).toBeLessThanOrEqual(viewport.width);
  });

  test('fits iPhone landscape viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const layout = await page.evaluate(() => {
      const game = document.querySelector<HTMLElement>('#gameScreen');
      if (!game) {
        return { ok: false };
      }

      const rect = game.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const html = document.documentElement;
      return {
        ok: true,
        viewportWidth,
        gameWidth: rect.width,
        hasOverflow: html.scrollWidth > viewportWidth + 1,
      };
    });

    expect(layout.ok).toBe(true);
    if (!layout.ok) {
      return;
    }
    const viewportWidth = layout.viewportWidth ?? 0;
    expect(layout.hasOverflow).toBe(false);
    expect(layout.gameWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('fits desktop landscape viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const layout = await page.evaluate(() => {
      const game = document.querySelector<HTMLElement>('#gameScreen');
      if (!game) {
        return { ok: false };
      }

      const rect = game.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const html = document.documentElement;
      return {
        ok: true,
        viewportWidth,
        gameWidth: rect.width,
        hasOverflow: html.scrollWidth > viewportWidth + 1,
      };
    });

    expect(layout.ok).toBe(true);
    if (!layout.ok) {
      return;
    }
    const viewportWidth = layout.viewportWidth ?? 0;
    expect(layout.hasOverflow).toBe(false);
    expect(layout.gameWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test('@perf-common keeps stable gameplay cadence across projects', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
      window.__rhythmTest?.resetScore();
    });

    await page.waitForTimeout(2200);

    await expect
      .poll(
        async () => {
          return await page.evaluate(
            () => window.__rhythmTest?.readPerformance() ?? { fps: 0, visualCapFps: 0 },
          );
        },
        { timeout: 10000 },
      )
      .toMatchObject({ fps: expect.any(Number), visualCapFps: expect.any(Number) });

    const perf = await page.evaluate(() => window.__rhythmTest?.readPerformance() ?? null);
    expect(perf).not.toBeNull();
    if (!perf) {
      return;
    }

    if (testInfo.project.name === 'desktop-chromium') {
      expect(perf.visualCapFps).toBe(60);
      expect(perf.mobileMode).toBe(false);
      expect(perf.fps).toBeGreaterThanOrEqual(40);
      expect(perf.frameMs).toBeLessThanOrEqual(26);
      return;
    }

    expect(perf.mobileMode).toBe(true);
    expect([36, 45]).toContain(perf.visualCapFps);
    expect(perf.fps).toBeGreaterThanOrEqual(20);
    expect(perf.frameMs).toBeLessThanOrEqual(55);
  });

  test('@perf-common detects sustained FPS regressions on desktop', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
      window.__rhythmTest?.resetScore();
    });

    await page.waitForTimeout(3000);
    const samples: Array<{ fps: number; frameMs: number; mobileMode: boolean }> = [];
    for (let i = 0; i < 10; i += 1) {
      const perf = await page.evaluate(() => window.__rhythmTest?.readPerformance() ?? null);
      if (perf) {
        samples.push(perf);
      }
      await page.waitForTimeout(1000);
    }
    expect(samples.length).toBeGreaterThanOrEqual(8);

    const fpsValues = samples.map((sample) => sample.fps);
    const frameValues = samples.map((sample) => sample.frameMs);
    const averageFps = fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length;
    const worstFps = Math.min(...fpsValues);
    const averageFrameMs =
      frameValues.reduce((sum, value) => sum + value, 0) / Math.max(1, frameValues.length);

    if (testInfo.project.name === 'desktop-chromium') {
      expect(samples.every((sample) => sample.mobileMode === false)).toBe(true);
      expect(averageFps).toBeGreaterThanOrEqual(52);
      expect(worstFps).toBeGreaterThanOrEqual(38);
      expect(averageFrameMs).toBeLessThanOrEqual(20);
      return;
    }

    expect(samples.every((sample) => sample.mobileMode === true)).toBe(true);
    expect(averageFps).toBeGreaterThanOrEqual(20);
    expect(worstFps).toBeGreaterThanOrEqual(14);
  });

  test('@perf-common keeps beat tracking memory bounded during long autoplay', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
      window.__rhythmTest?.resetScore();
    });

    await page.waitForTimeout(8500);
    const firstSample = await page.evaluate(
      () => window.__rhythmTest?.readPlaybackTracking() ?? null,
    );
    expect(firstSample).not.toBeNull();
    if (!firstSample) {
      return;
    }

    expect(firstSample.autoPlayedBeatIds).toBeLessThanOrEqual(256);
    expect(firstSample.songPlayedBeatIds).toBeLessThanOrEqual(512);

    await page.waitForTimeout(8500);
    const secondSample = await page.evaluate(
      () => window.__rhythmTest?.readPlaybackTracking() ?? null,
    );
    expect(secondSample).not.toBeNull();
    if (!secondSample) {
      return;
    }

    expect(secondSample.autoPlayedBeatIds).toBeLessThanOrEqual(256);
    expect(secondSample.songPlayedBeatIds).toBeLessThanOrEqual(512);
  });

  test('changing C# points changes real scoring speed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const baseState = await page.evaluate(() => {
      const tap = window.__rhythmTest?.peekUpcomingTapAny(0.35);
      if (!tap) {
        return { ok: false, score: 0 };
      }
      window.__rhythmTest?.playLaneAt(tap.lane, tap.timeSec);
      return {
        ok: true,
        score: window.__rhythmTest?.read().score ?? 0,
      };
    });
    expect(baseState.ok).toBe(true);
    const baseDelta = baseState.score;
    expect(baseDelta).toBeGreaterThan(0);

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 420;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 50;'),
    );

    const boostedState = await page.evaluate(() => {
      window.__rhythmTest?.resetScore();
      const tap = window.__rhythmTest?.peekUpcomingTapAny(0.35);
      if (!tap) {
        return { ok: false, score: 0 };
      }
      window.__rhythmTest?.playLaneAt(tap.lane, tap.timeSec);
      return {
        ok: true,
        score: window.__rhythmTest?.read().score ?? 0,
      };
    });
    expect(boostedState.ok).toBe(true);
    expect(boostedState.score).toBeGreaterThan(baseDelta + 200);
  });

  test('changing C# hype threshold changes gameplay state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 2;')
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.2f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 0.25f;'),
    );
    await expect
      .poll(async () => (await page.locator('#judgement').textContent())?.trim() ?? '', {
        timeout: 5000,
      })
      .toBe('UŽSIVEDĘS');
  });

  test('default rules can still reach UŽSIVEDĘS during normal autoplay run', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await page.evaluate(() => {
      window.localStorage.removeItem('nida2026bday:editorSource:v1');
    });
    await page.reload();
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
      window.__rhythmTest?.resetScore();
    });

    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const read = window.__rhythmTest?.read();
            const rules = window.__rhythmTest?.getRules();
            return {
              judgement: read?.judgement ?? '',
              streak: read?.streak ?? 0,
              threshold: rules?.serijaIkiHype ?? 0,
            };
          });
        },
        { timeout: 18000 },
      )
      .toMatchObject({
        judgement: 'UŽSIVEDĘS',
      });
  });

  test('UŽSIVEDĘS status stays visible when a hold note starts during hype', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 2;')
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.2f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 0.25f;'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const firstTap = window.__rhythmTest?.peekUpcomingTapAny(0.12);
          if (!firstTap) {
            return { ok: false };
          }
          window.__rhythmTest?.playLaneAt(firstTap.lane, firstTap.timeSec);

          const secondTap = window.__rhythmTest?.peekUpcomingTapAny(0.12);
          if (!secondTap) {
            return { ok: false };
          }
          window.__rhythmTest?.playLaneAt(secondTap.lane, secondTap.timeSec);
          return { ok: true };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#judgement')).toHaveText('UŽSIVEDĘS');

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const hold = window.__rhythmTest?.peekNearestHoldAny();
          if (!hold) {
            return { ok: false };
          }
          window.__rhythmTest?.playLaneAt(hold.lane, hold.timeSec);
          const read = window.__rhythmTest?.read();
          return { ok: true, judgement: read?.judgement ?? '' };
        });
      })
      .toMatchObject({ ok: true, judgement: 'UŽSIVEDĘS' });
  });

  test('changing timing windows changes judgement outcomes for same offset', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(replaceRuleValue(source, 'tobulasLangas', '0.01f'), 'gerasLangas', '0.02f'),
    );
    await playUpcomingTapWithOffset(page, 0.05);

    await expect(page.locator('#judgement')).toHaveText(/PRALEISTA|PER VELAI/);

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(replaceRuleValue(source, 'tobulasLangas', '0.15f'), 'gerasLangas', '0.25f'),
    );
    await playUpcomingTapWithOffset(page, 0.05);

    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);
  });

  test('C# editor exposes horse color and cap fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) => {
      expect(source).toContain('public Spalva arklioSpalva');
      expect(source).toContain('public Spalva karciuSpalva');
      expect(source).toContain('public bool suKepure');
      expect(source).toContain('public KepuresTipas kepuresTipas');
      expect(source).toContain('public OroEfektas oroEfektas');
      return source
        .replace(
          'public Spalva arklioSpalva = Spalva.SMELIO;',
          'public Spalva arklioSpalva = Spalva.MELYNA;',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
          'public KepuresTipas kepuresTipas = KepuresTipas.KAUBOJAUS;',
        )
        .replace(
          'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
          'public OroEfektas oroEfektas = OroEfektas.LIETINGA;',
        );
    });
  });

  test('changing visual C# fields updates rendered horse visual state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const before = await page.evaluate(() => window.__rhythmTest?.readVisualState());
    expect(before).toBeDefined();

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(
        replaceRuleValue(
          replaceRuleValue(
            replaceRuleValue(
              replaceRuleValue(source, 'arklioSpalva', 'Spalva.MELYNA'),
              'karciuSpalva',
              'Spalva.AUKSINE',
            ),
            'suKepure',
            'true',
          ),
          'kepuresTipas',
          'KepuresTipas.RAGANOS',
        ),
        'oroEfektas',
        'OroEfektas.LIETINGA',
      ),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState() ?? null);
      })
      .toMatchObject({
        arklioSpalva: 'MELYNA',
        karciuSpalva: 'AUKSINE',
        suKepure: true,
        kepuresTipas: 'RAGANOS',
        oroEfektas: 'LIETINGA',
      });
    await expect(page.locator('body')).toHaveAttribute('data-weather', 'LIETINGA');
  });

  test('editable eye-color method changes horse eye color', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const baselineRules = await page.evaluate(() => window.__rhythmTest?.getRules() ?? null);
    expect(baselineRules?.akiuSpalva).toBe('JUODA');

    await updateDanceRulesCode(page, (source) =>
      source.replace('return Spalva.JUODA;', 'return Spalva.ROZINE;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.akiuSpalva ?? '');
      })
      .toBe('ROZINE');

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.akiuSpalva ?? '');
      })
      .toBe('ROZINE');

    await updateDanceRulesCode(page, (source) =>
      source.replace('return Spalva.ROZINE;', 'return Spalva.NEON;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.akiuSpalva ?? '');
      })
      .toBe('JUODA');
  });

  test('codebox keeps last valid rules when code is invalid, then recovers after fix', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source.replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 321;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(321);

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class DanceRules', 'public class'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(321);

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class', 'public class DanceRules'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(321);

    await updateDanceRulesCode(page, (source) =>
      source.replace('public int tobuliTaskai = 321;', 'public int tobuliTaskai = 222;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(222);
  });

  test('invalid code enables technical test background and sleeping horse until compile recovers', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const readWeatherPixelSample = async (): Promise<{
      r: number;
      g: number;
      b: number;
      a: number;
    } | null> => {
      return await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('#weatherSceneCanvas');
        if (!canvas) {
          return null;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return null;
        }
        const x = Math.floor(canvas.width * 0.75);
        const y = Math.floor(canvas.height * 0.05);
        const sample = ctx.getImageData(x, y, 1, 1).data;
        return { r: sample[0], g: sample[1], b: sample[2], a: sample[3] };
      });
    };

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);

    const validPixel = await readWeatherPixelSample();
    expect(validPixel).not.toBeNull();
    if (!validPixel) {
      return;
    }

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class DanceRules', 'public class'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? true);
      })
      .toBe(false);

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.mood ?? '');
      })
      .toBe('MIEGA');

    const invalidPixel = await readWeatherPixelSample();
    expect(invalidPixel).not.toBeNull();
    if (!invalidPixel) {
      return;
    }
    expect(invalidPixel.a).toBeGreaterThan(0);
    const colorDelta =
      Math.abs(invalidPixel.r - validPixel.r) +
      Math.abs(invalidPixel.g - validPixel.g) +
      Math.abs(invalidPixel.b - validPixel.b);
    expect(colorDelta).toBeGreaterThan(45);

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class', 'public class DanceRules'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.mood ?? '');
      })
      .not.toBe('MIEGA');
  });

  test('technical notice question-mark icon toggles details on both canvases', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const dispatchTechnicalIconPointer = async (
      canvasSelector: '#weatherSceneCanvas' | '#horseCanvas',
      icon: { x: number; y: number },
    ): Promise<void> => {
      await page.evaluate(
        ({ selector, x, y }) => {
          const canvas = document.querySelector<HTMLCanvasElement>(selector);
          if (!canvas) {
            return;
          }
          const rect = canvas.getBoundingClientRect();
          const clientX = rect.left + x;
          const clientY = rect.top + y;
          const event = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: 'mouse',
            button: 0,
            clientX,
            clientY,
          });
          canvas.dispatchEvent(event);
        },
        { selector: canvasSelector, x: icon.x, y: icon.y },
      );
    };

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class DanceRules', 'public class'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? true);
      })
      .toBe(false);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isTechnicalNoticeExpanded() ?? true);
      })
      .toBe(false);

    const railToggle = page.locator('#compileNoticeToggle');
    if (await railToggle.isVisible()) {
      await railToggle.click();
    } else {
      await expect
        .poll(async () => {
          return await page.evaluate(
            () => window.__rhythmTest?.readTechnicalNoticeIcons().weather ?? null,
          );
        })
        .toMatchObject({ x: expect.any(Number), y: expect.any(Number), r: expect.any(Number) });

      const weatherIconData = (await page.evaluate(
        () => window.__rhythmTest?.readTechnicalNoticeIcons().weather ?? null,
      )) as { x: number; y: number; r: number } | null;
      expect(weatherIconData).not.toBeNull();
      if (!weatherIconData) {
        return;
      }
      await dispatchTechnicalIconPointer('#weatherSceneCanvas', weatherIconData);
    }

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isTechnicalNoticeExpanded() ?? false);
      })
      .toBe(true);

    if (await railToggle.isVisible()) {
      await railToggle.click();
    } else {
      const horseNoticeToggle = page.locator('#horseCompileNoticeToggle');
      if (await horseNoticeToggle.isVisible()) {
        await horseNoticeToggle.click();
      } else {
        await expect
          .poll(async () => {
            return await page.evaluate(
              () => window.__rhythmTest?.readTechnicalNoticeIcons().horse ?? null,
            );
          })
          .toMatchObject({ x: expect.any(Number), y: expect.any(Number), r: expect.any(Number) });
        const horseIconData = (await page.evaluate(
          () => window.__rhythmTest?.readTechnicalNoticeIcons().horse ?? null,
        )) as { x: number; y: number; r: number } | null;
        expect(horseIconData).not.toBeNull();
        if (!horseIconData) {
          return;
        }
        await dispatchTechnicalIconPointer('#horseCanvas', horseIconData);
      }
    }

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isTechnicalNoticeExpanded() ?? true);
      })
      .toBe(false);
  });

  test('compile notices are both hidden when code compiles', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);

    await expect(page.locator('#compileNoticeRail')).toBeHidden();
    await expect(page.locator('#horseCompileNotice')).toBeHidden();
  });

  test('many broken C# syntax cases always trigger compile-invalid technical mode', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);

    const breakCases: Array<{
      label: string;
      breakCode: (source: string) => string;
      fixCode: (source: string) => string;
    }> = [
      {
        label: 'missing comma in Spalva enum',
        breakCode: (source) => source.replace('SMELIO,', 'SMELIO'),
        fixCode: (source) => source.replace('SMELIO\n', 'SMELIO,\n'),
      },
      {
        label: 'broken enum keyword',
        breakCode: (source) => source.replace('public enum OroEfektas', 'pubic enum OroEfektas'),
        fixCode: (source) => source.replace('pubic enum OroEfektas', 'public enum OroEfektas'),
      },
      {
        label: 'missing field semicolon',
        breakCode: (source) =>
          source.replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 100'),
        fixCode: (source) =>
          source.replace('public int tobuliTaskai = 100\n', 'public int tobuliTaskai = 100;\n'),
      },
      {
        label: 'broken class keyword',
        breakCode: (source) => source.replace('public class DanceRules', 'publik class DanceRules'),
        fixCode: (source) => source.replace('publik class DanceRules', 'public class DanceRules'),
      },
      {
        label: 'broken return keyword in method',
        breakCode: (source) => source.replace('return Spalva.JUODA;', 'retur Spalva.JUODA;'),
        fixCode: (source) => source.replace('retur Spalva.JUODA;', 'return Spalva.JUODA;'),
      },
    ];

    for (const testCase of breakCases) {
      await updateDanceRulesCode(page, testCase.breakCode);
      await expect
        .poll(
          async () => {
            return await page.evaluate(() => ({
              valid: window.__rhythmTest?.isCompileValid() ?? true,
              mood: window.__rhythmTest?.readVisualState()?.mood ?? '',
            }));
          },
          {
            message: `Neįsijungė techninis režimas: ${testCase.label}`,
          },
        )
        .toMatchObject({ valid: false, mood: 'MIEGA' });

      await updateDanceRulesCode(page, testCase.fixCode);
      await expect
        .poll(
          async () => {
            return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
          },
          {
            message: `Nepavyko atsistatyti po pataisymo: ${testCase.label}`,
          },
        )
        .toBe(true);
    }
  });

  test('sleep mode blocks horse note particles even when autoplay is enabled', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
      window.__rhythmTest?.playNearestTapAny(0);
    });
    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.__rhythmTest?.readHorseRuntime().noteParticles ?? 0,
        );
      })
      .toBeGreaterThan(0);

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(true);
    });

    await updateDanceRulesCode(page, (source) =>
      source.replace('public class DanceRules', 'public class'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? true);
      })
      .toBe(false);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.mood ?? '');
      })
      .toBe('MIEGA');
    await expect
      .poll(async () => {
        return await page.evaluate(
          () => window.__rhythmTest?.readHorseRuntime().noteParticles ?? -1,
        );
      })
      .toBe(0);

    await page.waitForTimeout(900);
    expect(
      await page.evaluate(() => window.__rhythmTest?.readHorseRuntime().noteParticles ?? -1),
    ).toBe(0);
  });

  test('codebox accepts enum values without type prefix in fields and method', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace(
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
        .replace('return Spalva.JUODA;', 'return ROZINE;'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules() ?? null);
      })
      .toMatchObject({
        arklioSpalva: 'MELYNA',
        kepuresTipas: 'KARUNA',
        oroEfektas: 'SNIEGAS',
        akiuSpalva: 'ROZINE',
      });
  });

  test('eye-color method handles legacy string return and unknown value fallback', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source.replace(
        `public Spalva AkiuSpalva()
    {
        return Spalva.JUODA;
    }`,
        `public string AkiuSpalva()
    {
        return "#ff93d1";
    }`,
      ),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.akiuSpalva ?? '');
      })
      .toBe('ROZINE');

    await updateDanceRulesCode(page, (source) =>
      source.replace('return "#ff93d1";', 'return "#123456";'),
    );

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.akiuSpalva ?? '');
      })
      .toBe('JUODA');
  });

  test('all editable C# DanceRules fields change live gameplay behavior', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(
        replaceRuleValue(
          replaceRuleValue(
            replaceRuleValue(
              replaceRuleValue(
                replaceRuleValue(
                  replaceRuleValue(
                    replaceRuleValue(
                      replaceRuleValue(
                        replaceRuleValue(source, 'tobulasLangas', '0.03f'),
                        'gerasLangas',
                        '0.15f',
                      ),
                      'tobuliTaskai',
                      '321',
                    ),
                    'geriTaskai',
                    '123',
                  ),
                  'serijaIkiUzsivedimo',
                  '2',
                ),
                'arklioSpalva',
                'Spalva.MELYNA',
              ),
              'karciuSpalva',
              'Spalva.AUKSINE',
            ),
            'suKepure',
            'true',
          ),
          'kepuresTipas',
          'KepuresTipas.KARUNA',
        ),
        'oroEfektas',
        'OroEfektas.SNIEGAS',
      ),
    );
    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    await playUpcomingTapWithOffset(page, 0);

    const firstState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(firstState?.score).toBe(321);

    await playUpcomingTapWithOffset(page, 0.1);

    const secondState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(['GERAI', 'UŽSIVEDĘS']).toContain(secondState?.judgement);
    expect(secondState?.score).toBe(567);
    expect(secondState?.streak).toBe(2);

    await playUpcomingTapWithOffset(page, 0.3);

    const thirdState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(['PRALEISTA', 'PER VELAI']).toContain(thirdState?.judgement);
    expect(thirdState?.score).toBe(567);
    expect(thirdState?.streak).toBe(0);

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobulasLangas).toBe(0.03);
    expect(rules?.gerasLangas).toBe(0.15);
    expect(rules?.tobuliTaskai).toBe(321);
    expect(rules?.geriTaskai).toBe(123);
    expect(rules?.serijaIkiHype).toBe(2);
    expect(rules?.arklioSpalva).toBe('MELYNA');
    expect(rules?.karciuSpalva).toBe('AUKSINE');
    expect(rules?.suKepure).toBe(true);
    expect(rules?.kepuresTipas).toBe('KARUNA');
    expect(rules?.oroEfektas).toBe('SNIEGAS');
  });

  test('shows PER ANKSTI when press is way too early', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const firstNote = await page.evaluate(() => window.__rhythmTest?.peekUpcomingTapAny(0.6));
    expect(firstNote).not.toBeNull();
    if (!firstNote) {
      return;
    }

    const result = await page.evaluate(
      ({ lane, timeSec }) => {
        const ok = window.__rhythmTest?.playLaneAt(lane, timeSec - 0.5) ?? false;
        return {
          ok,
          state: window.__rhythmTest?.read(),
        };
      },
      { lane: firstNote.lane, timeSec: firstNote.timeSec },
    );

    expect(result.ok).toBe(true);
    expect(result.state?.judgement).toBe('PER ANKSTI');
  });

  test('too-early hit consumes that note and does not allow replay on exact timestamp', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const firstNote = await page.evaluate(() => window.__rhythmTest?.peekUpcomingTapAny(0.6));
    expect(firstNote).not.toBeNull();
    if (!firstNote) {
      return;
    }

    const earlyResult = await page.evaluate(
      ({ lane, timeSec }) => {
        const ok = window.__rhythmTest?.playLaneAt(lane, timeSec - 0.5) ?? false;
        return {
          ok,
          state: window.__rhythmTest?.read() ?? null,
        };
      },
      { lane: firstNote.lane, timeSec: firstNote.timeSec },
    );
    expect(earlyResult.ok).toBe(true);
    expect(earlyResult.state?.judgement).toBe('PER ANKSTI');

    const replayResult = await page.evaluate(
      ({ lane, timeSec }) => {
        const ok = window.__rhythmTest?.playLaneAt(lane, timeSec) ?? false;
        return {
          ok,
          state: window.__rhythmTest?.read() ?? null,
        };
      },
      { lane: firstNote.lane, timeSec: firstNote.timeSec },
    );
    expect(replayResult.ok).toBe(true);
    expect(['PRALEISTA', 'PER ANKSTI', 'PER VELAI']).toContain(replayResult.state?.judgement);
    expect(replayResult.state?.score).toBe(0);
  });

  test('early but valid hit still keeps background song playback for that beat', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const target = await page.evaluate(() => window.__rhythmTest?.peekUpcomingTapAny(0.6));
    expect(target).not.toBeNull();
    if (!target) {
      return;
    }

    const hitOk = await page.evaluate(
      ({ lane, timeSec }) => {
        return window.__rhythmTest?.playLaneAt(lane, timeSec - 0.02) ?? false;
      },
      { lane: target.lane, timeSec: target.timeSec },
    );
    expect(hitOk).toBe(true);
    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);

    await expect
      .poll(
        async () =>
          await page.evaluate(
            (beatId) => window.__rhythmTest?.wasSongBeatPlayed(beatId) ?? false,
            target.id,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test('hold note gives score only after full hold is played', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const hold = await page.evaluate(() => window.__rhythmTest?.peekNearestHoldAny());
    expect(hold).not.toBeNull();
    if (!hold) {
      return;
    }

    await page.evaluate(
      ({ lane, timeSec }) => {
        window.__rhythmTest?.playLaneAt(lane, timeSec);
      },
      { lane: hold.lane, timeSec: hold.timeSec },
    );
    await expect(page.locator('#judgement')).toHaveText('LAIKYK');
    await expect(page.locator('.hold-active')).toHaveCount(1);
    await expect(page.locator('#score')).toHaveText('0');

    await page.evaluate(
      ({ lane, endSec }) => {
        window.__rhythmTest?.releaseLaneAt(lane, endSec + 0.01);
      },
      { lane: hold.lane, endSec: hold.timeSec + hold.holdDurationSec },
    );

    await expect(page.locator('.hold-active')).toHaveCount(0);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.read().score ?? 0);
      })
      .toBeGreaterThan(0);
  });

  test('releasing just before hold end still scores within timing window', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const hold = await page.evaluate(() => window.__rhythmTest?.peekNearestHoldAny());
    expect(hold).not.toBeNull();
    if (!hold) {
      return;
    }

    await page.evaluate(
      ({ lane, timeSec }) => {
        window.__rhythmTest?.playLaneAt(lane, timeSec);
      },
      { lane: hold.lane, timeSec: hold.timeSec },
    );
    await expect(page.locator('#judgement')).toHaveText('LAIKYK');

    const releasedState = await page.evaluate(
      ({ lane, endSec }) => {
        window.__rhythmTest?.releaseLaneAt(lane, endSec - 0.01);
        return window.__rhythmTest?.read() ?? null;
      },
      { lane: hold.lane, endSec: hold.timeSec + hold.holdDurationSec },
    );

    expect(releasedState).not.toBeNull();
    expect(releasedState?.score).toBeGreaterThan(0);
    expect(['TOBULA', 'GERAI', 'UŽSIVEDĘS']).toContain(releasedState?.judgement);
  });

  test('releasing hold note too early counts as miss', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const hold = await page.evaluate(() => window.__rhythmTest?.peekNearestHoldAny());
    expect(hold).not.toBeNull();
    if (!hold) {
      return;
    }

    await page.evaluate(
      ({ lane, timeSec }) => {
        window.__rhythmTest?.playLaneAt(lane, timeSec);
      },
      { lane: hold.lane, timeSec: hold.timeSec },
    );
    await expect(page.locator('#judgement')).toHaveText('LAIKYK');

    const releaseState = await page.evaluate(
      ({ lane, timeSec }) => {
        window.__rhythmTest?.releaseLaneAt(lane, timeSec + 0.1);
        return window.__rhythmTest?.read() ?? null;
      },
      { lane: hold.lane, timeSec: hold.timeSec },
    );

    expect(releaseState).not.toBeNull();
    expect(['PALEIDAI PER ANKSTI', 'PRALEISTA']).toContain(releaseState?.judgement);
    expect(releaseState?.score).toBe(0);
  });

  test('Vertinimas wraps without shifting HUD height between short and long statuses', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    const earlyOutcome = await page.evaluate(() => {
      const upcoming = window.__rhythmTest?.peekUpcomingTapAny(0.6);
      if (!upcoming) {
        return { ok: false as const, state: null };
      }
      window.__rhythmTest?.playLaneAt(upcoming.lane, upcoming.timeSec - 0.5);
      return {
        ok: true as const,
        state: window.__rhythmTest?.read() ?? null,
      };
    });
    expect(earlyOutcome.ok).toBe(true);
    expect(earlyOutcome.state?.judgement).toBe('PER ANKSTI');

    await expect(page.locator('#judgement')).toHaveText('PER ANKSTI');

    const longHeight = await page.locator('#judgement').evaluate((node) => {
      const el = node as HTMLElement;
      return {
        height: Math.round(el.getBoundingClientRect().height),
        fits: el.scrollHeight <= el.clientHeight + 1,
      };
    });

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestTapAny(0) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#score')).not.toHaveText('0');

    const shortHeight = await page.locator('#judgement').evaluate((node) => {
      const el = node as HTMLElement;
      return Math.round(el.getBoundingClientRect().height);
    });

    expect(longHeight.fits).toBe(true);
    expect(Math.abs(shortHeight - longHeight.height)).toBeLessThanOrEqual(3);
  });

  test('C# sandbox clamps and guards all editable values', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.001f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 99f;')
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 99999;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 1;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 1;')
        .replace('public bool suKepure = false;', 'public bool suKepure = true;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);
    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobulasLangas).toBe(0.01);
    expect(rules?.gerasLangas).toBe(0.4);
    expect(rules?.tobuliTaskai).toBe(1000);
    expect(rules?.geriTaskai).toBe(5);
    expect(rules?.serijaIkiHype).toBe(2);
    expect(rules?.arklioSpalva).toBe('SMELIO');
    expect(rules?.karciuSpalva).toBe('TAMSIAI_RUDA');
    expect(rules?.suKepure).toBe(true);
    expect(rules?.kepuresTipas).toBe('KLASIKINE');
    expect(rules?.oroEfektas).toBe('SAULETA');
  });

  test('negative numeric values are clamped and remain playable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = -1f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = -2f;')
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = -999;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = -10;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = -1;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? false);
      })
      .toBe(true);
    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobulasLangas).toBe(0.01);
    expect(rules?.gerasLangas).toBe(0.02);
    expect(rules?.tobuliTaskai).toBe(10);
    expect(rules?.geriTaskai).toBe(5);
    expect(rules?.serijaIkiHype).toBe(2);

    await expect
      .poll(async () => Number((await page.locator('#score').textContent()) ?? '0'))
      .toBeGreaterThan(0);
  });

  test('malformed numeric assignment fails compile and keeps previous rules', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source.replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 321;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(321);

    await updateDanceRulesCode(page, (source) =>
      source.replace('public int geriTaskai = 50;', 'public int geriTaskai = abc;'),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? true);
      })
      .toBe(false);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.mood ?? '');
      })
      .toBe('MIEGA');
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.getRules()?.tobuliTaskai ?? 0);
      })
      .toBe(321);
  });

  test('rounds and clamps decimal/extreme integer values predictably', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 999.7;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 4.4;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 49.6;'),
    );
    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobuliTaskai).toBe(1000); // rounded then clamped max
    expect(rules?.geriTaskai).toBe(5); // rounded then clamped min
    expect(rules?.serijaIkiHype).toBe(50); // rounded and clamped max
  });

  test('invalid enum/bool assignments fail compile and keep last valid rules', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public Spalva arklioSpalva = Spalva.SMELIO;', '')
        .replace(
          'public Spalva karciuSpalva = Spalva.TAMSIAI_RUDA;',
          'public Spalva karciuSpalva = Spalva.NEON;',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = TRUE;')
        .replace(
          'public KepuresTipas kepuresTipas = KepuresTipas.KLASIKINE;',
          'public KepuresTipas kepuresTipas = KepuresTipas.PIRATAS;',
        )
        .replace(
          'public OroEfektas oroEfektas = OroEfektas.SAULETA;',
          'public OroEfektas oroEfektas = OroEfektas.AUDRA;',
        ),
    );
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.isCompileValid() ?? true);
      })
      .toBe(false);
    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readVisualState()?.mood ?? '');
      })
      .toBe('MIEGA');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.arklioSpalva).toBe('SMELIO');
    expect(rules?.karciuSpalva).toBe('TAMSIAI_RUDA');
    expect(rules?.suKepure).toBe(false);
    expect(rules?.kepuresTipas).toBe('KLASIKINE');
    expect(rules?.oroEfektas).toBe('SAULETA');

    await expect
      .poll(async () => Number((await page.locator('#score').textContent()) ?? '0'))
      .toBeGreaterThan(0);
  });
});
