import { expect, test } from '@playwright/test';
import { launchPortalShell } from './support';

test('shows two portal frames and one active overlay target', async () => {
  const { app, page } = await launchPortalShell();

  await expect(page.getByTestId('portal-a')).toBeVisible();
  await expect(page.getByTestId('portal-b')).toBeVisible();
  await expect(page.getByTestId('active-portal-id')).toHaveText('portal-a');

  await app.close();
});
