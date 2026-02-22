import { test, expect } from '@playwright/test';

test.describe('Player Page', () => {
  test('invalid slug shows 404 page', async ({ page }) => {
    await page.goto('/play/nonexistent-slug-xyz');

    // Should show the not found page content
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});
