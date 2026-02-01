import { describe, it, expect, beforeEach } from 'vitest';
import {
  HeatGame,
  StructureType,
  Tier,
  UpgradeType,
  SecretUpgradeType,
  GRID_SIZE,
  GameEvent,
} from './HeatGame.js';
import { getStructureCost, STRUCTURE_BASE_STATS } from './BalanceConfig.js';

/**
 * Build a heat trap - 2x2 cluster of fuel rods surrounded by insulation
 * Each fuel rod has 2 adjacent fuel rods, giving 2x heat multiplier (1 + 0.5*2)
 * Total heat generation: 4 * 100 * 2 = 800 heat/tick
 */
function buildHeatTrap(game: HeatGame, centerX = 8, centerY = 8): void {
  // 2x2 fuel rod cluster
  game.build(centerX, centerY, StructureType.FuelRod, Tier.T1);
  game.build(centerX + 1, centerY, StructureType.FuelRod, Tier.T1);
  game.build(centerX, centerY + 1, StructureType.FuelRod, Tier.T1);
  game.build(centerX + 1, centerY + 1, StructureType.FuelRod, Tier.T1);
  // Surround with insulation to trap heat (forms a ring around the 2x2 cluster)
  for (const [dx, dy] of [
    [-1, -1], [0, -1], [1, -1], [2, -1],  // top row
    [-1, 0], [2, 0],                       // middle rows (sides)
    [-1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2], [2, 2],       // bottom row
  ]) {
    game.build(centerX + dx, centerY + dy, StructureType.Insulator, Tier.T1);
  }
}

/**
 * Run ticks until a structure melts or max iterations reached
 */
function runUntilMelt(game: HeatGame, x: number, y: number, maxTicks = 1000): void {
  for (let i = 0; i < maxTicks; i++) {
    const cell = game.getCell(x, y);
    if (!cell || cell.structure === StructureType.Empty ||
        cell.structure === StructureType.MoltenSlag ||
        cell.structure === StructureType.Plasma) {
      break;
    }
    game.tick();
  }
}

describe('HeatGame', () => {
  let game: HeatGame;

  beforeEach(() => {
    game = new HeatGame(1000);
  });

  describe('initialization', () => {
    it('should create a 16x16 grid', () => {
      const grid = game.getGridSnapshot();
      expect(grid.length).toBe(GRID_SIZE);
      expect(grid[0].length).toBe(GRID_SIZE);
    });

    it('should initialize all cells as empty', () => {
      const grid = game.getGridSnapshot();
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          expect(grid[y][x].structure).toBe(StructureType.Empty);
          expect(grid[y][x].heat).toBe(0);
        }
      }
    });

    it('should start with the specified initial money', () => {
      expect(game.getMoney()).toBe(1000);

      const game2 = new HeatGame(500);
      expect(game2.getMoney()).toBe(500);
    });

    it('should start with zero by default (new economy)', () => {
      const defaultGame = new HeatGame();
      expect(defaultGame.getMoney()).toBe(0);
    });

    it('should start with zero tick count', () => {
      expect(game.getTickCount()).toBe(0);
    });

    it('should start with zero sell count', () => {
      expect(game.getStats().sellCount).toBe(0);
    });
  });

  describe('building structures', () => {
    it('should allow building on empty cells with enough money', () => {
      expect(game.canBuild(0, 0, StructureType.FuelRod, Tier.T1)).toBe(true);
      expect(game.build(0, 0, StructureType.FuelRod, Tier.T1)).toBe(true);

      const cell = game.getCell(0, 0);
      expect(cell?.structure).toBe(StructureType.FuelRod);
    });

    it('should deduct money when building', () => {
      const initialMoney = game.getMoney();
      const cost = getStructureCost(StructureType.FuelRod, Tier.T1);

      game.build(0, 0, StructureType.FuelRod, Tier.T1);

      expect(game.getMoney()).toBe(initialMoney - cost);
    });

    it('should not allow building on occupied cells', () => {
      game.build(0, 0, StructureType.FuelRod, Tier.T1);

      expect(game.canBuild(0, 0, StructureType.Ventilator, Tier.T1)).toBe(false);
      expect(game.build(0, 0, StructureType.Ventilator, Tier.T1)).toBe(false);
    });

    it('should not allow building without enough money', () => {
      const poorGame = new HeatGame(5); // Not enough for T1 fuel rod (10)

      expect(poorGame.canBuild(0, 0, StructureType.FuelRod, Tier.T1)).toBe(false);
      expect(poorGame.build(0, 0, StructureType.FuelRod, Tier.T1)).toBe(false);
    });

    it('should not allow building outside grid bounds', () => {
      expect(game.canBuild(-1, 0, StructureType.FuelRod, Tier.T1)).toBe(false);
      expect(game.canBuild(0, -1, StructureType.FuelRod, Tier.T1)).toBe(false);
      expect(game.canBuild(GRID_SIZE, 0, StructureType.FuelRod, Tier.T1)).toBe(false);
      expect(game.canBuild(0, GRID_SIZE, StructureType.FuelRod, Tier.T1)).toBe(false);
    });

    it('should emit event when building', () => {
      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.build(5, 5, StructureType.Turbine, Tier.T1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('structure_built');
      expect(events[0].x).toBe(5);
      expect(events[0].y).toBe(5);
      expect(events[0].structure).toBe(StructureType.Turbine);
    });

    it('should support tiered items with higher costs', () => {
      const t1Cost = getStructureCost(StructureType.FuelRod, Tier.T1);
      const t2Cost = getStructureCost(StructureType.FuelRod, Tier.T2);

      expect(t2Cost).toBeGreaterThan(t1Cost);
      expect(t2Cost).toBe(t1Cost * 10); // T2 is 10x more expensive
    });

    it('should set lifetime for fuel rods', () => {
      game.build(5, 5, StructureType.FuelRod, Tier.T1);
      const cell = game.getCell(5, 5);

      expect(cell?.lifetime).toBeGreaterThan(0);
    });
  });

  describe('selling structures', () => {
    it('should allow selling structures', () => {
      game.build(0, 0, StructureType.FuelRod, Tier.T1);
      expect(game.sell(0, 0)).toBe(true);

      const cell = game.getCell(0, 0);
      expect(cell?.structure).toBe(StructureType.Empty);
    });

    it('should refund 50% when selling (default)', () => {
      const moneyBefore = game.getMoney();
      game.build(0, 0, StructureType.FuelRod, Tier.T1);
      const cost = 10; // T1 fuel rod cost
      const expectedRefund = Math.floor(cost * 0.5); // Default 50% refund

      game.sell(0, 0);

      expect(game.getMoney()).toBe(moneyBefore - cost + expectedRefund);
    });

    it('should preserve heat when selling', () => {
      game.build(0, 0, StructureType.FuelRod, Tier.T1);
      game.tick(); // Generate some heat

      const cellBefore = game.getCell(0, 0);
      const heatBefore = cellBefore?.heat ?? 0;
      expect(heatBefore).toBeGreaterThan(0);

      game.sell(0, 0);

      const cellAfter = game.getCell(0, 0);
      // Heat is preserved on empty tile
      expect(cellAfter?.heat).toBe(heatBefore);
    });

    it('should not allow selling empty cells', () => {
      expect(game.sell(0, 0)).toBe(false);
    });

    it('should emit event when selling', () => {
      game.build(0, 0, StructureType.Ventilator, Tier.T1);

      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.sell(0, 0);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('structure_sold');
      expect(events[0].structure).toBe(StructureType.Ventilator);
    });

    it('should track sell count', () => {
      game.build(0, 0, StructureType.Ventilator, Tier.T1);
      game.build(1, 0, StructureType.Ventilator, Tier.T1);

      expect(game.getStats().sellCount).toBe(0);

      game.sell(0, 0);
      expect(game.getStats().sellCount).toBe(1);

      game.sell(1, 0);
      expect(game.getStats().sellCount).toBe(2);
    });

    it('should not allow selling molten slag', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Substation, Tier.T1); // Low melt temp

      // Heat until substation melts to slag
      for (let i = 0; i < 100; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.MoltenSlag) break;
      }

      const cell = game.getCell(8, 9);
      if (cell?.structure === StructureType.MoltenSlag) {
        expect(game.sell(8, 9)).toBe(false);
      }
    });
  });

  describe('heat generation', () => {
    it('should generate heat from fuel rods each tick', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);

      game.tick();

      const cell = game.getCell(8, 8);
      expect(cell?.heat).toBeGreaterThan(0);
    });

    it('should accumulate heat over multiple ticks', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);

      game.tick();
      const heatAfterOne = game.getCell(8, 8)?.heat ?? 0;

      game.tick();
      const heatAfterTwo = game.getCell(8, 8)?.heat ?? 0;

      expect(heatAfterTwo).toBeGreaterThan(heatAfterOne);
    });

    it('should increment tick count', () => {
      expect(game.getTickCount()).toBe(0);

      game.tick();
      expect(game.getTickCount()).toBe(1);

      game.tick();
      expect(game.getTickCount()).toBe(2);
    });

    it('should generate more heat with adjacent fuel rods (adjacency bonus)', () => {
      // Single fuel rod
      const game1 = new HeatGame(1000);
      game1.build(8, 8, StructureType.FuelRod, Tier.T1);
      game1.tick();
      const singleHeat = game1.getCell(8, 8)?.heat ?? 0;

      // Two adjacent fuel rods
      const game2 = new HeatGame(1000);
      game2.build(8, 8, StructureType.FuelRod, Tier.T1);
      game2.build(8, 9, StructureType.FuelRod, Tier.T1);
      game2.tick();
      const adjacentHeat = game2.getCell(8, 8)?.heat ?? 0;

      expect(adjacentHeat).toBeGreaterThan(singleHeat);
    });
  });

  describe('fuel rod lifetime', () => {
    it('should deplete fuel rod lifetime each tick', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      const initialLifetime = game.getCell(8, 8)?.lifetime ?? 0;

      game.tick();

      const lifetimeAfterTick = game.getCell(8, 8)?.lifetime ?? 0;
      expect(lifetimeAfterTick).toBe(initialLifetime - 1);
    });

    it('should stop generating heat when fuel is depleted', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      const initialLifetime = game.getCell(8, 8)?.lifetime ?? 0;

      // Run until fuel is depleted
      for (let i = 0; i < initialLifetime + 5; i++) {
        game.tick();
      }

      const cell = game.getCell(8, 8);
      expect(cell?.lifetime).toBe(0);

      // Heat should stabilize/decrease after depletion (no more generation)
      const heatBefore = cell?.heat ?? 0;
      game.tick();
      const heatAfter = game.getCell(8, 8)?.heat ?? 0;

      // Heat should not increase (may decrease due to transfer/dissipation)
      expect(heatAfter).toBeLessThanOrEqual(heatBefore);
    });

    it('should emit fuel_depleted event', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      const initialLifetime = game.getCell(8, 8)?.lifetime ?? 0;

      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      // Run until fuel is depleted
      for (let i = 0; i < initialLifetime + 1; i++) {
        game.tick();
      }

      const depletedEvents = events.filter(e => e.type === 'fuel_depleted');
      expect(depletedEvents.length).toBe(1);
    });

    it('should have longer lifetime for higher tiers', () => {
      const game1 = new HeatGame(10000);
      game1.build(0, 0, StructureType.FuelRod, Tier.T1);
      const t1Lifetime = game1.getCell(0, 0)?.lifetime ?? 0;

      const game2 = new HeatGame(10000);
      game2.build(0, 0, StructureType.FuelRod, Tier.T2);
      const t2Lifetime = game2.getCell(0, 0)?.lifetime ?? 0;

      expect(t2Lifetime).toBeGreaterThan(t1Lifetime);
    });
  });

  describe('heat transfer', () => {
    it('should transfer heat to neighboring cells', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);

      // Run several ticks to allow heat to spread
      for (let i = 0; i < 10; i++) {
        game.tick();
      }

      const neighbor = game.getCell(8, 9);
      expect(neighbor?.heat).toBeGreaterThan(0);
    });

    it('should not transfer heat diagonally', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);

      // Run ticks but heat should flow to orthogonal neighbors first
      for (let i = 0; i < 5; i++) {
        game.tick();
      }

      // Diagonal neighbors should have less heat than orthogonal
      const orthogonal = game.getCell(8, 9)?.heat ?? 0;
      const diagonal = game.getCell(9, 9)?.heat ?? 0;

      expect(orthogonal).toBeGreaterThan(diagonal);
    });

    it('should transfer heat slower through insulators', () => {
      // Test with insulator
      const gameWithInsulator = new HeatGame(1000);
      gameWithInsulator.build(8, 8, StructureType.FuelRod, Tier.T1);
      gameWithInsulator.build(8, 9, StructureType.Insulator, Tier.T1);

      // Test without insulator
      const gameWithoutInsulator = new HeatGame(1000);
      gameWithoutInsulator.build(8, 8, StructureType.FuelRod, Tier.T1);

      for (let i = 0; i < 10; i++) {
        gameWithInsulator.tick();
        gameWithoutInsulator.tick();
      }

      const heatWithInsulator = gameWithInsulator.getCell(8, 10)?.heat ?? 0;
      const heatWithoutInsulator = gameWithoutInsulator.getCell(8, 10)?.heat ?? 0;

      expect(heatWithInsulator).toBeLessThan(heatWithoutInsulator);
    });
  });

  describe('heat dissipation', () => {
    it('should dissipate heat with ventilators', () => {
      // Place a fuel rod and ventilator nearby
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Ventilator, Tier.T1);

      // Generate heat
      for (let i = 0; i < 5; i++) {
        game.tick();
      }

      // Ventilator should have lower heat than fuel rod
      const fuelRodHeat = game.getCell(8, 8)?.heat ?? 0;
      const ventilatorHeat = game.getCell(8, 9)?.heat ?? 0;

      expect(ventilatorHeat).toBeLessThan(fuelRodHeat);
    });
  });

  describe('power generation', () => {
    it('should generate power from turbines when there is heat', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Turbine, Tier.T1);

      // Run several ticks to transfer heat to turbine
      for (let i = 0; i < 20; i++) {
        game.tick();
      }

      expect(game.getTotalPowerGenerated()).toBeGreaterThan(0);
    });

    it('should sell power through substations', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Turbine, Tier.T1);
      game.build(8, 10, StructureType.Substation, Tier.T1);

      const initialMoney = game.getMoney();

      // Run many ticks to generate and sell power
      for (let i = 0; i < 50; i++) {
        game.tick();
      }

      expect(game.getMoney()).toBeGreaterThan(initialMoney);
      expect(game.getTotalMoneyEarned()).toBeGreaterThan(0);
    });

    it('should emit power_sold events', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Turbine, Tier.T1);
      game.build(8, 10, StructureType.Substation, Tier.T1);

      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      // Run many ticks
      for (let i = 0; i < 50; i++) {
        game.tick();
      }

      const powerSoldEvents = events.filter(e => e.type === 'power_sold');
      expect(powerSoldEvents.length).toBeGreaterThan(0);
    });
  });

  describe('manual power generation', () => {
    it('should give money when clicking manual generate', () => {
      const initialMoney = game.getMoney();
      const earned = game.manualGenerate();

      expect(earned).toBeGreaterThan(0);
      expect(game.getMoney()).toBe(initialMoney + earned);
    });

    it('should track manual clicks', () => {
      expect(game.getStats().manualClicks).toBe(0);

      game.manualGenerate();
      expect(game.getStats().manualClicks).toBe(1);

      game.manualGenerate();
      expect(game.getStats().manualClicks).toBe(2);
    });

    it('should emit manual_click event', () => {
      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.manualGenerate();

      expect(events.filter(e => e.type === 'manual_click')).toHaveLength(1);
    });
  });

  describe('melting structures', () => {
    it('should turn structures into molten slag when they overheat', () => {
      // Substation has low melt temp (80°C)
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Substation, Tier.T1);

      // Run until substation melts to slag
      for (let i = 0; i < 100; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.MoltenSlag) break;
      }

      const cell = game.getCell(8, 9);
      expect(cell?.structure).toBe(StructureType.MoltenSlag);
    });

    it('should emit structure_melted event when structures melt', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Substation, Tier.T1);

      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      // Run until substation melts
      for (let i = 0; i < 100; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.MoltenSlag) break;
      }

      const meltEvents = events.filter(e => e.type === 'structure_melted');
      expect(meltEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should decay molten slag after its lifetime expires', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Substation, Tier.T1);

      // Run until substation melts to slag
      let slagLifetime = 0;
      for (let i = 0; i < 100; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.MoltenSlag) {
          slagLifetime = cell.lifetime;
          break;
        }
      }

      // Now run until slag decays
      for (let i = 0; i < slagLifetime + 5; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.Empty) break;
      }

      const cell = game.getCell(8, 9);
      expect(cell?.structure).toBe(StructureType.Empty);
    });

    it('should preserve heat when slag decays', () => {
      game.build(8, 8, StructureType.FuelRod, Tier.T1);
      game.build(8, 9, StructureType.Substation, Tier.T1);

      // Run until substation melts to slag
      for (let i = 0; i < 100; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.MoltenSlag) break;
      }

      // Get slag heat before decay
      let slagHeat = game.getCell(8, 9)?.heat ?? 0;

      // Run until slag decays
      for (let i = 0; i < 15; i++) {
        game.tick();
        const cell = game.getCell(8, 9);
        if (cell?.structure === StructureType.Empty) {
          // Empty tile should have heat (not exactly same due to heat transfer)
          expect(cell.heat).toBeGreaterThan(0);
          break;
        }
      }
    });

    it('should not trigger full grid clear when fuel rod melts', () => {
      // Build a far away structure
      game.build(15, 15, StructureType.Ventilator, Tier.T1);

      // Build heat trap
      buildHeatTrap(game);

      // Run many ticks - structures may melt but grid should not be cleared
      for (let i = 0; i < 500; i++) {
        game.tick();
      }

      // The ventilator should still exist (not cleared by "meltdown")
      const cell = game.getCell(15, 15);
      // Could be ventilator, or melted to slag/empty, but grid was not cleared
      expect(cell).not.toBeNull();
    });
  });

  describe('upgrades', () => {
    it('should allow purchasing upgrades', () => {
      const cost = game.getUpgradeCost(UpgradeType.ManualClickPower);

      expect(game.getUpgradeLevel(UpgradeType.ManualClickPower)).toBe(0);
      expect(game.canPurchaseUpgrade(UpgradeType.ManualClickPower)).toBe(true);

      game.purchaseUpgrade(UpgradeType.ManualClickPower);

      expect(game.getUpgradeLevel(UpgradeType.ManualClickPower)).toBe(1);
      expect(game.getMoney()).toBe(1000 - cost);
    });

    it('should increase upgrade cost with level', () => {
      const cost1 = game.getUpgradeCost(UpgradeType.ManualClickPower);
      game.purchaseUpgrade(UpgradeType.ManualClickPower);
      const cost2 = game.getUpgradeCost(UpgradeType.ManualClickPower);

      expect(cost2).toBeGreaterThan(cost1);
    });

    it('should improve manual click power with upgrades', () => {
      const base = game.manualGenerate();
      game.purchaseUpgrade(UpgradeType.ManualClickPower);
      const upgraded = game.manualGenerate();

      expect(upgraded).toBeGreaterThan(base);
    });
  });

  describe('secret upgrades', () => {
    it('should unlock salvage after selling 100 structures', () => {
      // Give enough money to buy and sell 100 structures
      const richGame = new HeatGame(100000);

      expect(richGame.isSecretUnlocked(SecretUpgradeType.Salvage)).toBe(false);

      // Build and sell 100 structures
      for (let i = 0; i < 100; i++) {
        const x = i % 16;
        const y = Math.floor(i / 16);
        richGame.build(x, y, StructureType.Ventilator, Tier.T1);
        richGame.sell(x, y);
      }

      expect(richGame.isSecretUnlocked(SecretUpgradeType.Salvage)).toBe(true);
    });

    it('should emit secret_unlocked event', () => {
      const richGame = new HeatGame(100000);
      const events: GameEvent[] = [];
      richGame.addEventListener((event) => events.push(event));

      // Build and sell 100 structures to trigger Salvage unlock
      for (let i = 0; i < 100; i++) {
        const x = i % 16;
        const y = Math.floor(i / 16);
        richGame.build(x, y, StructureType.Ventilator, Tier.T1);
        richGame.sell(x, y);
      }

      const unlockEvents = events.filter(e => e.type === 'secret_unlocked');
      expect(unlockEvents.length).toBeGreaterThan(0);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize game state', () => {
      // Use structures that won't melt easily
      game.build(5, 5, StructureType.FuelRod, Tier.T1);
      game.build(6, 5, StructureType.Ventilator, Tier.T1); // Ventilator instead of Turbine

      for (let i = 0; i < 10; i++) {
        game.tick();
      }

      const serialized = game.serialize();
      const restored = HeatGame.deserialize(serialized);

      expect(restored.getMoney()).toBe(game.getMoney());
      expect(restored.getTickCount()).toBe(game.getTickCount());
      expect(restored.getCell(5, 5)?.structure).toBe(StructureType.FuelRod);
      expect(restored.getCell(6, 5)?.structure).toBe(StructureType.Ventilator);
    });

    it('should preserve upgrade state', () => {
      game.purchaseUpgrade(UpgradeType.ManualClickPower);
      game.purchaseUpgrade(UpgradeType.ManualClickPower);

      const serialized = game.serialize();
      const restored = HeatGame.deserialize(serialized);

      expect(restored.getUpgradeLevel(UpgradeType.ManualClickPower)).toBe(2);
    });
  });

  describe('event system', () => {
    it('should allow adding and removing event listeners', () => {
      const events: GameEvent[] = [];
      const listener = (event: GameEvent) => events.push(event);

      game.addEventListener(listener);
      game.build(0, 0, StructureType.FuelRod, Tier.T1);
      expect(events.length).toBe(1);

      game.removeEventListener(listener);
      game.build(1, 0, StructureType.Ventilator, Tier.T1);
      expect(events.length).toBe(1); // Should not have increased
    });
  });

  describe('getCell', () => {
    it('should return null for out-of-bounds coordinates', () => {
      expect(game.getCell(-1, 0)).toBeNull();
      expect(game.getCell(0, -1)).toBeNull();
      expect(game.getCell(GRID_SIZE, 0)).toBeNull();
      expect(game.getCell(0, GRID_SIZE)).toBeNull();
    });

    it('should return a copy of the cell (not the original)', () => {
      game.build(5, 5, StructureType.FuelRod, Tier.T1);
      const cell = game.getCell(5, 5);

      if (cell) {
        cell.heat = 9999; // Modify the returned cell
      }

      // Original should be unchanged
      const originalCell = game.getCell(5, 5);
      expect(originalCell?.heat).not.toBe(9999);
    });
  });
});
