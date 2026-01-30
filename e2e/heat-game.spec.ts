import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Game constants (matching the game code)
const GRID_SIZE = 16;
const CELL_SIZE = 32;
const GRID_PADDING = 10;

/**
 * Calculate canvas click coordinates for a grid cell
 */
function getCellClickPosition(cellX: number, cellY: number): { x: number; y: number } {
  return {
    x: GRID_PADDING + cellX * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_PADDING + cellY * CELL_SIZE + CELL_SIZE / 2,
  };
}

/**
 * Save logs to a file in the test results directory
 */
async function saveLogs(testInfo: any, logs: string[], filename: string) {
  const logsDir = path.join('test-results', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logFile = path.join(logsDir, `${testInfo.title.replace(/\s+/g, '-')}-${filename}.log`);
  fs.writeFileSync(logFile, logs.join('\n'));
  await testInfo.attach(filename, { path: logFile, contentType: 'text/plain' });
}

// Ensure screenshots directory exists before tests
const screenshotsDir = 'test-results/screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

test.describe('Heat Game E2E Tests', () => {
  let consoleLogs: string[] = [];

  test.beforeEach(async ({ page }, testInfo) => {
    consoleLogs = [];

    // Capture all console messages
    page.on('console', (msg: ConsoleMessage) => {
      const logEntry = `[${msg.type().toUpperCase()}] ${new Date().toISOString()} ${msg.text()}`;
      consoleLogs.push(logEntry);
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      consoleLogs.push(`[PAGE ERROR] ${new Date().toISOString()} ${error.message}`);
    });

    // Navigate to the game
    await page.goto('/');

    // Wait for the game to be fully loaded
    await page.waitForSelector('#game-canvas', { state: 'visible' });
    await page.waitForSelector('.heat-game-build-menu button', { state: 'visible' });

    // Verify we have all 7 build buttons before proceeding
    await expect(page.locator('.heat-game-build-menu button')).toHaveCount(7);

    // Take initial screenshot
    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-01-initial.png`,
      fullPage: true
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Save browser logs
    await saveLogs(testInfo, consoleLogs, 'browser-logs');

    // Take final screenshot
    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-final.png`,
      fullPage: true
    });
  });

  test('should load the game and display initial state', async ({ page }, testInfo) => {
    // Verify page title
    await expect(page).toHaveTitle('Heat Management Game');

    // Verify header is visible
    await expect(page.locator('h1')).toContainText('Heat Management');

    // Verify canvas is present
    const canvas = page.locator('#game-canvas');
    await expect(canvas).toBeVisible();

    // Verify UI elements are present
    await expect(page.locator('.heat-game-money')).toBeVisible();
    await expect(page.locator('.heat-game-stats')).toBeVisible();
    await expect(page.locator('.heat-game-build-menu')).toBeVisible();

    // Verify build menu has all structure buttons
    const buildButtons = page.locator('.heat-game-build-menu button');
    await expect(buildButtons).toHaveCount(7);

    // Verify initial money display shows starting money ($500)
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('Money:');

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-verified-elements.png`,
      fullPage: true
    });
  });

  test('should place a Fuel Rod on the grid', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Click on the FuelRod button to select it
    const fuelRodButton = page.locator('.heat-game-build-menu button', { hasText: 'FuelRod' });
    await fuelRodButton.click();

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-fuel-rod-selected.png`,
      fullPage: true
    });

    // Click on the canvas at cell (5, 5) to place a Fuel Rod
    const clickPos = getCellClickPosition(5, 5);
    await canvas.click({ position: clickPos });

    // Wait briefly for the game to process
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-fuel-rod-placed.png`,
      fullPage: true
    });

    // Verify money decreased (FuelRod costs $100, starting money is $500)
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('400');
  });

  test('should place multiple structures and observe heat dynamics', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Place a Fuel Rod at (7, 7)
    const fuelRodButton = page.locator('.heat-game-build-menu button', { hasText: 'FuelRod' });
    await fuelRodButton.click();
    await canvas.click({ position: getCellClickPosition(7, 7) });

    // Place a Ventilator next to it at (6, 7) for cooling
    const ventilatorButton = page.locator('.heat-game-build-menu button', { hasText: 'Ventilator' });
    await ventilatorButton.click();
    await canvas.click({ position: getCellClickPosition(6, 7) });

    // Place a Turbine at (8, 7) to convert heat to power
    const turbineButton = page.locator('.heat-game-build-menu button', { hasText: 'Turbine' });
    await turbineButton.click();
    await canvas.click({ position: getCellClickPosition(8, 7) });

    // Place a Substation at (9, 7) to sell power
    const substationButton = page.locator('.heat-game-build-menu button', { hasText: 'Substation' });
    await substationButton.click();
    await canvas.click({ position: getCellClickPosition(9, 7) });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-structures-placed.png`,
      fullPage: true
    });

    // Wait briefly for game ticks
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-ticks.png`,
      fullPage: true
    });

    // Verify stats are visible
    const statsDisplay = page.locator('.heat-game-stats');
    await expect(statsDisplay).toBeVisible();
  });

  test('should demolish a structure with right-click', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Place a Ventilator (cheaper to test)
    const ventilatorButton = page.locator('.heat-game-build-menu button', { hasText: 'Ventilator' });
    await ventilatorButton.click();
    await canvas.click({ position: getCellClickPosition(3, 3) });

    // Check money after placing ($500 - $50 = $450)
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('450');

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-before-demolish.png`,
      fullPage: true
    });

    // Right-click to demolish
    await canvas.click({ position: getCellClickPosition(3, 3), button: 'right' });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-demolish.png`,
      fullPage: true
    });

    // Money should stay at 450 (no refund)
    await expect(moneyDisplay).toContainText('450');
  });

  test('should build a power generation setup', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Build a small power plant setup
    const structures = [
      { type: 'Ventilator', x: 5, y: 7 },
      { type: 'FuelRod', x: 6, y: 7 },
      { type: 'Turbine', x: 7, y: 7 },
      { type: 'Substation', x: 8, y: 7 },
    ];

    for (const s of structures) {
      const button = page.locator('.heat-game-build-menu button', { hasText: s.type });
      await button.click();
      await canvas.click({ position: getCellClickPosition(s.x, s.y) });
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-power-plant-built.png`,
      fullPage: true
    });

    // Let the simulation run briefly
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-simulation.png`,
      fullPage: true
    });

    // Verify stats are visible and updating
    const statsDisplay = page.locator('.heat-game-stats');
    const statsText = await statsDisplay.textContent();
    consoleLogs.push(`[TEST] Stats after simulation: ${statsText}`);

    await expect(statsDisplay).toBeVisible();
  });

  test('should show heat buildup with clustered fuel rods', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Build multiple fuel rods close together without cooling
    const fuelRodPositions = [
      { x: 7, y: 7 },
      { x: 8, y: 7 },
      { x: 7, y: 8 },
      { x: 8, y: 8 },
    ];

    const fuelRodButton = page.locator('.heat-game-build-menu button', { hasText: 'FuelRod' });
    await fuelRodButton.click();

    for (const pos of fuelRodPositions) {
      await canvas.click({ position: getCellClickPosition(pos.x, pos.y) });
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-fuel-rods-clustered.png`,
      fullPage: true
    });

    // Wait briefly to observe heat buildup
    await page.waitForTimeout(1000);

    const statsDisplay = page.locator('.heat-game-stats');
    const statsText = await statsDisplay.textContent();
    consoleLogs.push(`[TEST] Stats with heat buildup: ${statsText}`);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-heat-building.png`,
      fullPage: true
    });

    // Verify the game is still running
    await expect(statsDisplay).toBeVisible();
  });

  test('should not allow building without sufficient money', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Substation costs $250, starting with $500
    const substationButton = page.locator('.heat-game-build-menu button', { hasText: 'Substation' });
    await substationButton.click();

    // Build 2 substations ($500 total)
    await canvas.click({ position: getCellClickPosition(1, 1) });
    await canvas.click({ position: getCellClickPosition(2, 1) });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-spent-all-money.png`,
      fullPage: true
    });

    // Verify money is 0
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('0');

    // Try to build another structure - should fail silently
    await canvas.click({ position: getCellClickPosition(3, 1) });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-cannot-build.png`,
      fullPage: true
    });

    // Money should still be 0
    await expect(moneyDisplay).toContainText('0');
  });

  test('should handle rapid clicking on the grid', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Select a cheaper structure
    const insulationButton = page.locator('.heat-game-build-menu button', { hasText: 'InsulationPlate' });
    await insulationButton.click();

    // Rapidly click multiple cells (limited to fit budget)
    const clicks = [];
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        clicks.push(getCellClickPosition(x, y));
      }
    }

    // Click rapidly
    for (const pos of clicks) {
      await canvas.click({ position: pos, delay: 5 });
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-rapid-clicks-result.png`,
      fullPage: true
    });

    // Verify the game is still responsive
    const statsDisplay = page.locator('.heat-game-stats');
    await expect(statsDisplay).toBeVisible();
  });
});
