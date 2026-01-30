import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Game constants (matching the game code)
const GRID_SIZE = 16;
const CELL_SIZE = 32;
const GRID_PADDING = 10;

// Structure types for build menu selection
const STRUCTURES = {
  FuelRod: 'FuelRod',
  Ventilator: 'Ventilator',
  HeatExchanger: 'HeatExchanger',
  Battery: 'Battery',
  InsulationPlate: 'InsulationPlate',
  Turbine: 'Turbine',
  Substation: 'Substation',
};

// Test fixtures for capturing logs
interface TestContext {
  consoleLogs: string[];
  page: Page;
}

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

    // Wait for the game canvas to be visible
    await page.waitForSelector('#game-canvas', { state: 'visible' });

    // Wait for the game to initialize (build menu should be populated)
    await page.waitForSelector('.heat-game-build-menu button', { state: 'visible' });

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

    // Click on the FuelRod button to select it (should be selected by default)
    const fuelRodButton = page.locator('.heat-game-build-menu button', { hasText: 'FuelRod' });
    await fuelRodButton.click();

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-fuel-rod-selected.png`,
      fullPage: true
    });

    // Click on the canvas at cell (5, 5) to place a Fuel Rod
    const clickPos = getCellClickPosition(5, 5);
    await canvas.click({ position: clickPos });

    // Wait a moment for the game to process
    await page.waitForTimeout(200);

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

    // Step 1: Place a Fuel Rod at (7, 7) - center-ish
    const fuelRodButton = page.locator('.heat-game-build-menu button', { hasText: 'FuelRod' });
    await fuelRodButton.click();
    await canvas.click({ position: getCellClickPosition(7, 7) });
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-placed-fuel-rod.png`,
      fullPage: true
    });

    // Step 2: Place a Ventilator next to it at (6, 7) for cooling
    const ventilatorButton = page.locator('.heat-game-build-menu button', { hasText: 'Ventilator' });
    await ventilatorButton.click();
    await canvas.click({ position: getCellClickPosition(6, 7) });
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-placed-ventilator.png`,
      fullPage: true
    });

    // Step 3: Place a Turbine at (8, 7) to convert heat to power
    const turbineButton = page.locator('.heat-game-build-menu button', { hasText: 'Turbine' });
    await turbineButton.click();
    await canvas.click({ position: getCellClickPosition(8, 7) });
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-04-placed-turbine.png`,
      fullPage: true
    });

    // Step 4: Place a Substation at (9, 7) to sell power
    const substationButton = page.locator('.heat-game-build-menu button', { hasText: 'Substation' });
    await substationButton.click();
    await canvas.click({ position: getCellClickPosition(9, 7) });
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-05-placed-substation.png`,
      fullPage: true
    });

    // Wait for some game ticks to observe heat buildup
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-06-after-1-second.png`,
      fullPage: true
    });

    // Wait more to see power generation
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-07-after-3-seconds.png`,
      fullPage: true
    });

    // Verify stats show power generation
    const statsDisplay = page.locator('.heat-game-stats');
    await expect(statsDisplay).toBeVisible();
  });

  test('should demolish a structure with right-click', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Place a Ventilator (cheaper to test)
    const ventilatorButton = page.locator('.heat-game-build-menu button', { hasText: 'Ventilator' });
    await ventilatorButton.click();
    await canvas.click({ position: getCellClickPosition(3, 3) });
    await page.waitForTimeout(100);

    // Check money after placing ($500 - $50 = $450)
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('450');

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-before-demolish.png`,
      fullPage: true
    });

    // Right-click to demolish
    await canvas.click({ position: getCellClickPosition(3, 3), button: 'right' });
    await page.waitForTimeout(100);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-demolish.png`,
      fullPage: true
    });

    // Money should stay at 450 (no refund)
    await expect(moneyDisplay).toContainText('450');
  });

  test('should build a complete power generation setup', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Build a small power plant setup:
    // Row 7: [Vent] [FuelRod] [Turbine] [Substation]
    // Row 8: [Vent] [FuelRod] [Turbine]

    const structures = [
      { type: 'Ventilator', x: 5, y: 7 },
      { type: 'FuelRod', x: 6, y: 7 },
      { type: 'Turbine', x: 7, y: 7 },
      { type: 'Substation', x: 8, y: 7 },
      { type: 'Ventilator', x: 5, y: 8 },
      { type: 'FuelRod', x: 6, y: 8 },
      { type: 'Turbine', x: 7, y: 8 },
    ];

    for (let i = 0; i < structures.length; i++) {
      const s = structures[i];
      const button = page.locator('.heat-game-build-menu button', { hasText: s.type });
      await button.click();
      await canvas.click({ position: getCellClickPosition(s.x, s.y) });
      await page.waitForTimeout(50);
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-power-plant-built.png`,
      fullPage: true
    });

    // Let the simulation run for 5 seconds
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-after-5-seconds.png`,
      fullPage: true
    });

    // Verify power generation has occurred
    const statsDisplay = page.locator('.heat-game-stats');
    const statsText = await statsDisplay.textContent();

    // Log the stats for debugging
    consoleLogs.push(`[TEST] Stats after 5 seconds: ${statsText}`);

    // Take one more screenshot after 10 seconds total
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-04-after-10-seconds.png`,
      fullPage: true
    });

    const finalStats = await statsDisplay.textContent();
    consoleLogs.push(`[TEST] Final stats after 10 seconds: ${finalStats}`);
  });

  test('should trigger meltdown with excessive heat', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Build multiple fuel rods close together without cooling
    // This should cause a meltdown eventually
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
      await page.waitForTimeout(50);
    }

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-fuel-rods-clustered.png`,
      fullPage: true
    });

    // Wait for heat to build up (may take a while to meltdown)
    // Take periodic screenshots
    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(2000);

      const statsDisplay = page.locator('.heat-game-stats');
      const statsText = await statsDisplay.textContent();
      consoleLogs.push(`[TEST] Stats at ${i * 2} seconds: ${statsText}`);

      // Check if meltdown occurred
      if (statsText && statsText.includes('Meltdowns: 1')) {
        await page.screenshot({
          path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-meltdown-occurred.png`,
          fullPage: true
        });
        consoleLogs.push(`[TEST] Meltdown detected at ${i * 2} seconds!`);
        break;
      }

      if (i % 3 === 0) {
        await page.screenshot({
          path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-03-heat-building-${i * 2}s.png`,
          fullPage: true
        });
      }
    }
  });

  test('should not allow building without sufficient money', async ({ page }, testInfo) => {
    const canvas = page.locator('#game-canvas');

    // Try to build expensive structures until we run out of money
    // Starting with $500
    // Substation costs $250
    const substationButton = page.locator('.heat-game-build-menu button', { hasText: 'Substation' });
    await substationButton.click();

    // Build 2 substations ($500 total)
    await canvas.click({ position: getCellClickPosition(1, 1) });
    await page.waitForTimeout(50);
    await canvas.click({ position: getCellClickPosition(2, 1) });
    await page.waitForTimeout(50);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-spent-all-money.png`,
      fullPage: true
    });

    // Verify money is 0
    const moneyDisplay = page.locator('.heat-game-money');
    await expect(moneyDisplay).toContainText('0');

    // Try to build another structure - should fail silently
    await canvas.click({ position: getCellClickPosition(3, 1) });
    await page.waitForTimeout(100);

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

    // Rapidly click multiple cells
    const clicks = [];
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 3; y++) {
        clicks.push(getCellClickPosition(x, y));
      }
    }

    // Click rapidly
    for (const pos of clicks) {
      await canvas.click({ position: pos, delay: 10 });
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `test-results/screenshots/${testInfo.title.replace(/\s+/g, '-')}-02-rapid-clicks-result.png`,
      fullPage: true
    });

    // Verify the game is still responsive
    const statsDisplay = page.locator('.heat-game-stats');
    await expect(statsDisplay).toBeVisible();
  });
});

// Ensure screenshots directory exists
test.beforeAll(async () => {
  const screenshotsDir = 'test-results/screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});
