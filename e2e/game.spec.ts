import { expect, test } from '@playwright/test';

async function updateDanceRulesCode(
  page: import('@playwright/test').Page,
  mutate: (source: string) => string,
) {
  const studio = page.locator('.code-studio');
  const isOpen = await studio.evaluate((node) => (node as HTMLDetailsElement).open);
  if (!isOpen) {
    await page.locator('.code-studio summary').click();
  }

  const fallback = page.locator('#fallbackCode');
  await expect(fallback).toBeVisible();
  const current = await fallback.inputValue();
  const next = mutate(current);
  await fallback.fill(next);
}

function replaceRuleValue(source: string, field: string, valueLiteral: string): string {
  const matcher = new RegExp(`(public\\s+[\\w<>]+\\s+${field}\\s*=\\s*)([^;]+)(;)`);
  return source.replace(matcher, `$1${valueLiteral}$3`);
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
    await expect(page.locator('.dedication-footer')).toContainText(
      'Skirta Nidai – nuo Roberto. Su gimtadieniu! 🎉',
    );
    await expect(page.locator('#autoplayToggle')).toHaveText('Žaisti automatiškai: TAIP');

    const status = page.locator('#compileStatus');
    await expect
      .poll(async () => (await status.textContent())?.trim() ?? '', {
        message: 'Compile status should leave loading state',
      })
      .not.toBe('Kompiliuojama...');
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
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "KARUNA";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "ZAIBAS";')
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#ff9f66";',
        ),
    );

    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();

    await page.locator('.template-btn[data-template-id="uzsivedimo-raketa"]').click();

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await expect
      .poll(async () => {
        return await page.evaluate(() => window.__rhythmTest?.readEditorSource() ?? '');
      })
      .toContain('public int serijaIkiUzsivedimo = 3;');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.serijaIkiHype).toBe(3);
    expect(rules?.suKepure).toBe(true);
    expect(rules?.oroEfektas).toBe('SAULETA');
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
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "KAUBOJAUS";',
        ),
    );
    await expect(progress).toHaveText('4 / 5');

    await updateDanceRulesCode(page, (source) =>
      source
        .replace(
          'public string kepuresTipas = "KAUBOJAUS";',
          'public string kepuresTipas = "KARUNA";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "ZAIBAS";')
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#ff8b3d";',
        ),
    );
    await expect(progress).toHaveText('5 / 5');

    await expect(page.locator('#puzzleDone')).toBeVisible();
    await expect(page.locator('#templateReward')).toBeVisible();
    await expect(page.locator('#templateLockNote')).toBeHidden();
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
      replaceRuleValue(source, 'oroEfektas', '"ZAIBAS"'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#22aaff"'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'serijaIkiUzsivedimo', '4'),
    );
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) => replaceRuleValue(source, 'suKepure', 'true'));
    await expect(progress).toHaveText('0 / 5');

    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', '"KARUNA"'),
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
            'public string kepuresTipas = "KLASIKINE";',
            'public string kepuresTipas = "KARUNA";',
          ),
      );

      await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    };

    // Order A + backtracking: weather first, then color, then intentionally break/recover.
    await reachLastMissionGate();
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', '"ZAIBAS"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#39a7ff"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', '"SAULETA"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', '"LIETINGA"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#d6b48a"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#39a7ff"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', '"KAUBOJAUS"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'kepuresTipas', '"KARUNA"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');

    // Order B + backtracking: color first, then weather, then intentionally break/recover.
    await reachLastMissionGate();
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#39a7ff"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', '"ZAIBAS"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#d6b48a"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'oroEfektas', '"SNIEGAS"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('4 / 5');
    await updateDanceRulesCode(page, (source) =>
      replaceRuleValue(source, 'arklioSpalva', '"#8d5cff"'),
    );
    await expect(page.locator('#puzzleProgress')).toHaveText('5 / 5');
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

    await page.waitForTimeout(250);

    const alpha = await page.locator('#horseCanvas').evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return 0;
      }

      const x = Math.max(0, Math.floor(canvas.width / 2));
      const y = Math.max(0, Math.floor(canvas.height / 2));
      return ctx.getImageData(x, y, 1, 1).data[3];
    });

    expect(alpha).toBeGreaterThan(0);

    const edgeAlpha = await page.locator('#horseCanvas').evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return 0;
      }

      const x = Math.max(0, canvas.width - 2);
      const y = Math.max(0, canvas.height - 2);
      return ctx.getImageData(x, y, 1, 1).data[3];
    });

    expect(edgeAlpha).toBeGreaterThan(0);
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

  test('changing C# points changes real scoring speed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('#compileStatus')).not.toHaveText('Kompiliuojama...');

    const score = page.locator('#score');
    const baseStart = Number((await score.textContent()) ?? '0');
    await page.waitForTimeout(1800);
    const baseEnd = Number((await score.textContent()) ?? '0');
    const baseDelta = baseEnd - baseStart;
    expect(baseDelta).toBeGreaterThan(0);

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 420;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 50;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    const boostedStart = Number((await score.textContent()) ?? '0');
    await page.waitForTimeout(1800);
    const boostedEnd = Number((await score.textContent()) ?? '0');
    const boostedDelta = boostedEnd - boostedStart;

    expect(boostedDelta).toBeGreaterThan(baseDelta + 50);
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
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await expect
      .poll(async () => (await page.locator('#judgement').textContent())?.trim() ?? '', {
        timeout: 5000,
      })
      .toBe('UŽSIVEDĘS');
  });

  test('changing timing windows changes judgement outcomes for same offset', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
    });

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.01f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 0.02f;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(0.05) ?? false;
          return { ok, state: window.__rhythmTest?.read() };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#judgement')).toHaveText(/PRALEISTA|PER VELAI/);

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.01f;', 'public float tobulasLangas = 0.15f;')
        .replace('public float gerasLangas = 0.02f;', 'public float gerasLangas = 0.25f;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(0.05) ?? false;
          return { ok, state: window.__rhythmTest?.read() };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);
  });

  test('C# editor exposes horse color and cap fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) => {
      expect(source).toContain('public string arklioSpalva');
      expect(source).toContain('public string karciuSpalva');
      expect(source).toContain('public bool suKepure');
      expect(source).toContain('public string kepuresTipas');
      expect(source).toContain('public string oroEfektas');
      return source
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#3366cc";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "KAUBOJAUS";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "LIETINGA";');
    });

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');
  });

  test('changing visual C# fields updates rendered horse visual state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    const before = await page.evaluate(() => window.__rhythmTest?.readVisualState());
    expect(before).toBeDefined();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#1a8cff";',
        )
        .replace(
          'public string karciuSpalva = "#7d4f2d";',
          'public string karciuSpalva = "#f5a300";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "RAGANOS";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "LIETINGA";'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await page.waitForTimeout(120);
    const after = await page.evaluate(() => window.__rhythmTest?.readVisualState());
    expect(after?.arklioSpalva).toBe('#1a8cff');
    expect(after?.karciuSpalva).toBe('#f5a300');
    expect(after?.suKepure).toBe(true);
    expect(after?.kepuresTipas).toBe('RAGANOS');
    expect(after?.oroEfektas).toBe('LIETINGA');
    await expect(page.locator('body')).toHaveAttribute('data-weather', 'LIETINGA');
  });

  test('all editable C# DanceRules fields change live gameplay behavior', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.03f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 0.15f;')
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = 321;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = 123;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = 2;')
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#3366cc";',
        )
        .replace(
          'public string karciuSpalva = "#7d4f2d";',
          'public string karciuSpalva = "#ffcc00";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "KARUNA";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "SNIEGAS";'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
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

    const firstState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(firstState?.score).toBe(321);

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestTapAny(0.1) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    const secondState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(['GERAI', 'UŽSIVEDĘS']).toContain(secondState?.judgement);
    expect(secondState?.score).toBe(567);
    expect(secondState?.streak).toBe(2);

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestTapAny(0.3) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

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
    expect(rules?.arklioSpalva).toBe('#3366cc');
    expect(rules?.karciuSpalva).toBe('#ffcc00');
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

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(-0.5) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#judgement')).toHaveText('PER ANKSTI');
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

    const firstNote = await page.evaluate(() => window.__rhythmTest?.peekNearestAny());
    expect(firstNote).not.toBeNull();
    if (!firstNote) {
      return;
    }

    const earlyResult = await page.evaluate(
      ({ lane, timeSec }) => {
        return window.__rhythmTest?.playLaneAt(lane, timeSec - 0.5) ?? false;
      },
      { lane: firstNote.lane, timeSec: firstNote.timeSec },
    );
    expect(earlyResult).toBe(true);
    await expect(page.locator('#judgement')).toHaveText('PER ANKSTI');

    const replayResult = await page.evaluate(
      ({ lane, timeSec }) => {
        return window.__rhythmTest?.playLaneAt(lane, timeSec) ?? false;
      },
      { lane: firstNote.lane, timeSec: firstNote.timeSec },
    );
    expect(replayResult).toBe(true);

    await expect(page.locator('#judgement')).toHaveText(/PRALEISTA|PER ANKSTI/);
    await expect(page.locator('#score')).toHaveText('0');
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

    await expect(page.locator('#score')).not.toHaveText('0');
    await expect(page.locator('.hold-active')).toHaveCount(0);
    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);
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

    await page.evaluate(
      ({ lane, endSec }) => {
        window.__rhythmTest?.releaseLaneAt(lane, endSec - 0.01);
      },
      { lane: hold.lane, endSec: hold.timeSec + hold.holdDurationSec },
    );

    await expect(page.locator('#score')).not.toHaveText('0');
    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);
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

    await page.evaluate(
      ({ lane, timeSec }) => {
        window.__rhythmTest?.releaseLaneAt(lane, timeSec + 0.1);
      },
      { lane: hold.lane, timeSec: hold.timeSec },
    );

    await expect(page.locator('#judgement')).toHaveText('PALEIDAI PER ANKSTI');
    await expect(page.locator('#score')).toHaveText('0');
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

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(-0.5) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

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
          const ok = window.__rhythmTest?.playNearestAny(0) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    await expect(page.locator('#judgement')).toHaveText(/TOBULA|GERAI|UŽSIVEDĘS/);

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
        .replace('public string arklioSpalva = "#d6b48a";', 'public string arklioSpalva = "pink";')
        .replace(
          'public string karciuSpalva = "#7d4f2d";',
          'public string karciuSpalva = "#ABCDEF";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;')
        .replace(
          'public string kepuresTipas = "KLASIKINE";',
          'public string kepuresTipas = "PIRATAS";',
        )
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "AUDRA";'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobulasLangas).toBe(0.01);
    expect(rules?.gerasLangas).toBe(0.4);
    expect(rules?.tobuliTaskai).toBe(1000);
    expect(rules?.geriTaskai).toBe(5);
    expect(rules?.serijaIkiHype).toBe(2);
    expect(rules?.arklioSpalva).toBe('#d6b48a');
    expect(rules?.karciuSpalva).toBe('#ABCDEF');
    expect(rules?.suKepure).toBe(true);
    expect(rules?.kepuresTipas).toBe('KLASIKINE');
    expect(rules?.oroEfektas).toBe('SAULETA');
  });

  test('handles negative and malformed numeric values without breaking gameplay', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = -1f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = -2f;')
        .replace('public int tobuliTaskai = 100;', 'public int tobuliTaskai = -999;')
        .replace('public int geriTaskai = 50;', 'public int geriTaskai = abc;')
        .replace('public int serijaIkiUzsivedimo = 10;', 'public int serijaIkiUzsivedimo = -1;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    // Negative/malformed numeric fields fall back to defaults in parser.
    expect(rules?.tobulasLangas).toBe(0.05);
    expect(rules?.gerasLangas).toBe(0.12);
    expect(rules?.tobuliTaskai).toBe(100);
    expect(rules?.geriTaskai).toBe(50);
    expect(rules?.serijaIkiHype).toBe(10);

    await expect
      .poll(async () => Number((await page.locator('#score').textContent()) ?? '0'))
      .toBeGreaterThan(0);
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

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobuliTaskai).toBe(1000); // rounded then clamped max
    expect(rules?.geriTaskai).toBe(5); // rounded then clamped min
    expect(rules?.serijaIkiHype).toBe(50); // rounded and clamped max
  });

  test('keeps defaults for missing fields and invalid strings while staying playable', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public string arklioSpalva = "#d6b48a";', '')
        .replace('public string karciuSpalva = "#7d4f2d";', 'public string karciuSpalva = "123";')
        .replace('public bool suKepure = false;', 'public bool suKepure = TRUE;')
        .replace('public string kepuresTipas = "KLASIKINE";', 'public string kepuresTipas = "";')
        .replace('public string oroEfektas = "SAULETA";', 'public string oroEfektas = "??";'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('Paruošta');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.arklioSpalva).toBe('#d6b48a'); // missing field -> default
    expect(rules?.karciuSpalva).toBe('#7d4f2d'); // invalid color -> default
    expect(rules?.suKepure).toBe(true); // bool parser is case-insensitive
    expect(rules?.kepuresTipas).toBe('KLASIKINE'); // invalid hat -> default
    expect(rules?.oroEfektas).toBe('SAULETA'); // invalid weather -> default

    await expect
      .poll(async () => Number((await page.locator('#score').textContent()) ?? '0'))
      .toBeGreaterThan(0);
  });
});
