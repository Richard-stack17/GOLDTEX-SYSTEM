import { test, expect } from '@playwright/test';

test('Verify Dashboard and Printers', async ({ page }) => {
  await page.goto('http://localhost:3001/login');
  await page.fill('input[type="text"]', '1550');
  await page.fill('input[type="password"]', '1550');
  await page.click('button:has-text("Ingresar")');
  
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(2000); 
  await page.screenshot({ path: '/tmp/dashboard_fixed.png' });
  
  await page.goto('http://localhost:3001/configuracion');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/printers_fixed.png' });
});
