import { test, expect } from '@playwright/test';

test.describe('Puzzle Generation', () => {
  test('homepage loads with generate button', async ({ page }) => {
    await page.goto('/');

    // Should show the generate button
    const generateBtn = page.getByRole('button', { name: /generate/i });
    await expect(generateBtn).toBeVisible();

    // Wait for the worker to be ready (button becomes enabled)
    await expect(generateBtn).toBeEnabled({ timeout: 30000 });
  });

  test('generates a puzzle with grid and clues', async ({ page }) => {
    await page.goto('/');

    // Wait for word list to load
    const generateBtn = page.getByRole('button', { name: /generate/i });
    await expect(generateBtn).toBeEnabled({ timeout: 30000 });

    // Click generate
    await generateBtn.click();

    // Should show "Generating..." state
    await expect(page.getByRole('button', { name: /generating/i })).toBeVisible();

    // Wait for grid to appear (generation can take up to 60s)
    await expect(page.locator('.grid-container')).toBeVisible({ timeout: 60000 });

    // Grid should have cells
    const cells = page.locator('.grid-cell');
    await expect(cells.first()).toBeVisible();

    // Should have both Across and Down clue sections
    await expect(page.getByText('Across')).toBeVisible();
    await expect(page.getByText('Down')).toBeVisible();

    // Should have clue items
    const clueItems = page.locator('.clue-item');
    expect(await clueItems.count()).toBeGreaterThan(0);
  });
});
