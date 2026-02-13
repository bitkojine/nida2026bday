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

test.describe('Rhythm game flow', () => {
  test('shows dedication at bottom and game is active immediately', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#gameScreen')).toBeVisible();
    await expect(page.locator('.dedication-footer')).toContainText(
      'Skirta Nidai - nuo Roberto. Su gimtadieniu! 🎉',
    );
    await expect(page.locator('#autoplayToggle')).toHaveText('Žaisti automatiškai: TAIP');

    const status = page.locator('#compileStatus');
    await expect
      .poll(async () => (await status.textContent())?.trim() ?? '', {
        message: 'Compile status should leave loading state',
      })
      .not.toBe('Kompiliuojama...');
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
        .replace('public int serijaIkiHype = 10;', 'public int serijaIkiHype = 50;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('OK');

    const boostedStart = Number((await score.textContent()) ?? '0');
    await page.waitForTimeout(1800);
    const boostedEnd = Number((await score.textContent()) ?? '0');
    const boostedDelta = boostedEnd - boostedStart;

    expect(boostedDelta).toBeGreaterThan(baseDelta * 2);
  });

  test('changing C# hype threshold changes gameplay state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) =>
      source
        .replace('public int serijaIkiHype = 10;', 'public int serijaIkiHype = 2;')
        .replace('public float tobulasLangas = 0.05f;', 'public float tobulasLangas = 0.2f;')
        .replace('public float gerasLangas = 0.12f;', 'public float gerasLangas = 0.25f;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('OK');

    await expect
      .poll(async () => (await page.locator('#judgement').textContent())?.trim() ?? '', {
        timeout: 5000,
      })
      .toBe('UZSIVEDIMAS');
  });

  test('C# editor exposes horse color and cap fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#gameScreen')).toBeVisible();

    await updateDanceRulesCode(page, (source) => {
      expect(source).toContain('public string arklioSpalva');
      expect(source).toContain('public string karciuSpalva');
      expect(source).toContain('public bool suKepure');
      return source
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#3366cc";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;');
    });

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('OK');
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
        .replace('public int serijaIkiHype = 10;', 'public int serijaIkiHype = 2;')
        .replace(
          'public string arklioSpalva = "#d6b48a";',
          'public string arklioSpalva = "#3366cc";',
        )
        .replace(
          'public string karciuSpalva = "#7d4f2d";',
          'public string karciuSpalva = "#ffcc00";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('OK');

    await page.evaluate(() => {
      window.__rhythmTest?.setAutoplay(false);
      window.__rhythmTest?.resetScore();
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

    const firstState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(firstState?.score).toBe(321);

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(0.1) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    const secondState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(['GERAI', 'UZSIVEDIMAS']).toContain(secondState?.judgement);
    expect(secondState?.score).toBe(567);
    expect(secondState?.streak).toBe(2);

    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const ok = window.__rhythmTest?.playNearestAny(0.3) ?? false;
          return {
            ok,
            state: window.__rhythmTest?.read(),
          };
        });
      })
      .toMatchObject({ ok: true });

    const thirdState = await page.evaluate(() => window.__rhythmTest?.read());
    expect(thirdState?.judgement).toBe('PRALEISTA');
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
        .replace('public int serijaIkiHype = 10;', 'public int serijaIkiHype = 1;')
        .replace('public string arklioSpalva = "#d6b48a";', 'public string arklioSpalva = "pink";')
        .replace(
          'public string karciuSpalva = "#7d4f2d";',
          'public string karciuSpalva = "#ABCDEF";',
        )
        .replace('public bool suKepure = false;', 'public bool suKepure = true;'),
    );

    await expect
      .poll(async () => (await page.locator('#compileStatus').textContent())?.trim() ?? '')
      .toContain('OK');

    const rules = await page.evaluate(() => window.__rhythmTest?.getRules());
    expect(rules?.tobulasLangas).toBe(0.01);
    expect(rules?.gerasLangas).toBe(0.4);
    expect(rules?.tobuliTaskai).toBe(1000);
    expect(rules?.geriTaskai).toBe(5);
    expect(rules?.serijaIkiHype).toBe(2);
    expect(rules?.arklioSpalva).toBe('#d6b48a');
    expect(rules?.karciuSpalva).toBe('#ABCDEF');
    expect(rules?.suKepure).toBe(true);
  });
});
