import { test, expect } from '@playwright/test';

test.describe('Flujo Crítico E2E', () => {
  test('POS a Caja Completo (Usuario 1550)', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="text"]', '1550');
    await page.fill('input[type="password"]', '1550');
    await page.click('button:has-text("Ingresar")');
    
    // Wait for Dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text="Dashboard"')).toBeVisible();

    // 2. Operación POS
    await page.goto('http://localhost:3000/pos');
    // Assuming there's a product available
    await page.click('text="Agregar al carrito"'); 
    
    // Wait for the cart to update
    await expect(page.locator('text="Confirmar Proforma"')).toBeVisible();
    await page.click('text="Confirmar Proforma"');
    
    // Wait for success
    await expect(page.locator('.toast-success')).toBeVisible({ timeout: 10000 });

    // 3. Cobro en Caja
    await page.goto('http://localhost:3000/caja');
    // Click the first ticket in the grid/list
    await page.click('.ticket-card:first-child');
    
    // Check if modal opened
    await expect(page.locator('text="Confirmar Cobro"')).toBeVisible();
    await page.click('button:has-text("Confirmar Cobro")');
    
    // In review modal
    await expect(page.locator('text="CONFIRMAR"')).toBeVisible();
    await page.click('button:has-text("CONFIRMAR")');
    
    // Success modal
    await expect(page.locator('text="¡Venta Exitosa!"')).toBeVisible();
  });
});
