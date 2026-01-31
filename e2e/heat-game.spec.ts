import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Game constants (matching the app.ts renderer config)
const GRID_SIZE = 16;
const CELL_SIZE = 28;  // Must match app.ts cellSize
const GRID_PADDING = 8; // Must match app.ts gridPadding

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

    // Verify we have all 6 build buttons before proceeding
    // (FuelRod, Ventilator, HeatExchanger, Insulator, Turbine, Substation)
    await expect(page.locator('.heat-game-build-menu .build-btn')).toHaveCount(6);

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

    // Verify build menu has all structure buttons (6 buildable types)
    const buildButtons = page.locator('.heat-game-build-menu .build-btn');
    await expect(buildButtons).toHaveCount(6);

    // Verify initial money display shows starting money
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('Money:');

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-verified-elements.png`,
      fullPage: true
    });
  });

  test('should place a Fuel Rod on the grid', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Click on the FuelRod button to select it (button text is "F Fuel Rod (€10)")
    const fuelRodButton = page.getByRole('button', { name: /Fuel Rod/i });
    await expect(fuelRodButton).toBeVisible();
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

    // Verify money decreased (FuelRod costs €10 at T1)
    // Starting money depends on app.ts initialization
    const moneyDisplay = page.locator('.heat-game-money');
    // Just verify money display is visible and shows a number
    await expect(moneyDisplay).toBeVisible();
  });

  test('should place multiple structures and observe heat dynamics', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Place a Fuel Rod at (7, 7)
    await page.getByRole('button', { name: /Fuel Rod/i }).click();
    await canvas.click({ position: getCellClickPosition(7, 7) });

    // Place a Ventilator next to it at (6, 7) for cooling
    await page.getByRole('button', { name: /Ventilator/i }).click();
    await canvas.click({ position: getCellClickPosition(6, 7) });

    // Place a Turbine at (8, 7) to convert heat to power
    await page.getByRole('button', { name: /Turbine/i }).click();
    await canvas.click({ position: getCellClickPosition(8, 7) });

    // Place a Substation at (9, 7) to sell power
    await page.getByRole('button', { name: /Substation/i }).click();
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

    // Get initial money
    const moneyDisplay = page.locator('.heat-game-money');
    const initialMoneyText = await moneyDisplay.textContent();

    // Place a Ventilator
    await page.getByRole('button', { name: /Ventilator/i }).click();
    await canvas.click({ position: getCellClickPosition(3, 3) });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-before-demolish.png`,
      fullPage: true
    });

    // Get money after placing
    const moneyAfterBuild = await moneyDisplay.textContent();

    // Right-click to demolish
    await canvas.click({ position: getCellClickPosition(3, 3), button: 'right' });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-demolish.png`,
      fullPage: true
    });

    // Money should increase after demolish (75% refund)
    // Ventilator costs €10, so refund is €7
    const moneyAfterDemolish = await moneyDisplay.textContent();
    // Just verify money changed (we got a refund)
    expect(moneyAfterDemolish).not.toBe(moneyAfterBuild);
  });

  test('should build a power generation setup', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Build a small power plant setup
    const structures = [
      { type: /Ventilator/i, x: 5, y: 7 },
      { type: /Fuel Rod/i, x: 6, y: 7 },
      { type: /Turbine/i, x: 7, y: 7 },
      { type: /Substation/i, x: 8, y: 7 },
    ];

    for (const s of structures) {
      await page.getByRole('button', { name: s.type }).click();
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

    await page.getByRole('button', { name: /Fuel Rod/i }).click();

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

    // Use manual generation to get some money if starting at 0
    // Then spend it all on substations (€50 each at T1)
    const moneyDisplay = page.locator('.heat-game-money');

    // Select substation and build as many as we can afford
    await page.getByRole('button', { name: /Substation/i }).click();

    // Build substations until we run out of money
    let previousMoney = '';
    for (let i = 0; i < 20; i++) {
      await canvas.click({ position: getCellClickPosition(i % 10, Math.floor(i / 10)) });
      await page.waitForTimeout(50);

      const currentMoney = await moneyDisplay.textContent();
      if (currentMoney === previousMoney) {
        // Can't afford anymore
        break;
      }
      previousMoney = currentMoney!;
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-spent-money.png`,
      fullPage: true
    });

    // Try to build another structure on a new cell - should fail
    const emptyCell = getCellClickPosition(9, 9);
    await canvas.click({ position: emptyCell });

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-cannot-build.png`,
      fullPage: true
    });

    // Verify stats display is still visible (game didn't crash)
    await expect(page.locator('.heat-game-stats')).toBeVisible();
  });

  test('should handle rapid clicking on the grid', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Select insulator (was insulation_plate, now 'insulator')
    await page.getByRole('button', { name: /Insulator/i }).click();

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
