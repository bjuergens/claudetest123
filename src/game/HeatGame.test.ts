import { describe, it, expect, beforeEach } from 'vitest';
import {
  HeatGame,
  StructureType,
  STRUCTURE_STATS,
  GRID_SIZE,
  GameEvent,
} from './HeatGame.js';

describe('HeatGame', () => {
  let game: HeatGame;

  beforeEach(() => {
    game = new HeatGame(1000); // Start with 1000 money for testing
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

    it('should start with zero meltdowns', () => {
      expect(game.getMeltdownCount()).toBe(0);
    });

    it('should start with zero tick count', () => {
      expect(game.getTickCount()).toBe(0);
    });
  });

  describe('building structures', () => {
    it('should allow building on empty cells with enough money', () => {
      expect(game.canBuild(0, 0, StructureType.FuelRod)).toBe(true);
      expect(game.build(0, 0, StructureType.FuelRod)).toBe(true);

      const cell = game.getCell(0, 0);
      expect(cell?.structure).toBe(StructureType.FuelRod);
    });

    it('should deduct money when building', () => {
      const initialMoney = game.getMoney();
      const cost = STRUCTURE_STATS[StructureType.FuelRod].cost;

      game.build(0, 0, StructureType.FuelRod);

      expect(game.getMoney()).toBe(initialMoney - cost);
    });

    it('should not allow building on occupied cells', () => {
      game.build(0, 0, StructureType.FuelRod);

      expect(game.canBuild(0, 0, StructureType.Ventilator)).toBe(false);
      expect(game.build(0, 0, StructureType.Ventilator)).toBe(false);
    });

    it('should not allow building without enough money', () => {
      const poorGame = new HeatGame(10); // Not enough for any structure

      expect(poorGame.canBuild(0, 0, StructureType.FuelRod)).toBe(false);
      expect(poorGame.build(0, 0, StructureType.FuelRod)).toBe(false);
    });

    it('should not allow building outside grid bounds', () => {
      expect(game.canBuild(-1, 0, StructureType.FuelRod)).toBe(false);
      expect(game.canBuild(0, -1, StructureType.FuelRod)).toBe(false);
      expect(game.canBuild(GRID_SIZE, 0, StructureType.FuelRod)).toBe(false);
      expect(game.canBuild(0, GRID_SIZE, StructureType.FuelRod)).toBe(false);
    });

    it('should emit event when building', () => {
      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.build(5, 5, StructureType.Turbine);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('structure_built');
      expect(events[0].x).toBe(5);
      expect(events[0].y).toBe(5);
      expect(events[0].structure).toBe(StructureType.Turbine);
    });
  });

  describe('demolishing structures', () => {
    it('should allow demolishing structures', () => {
      game.build(0, 0, StructureType.FuelRod);
      expect(game.demolish(0, 0)).toBe(true);

      const cell = game.getCell(0, 0);
      expect(cell?.structure).toBe(StructureType.Empty);
    });

    it('should not refund money when demolishing', () => {
      game.build(0, 0, StructureType.FuelRod);
      const moneyAfterBuild = game.getMoney();

      game.demolish(0, 0);

      expect(game.getMoney()).toBe(moneyAfterBuild);
    });

    it('should reset heat when demolishing', () => {
      game.build(0, 0, StructureType.FuelRod);
      game.tick(); // Generate some heat

      const cellBefore = game.getCell(0, 0);
      expect(cellBefore?.heat).toBeGreaterThan(0);

      game.demolish(0, 0);

      const cellAfter = game.getCell(0, 0);
      expect(cellAfter?.heat).toBe(0);
    });

    it('should not allow demolishing empty cells', () => {
      expect(game.demolish(0, 0)).toBe(false);
    });

    it('should emit event when demolishing', () => {
      game.build(0, 0, StructureType.Ventilator);

      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.demolish(0, 0);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('structure_destroyed');
      expect(events[0].structure).toBe(StructureType.Ventilator);
    });
  });

  describe('heat generation', () => {
    it('should generate heat from fuel rods each tick', () => {
      game.build(8, 8, StructureType.FuelRod);

      game.tick();

      const cell = game.getCell(8, 8);
      expect(cell?.heat).toBeGreaterThan(0);
    });

    it('should accumulate heat over multiple ticks', () => {
      game.build(8, 8, StructureType.FuelRod);

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
  });

  describe('heat transfer', () => {
    it('should transfer heat to neighboring cells', () => {
      game.build(8, 8, StructureType.FuelRod);

      // Run several ticks to allow heat to spread
      for (let i = 0; i < 10; i++) {
        game.tick();
      }

      const neighbor = game.getCell(8, 9);
      expect(neighbor?.heat).toBeGreaterThan(0);
    });

    it('should not transfer heat diagonally', () => {
      game.build(8, 8, StructureType.FuelRod);

      // Run ticks but heat should flow to orthogonal neighbors first
      for (let i = 0; i < 5; i++) {
        game.tick();
      }

      // Diagonal neighbors should have less heat than orthogonal
      const orthogonal = game.getCell(8, 9)?.heat ?? 0;
      const diagonal = game.getCell(9, 9)?.heat ?? 0;

      expect(orthogonal).toBeGreaterThan(diagonal);
    });
  });

  describe('heat dissipation', () => {
    it('should dissipate heat with ventilators', () => {
      // Place a fuel rod and ventilator nearby
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.Ventilator);

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
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.Turbine);

      // Run several ticks to transfer heat to turbine
      for (let i = 0; i < 20; i++) {
        game.tick();
      }

      expect(game.getTotalPowerGenerated()).toBeGreaterThan(0);
    });

    it('should sell power through substations', () => {
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.Turbine);
      game.build(8, 10, StructureType.Substation);

      const initialMoney = game.getMoney();

      // Run many ticks to generate and sell power
      for (let i = 0; i < 50; i++) {
        game.tick();
      }

      expect(game.getMoney()).toBeGreaterThan(initialMoney);
      expect(game.getTotalMoneyEarned()).toBeGreaterThan(0);
    });

    it('should emit power_sold events', () => {
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.Turbine);
      game.build(8, 10, StructureType.Substation);

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

  describe('meltdown', () => {
    it('should trigger meltdown when fuel rod overheats', () => {
      // Create fuel rods in the center completely surrounded by insulation to trap heat
      // This prevents heat from escaping to the environment
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.FuelRod); // Second fuel rod for more heat
      // Surround with insulation to trap heat
      game.build(7, 7, StructureType.InsulationPlate);
      game.build(8, 7, StructureType.InsulationPlate);
      game.build(9, 7, StructureType.InsulationPlate);
      game.build(7, 8, StructureType.InsulationPlate);
      game.build(9, 8, StructureType.InsulationPlate);
      game.build(7, 9, StructureType.InsulationPlate);
      game.build(9, 9, StructureType.InsulationPlate);
      game.build(7, 10, StructureType.InsulationPlate);
      game.build(8, 10, StructureType.InsulationPlate);
      game.build(9, 10, StructureType.InsulationPlate);

      // Run many ticks until meltdown
      for (let i = 0; i < 500; i++) {
        game.tick();
        if (game.getMeltdownCount() > 0) break;
      }

      expect(game.getMeltdownCount()).toBe(1);
    });

    it('should clear all structures on meltdown', () => {
      // Same setup as above
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.FuelRod);
      game.build(7, 7, StructureType.InsulationPlate);
      game.build(8, 7, StructureType.InsulationPlate);
      game.build(9, 7, StructureType.InsulationPlate);
      game.build(7, 8, StructureType.InsulationPlate);
      game.build(9, 8, StructureType.InsulationPlate);
      game.build(7, 9, StructureType.InsulationPlate);
      game.build(9, 9, StructureType.InsulationPlate);
      game.build(7, 10, StructureType.InsulationPlate);
      game.build(8, 10, StructureType.InsulationPlate);
      game.build(9, 10, StructureType.InsulationPlate);
      // Add a structure far away that should also be destroyed
      game.build(15, 15, StructureType.Ventilator);

      // Run until meltdown
      for (let i = 0; i < 500; i++) {
        game.tick();
        if (game.getMeltdownCount() > 0) break;
      }

      // All structures should be gone
      const grid = game.getGridSnapshot();
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          expect(grid[y][x].structure).toBe(StructureType.Empty);
        }
      }
    });

    it('should keep money after meltdown', () => {
      // Earn some money first with a safe setup
      game.build(2, 8, StructureType.FuelRod);
      game.build(2, 9, StructureType.Turbine);
      game.build(2, 10, StructureType.Substation);
      game.build(2, 7, StructureType.Ventilator);

      for (let i = 0; i < 30; i++) {
        game.tick();
      }

      const moneyBeforeMeltdown = game.getMoney();

      // Now cause meltdown with trapped fuel rods in center
      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.FuelRod);
      game.build(7, 7, StructureType.InsulationPlate);
      game.build(8, 7, StructureType.InsulationPlate);
      game.build(9, 7, StructureType.InsulationPlate);
      game.build(7, 8, StructureType.InsulationPlate);
      game.build(9, 8, StructureType.InsulationPlate);
      game.build(7, 9, StructureType.InsulationPlate);
      game.build(9, 9, StructureType.InsulationPlate);
      game.build(7, 10, StructureType.InsulationPlate);
      game.build(8, 10, StructureType.InsulationPlate);
      game.build(9, 10, StructureType.InsulationPlate);

      for (let i = 0; i < 500; i++) {
        game.tick();
        if (game.getMeltdownCount() > 0) break;
      }

      // Money should be preserved (might have earned a bit more before meltdown)
      expect(game.getMoney()).toBeGreaterThanOrEqual(moneyBeforeMeltdown - 500);
    });

    it('should emit meltdown event', () => {
      const events: GameEvent[] = [];
      game.addEventListener((event) => events.push(event));

      game.build(8, 8, StructureType.FuelRod);
      game.build(8, 9, StructureType.FuelRod);
      game.build(7, 7, StructureType.InsulationPlate);
      game.build(8, 7, StructureType.InsulationPlate);
      game.build(9, 7, StructureType.InsulationPlate);
      game.build(7, 8, StructureType.InsulationPlate);
      game.build(9, 8, StructureType.InsulationPlate);
      game.build(7, 9, StructureType.InsulationPlate);
      game.build(9, 9, StructureType.InsulationPlate);
      game.build(7, 10, StructureType.InsulationPlate);
      game.build(8, 10, StructureType.InsulationPlate);
      game.build(9, 10, StructureType.InsulationPlate);

      for (let i = 0; i < 500; i++) {
        game.tick();
        if (game.getMeltdownCount() > 0) break;
      }

      const meltdownEvents = events.filter(e => e.type === 'meltdown');
      expect(meltdownEvents.length).toBe(1);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize game state', () => {
      game.build(5, 5, StructureType.FuelRod);
      game.build(6, 5, StructureType.Turbine);

      for (let i = 0; i < 10; i++) {
        game.tick();
      }

      const serialized = game.serialize();
      const restored = HeatGame.deserialize(serialized);

      expect(restored.getMoney()).toBe(game.getMoney());
      expect(restored.getTickCount()).toBe(game.getTickCount());
      expect(restored.getCell(5, 5)?.structure).toBe(StructureType.FuelRod);
      expect(restored.getCell(6, 5)?.structure).toBe(StructureType.Turbine);
    });
  });

  describe('event system', () => {
    it('should allow adding and removing event listeners', () => {
      const events: GameEvent[] = [];
      const listener = (event: GameEvent) => events.push(event);

      game.addEventListener(listener);
      game.build(0, 0, StructureType.FuelRod);
      expect(events.length).toBe(1);

      game.removeEventListener(listener);
      game.build(1, 0, StructureType.Ventilator);
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
      game.build(5, 5, StructureType.FuelRod);
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
