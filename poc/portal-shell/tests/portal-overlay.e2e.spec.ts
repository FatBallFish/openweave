import { expect, test } from '@playwright/test';
import { launchPortalShell } from './support';

test('switches the live WebContentsView and falls back to screenshot while zoomed out', async () => {
  const { app, page } = await launchPortalShell();

  await page.getByRole('button', { name: 'Activate portal-b' }).click();
  await expect(page.getByTestId('active-portal-id')).toHaveText('portal-b');
  await expect(page.getByTestId('live-portal-id')).toHaveText('portal-b');

  await page.getByRole('slider', { name: 'Canvas zoom' }).evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '0.4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByTestId('live-portal-id')).toHaveText('none');
  await expect(page.getByTestId('portal-b-fallback')).toBeVisible();

  await app.close();
});
