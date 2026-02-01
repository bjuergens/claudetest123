/**
 * PhysicsEngine Unit Tests
 *
 * Focus: Core physics mechanics, meltdown behavior (catastrophic), upgrade interactions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from './GridManager.js';
import { PhysicsEngine } from './PhysicsEngine.js';
import { StructureType, Tier, UpgradeType, STRUCTURE_BASE_STATS } from './BalanceConfig.js';

describe('PhysicsEngine', () => {
  let grid: GridManager;
  let physics: PhysicsEngine;
  let upgradeLevels: Map<UpgradeType, number>;

  beforeEach(() => {
    grid = new GridManager(16);
    upgradeLevels = new Map();
    physics = new PhysicsEngine(grid, (type) => upgradeLevels.get(type) ?? 0);
  });

  describe('heat mechanics', () => {
    it('fuel rods generate heat only when active', () => {
      const active = grid.getCellRef(3, 3)!;
      active.structure = StructureType.FuelRod;
      active.lifetime = 100;

      const depleted = grid.getCellRef(8, 8)!;
      depleted.structure = StructureType.FuelRod;
      depleted.lifetime = 0;

      physics.processHeatGeneration();

      expect(grid.getCell(3, 3)!.heat).toBeGreaterThan(0);
      expect(grid.getCell(8, 8)!.heat).toBe(0);
    });

    it('adjacent fuel rods boost heat generation', () => {
      const center = grid.getCellRef(5, 5)!;
      center.structure = StructureType.FuelRod;
      center.lifetime = 100;

      physics.processHeatGeneration();
      const baseHeat = grid.getCell(5, 5)!.heat;

      // Reset and add neighbor
      grid.getCellRef(5, 5)!.heat = 0;
      const neighbor = grid.getCellRef(5, 4)!;
      neighbor.structure = StructureType.FuelRod;
      neighbor.lifetime = 100;

      physics.processHeatGeneration();
      expect(grid.getCell(5, 5)!.heat).toBeGreaterThan(baseHeat);
    });

    it('heat transfers from hot to cold cells', () => {
      grid.getCellRef(5, 5)!.heat = 1000;
      grid.getCellRef(5, 6)!.heat = 0;

      physics.processHeatTransfer();

      expect(grid.getCell(5, 5)!.heat).toBeLessThan(1000);
      expect(grid.getCell(5, 6)!.heat).toBeGreaterThan(0);
    });

    it('insulators block heat transfer', () => {
      const insulator = grid.getCellRef(5, 5)!;
      insulator.structure = StructureType.Insulator;
      insulator.heat = 1000;

      physics.processHeatTransfer();
      const insulatorHeatAfter = grid.getCell(5, 5)!.heat;

      // Compare with empty cell
      grid.getCellRef(5, 5)!.structure = StructureType.Empty;
      grid.getCellRef(5, 5)!.heat = 1000;
      physics.processHeatTransfer();

      expect(insulatorHeatAfter).toBeGreaterThan(grid.getCell(5, 5)!.heat);
    });

    it('heat is conserved during cell-to-cell transfer (interior cells)', () => {
      // Place cells in the interior so no heat is lost to environment
      // Use cells away from edges (need at least 1 cell buffer from all sides)
      grid.getCellRef(5, 5)!.heat = 1000;
      grid.getCellRef(5, 6)!.heat = 0;
      grid.getCellRef(6, 5)!.heat = 500;
      grid.getCellRef(6, 6)!.heat = 200;

      // Calculate total heat before (all cells in grid)
      let totalBefore = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          totalBefore += grid.getCell(x, y)!.heat;
        }
      }

      const heatLostToEnv = physics.processHeatTransfer();

      // Calculate total heat after
      let totalAfter = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          totalAfter += grid.getCell(x, y)!.heat;
        }
      }

      // Heat lost to environment + remaining heat should equal original
      expect(totalAfter + heatLostToEnv).toBeCloseTo(totalBefore, 5);
    });

    it('high exchange rate cells converge quickly', () => {
      // Two void cells (rate 1.0 each, avg = 1.0) should exchange heat quickly
      // Surround with insulators (rate 0.01) to isolate the exchange
      const cell1 = grid.getCellRef(5, 5)!;
      cell1.structure = StructureType.VoidCell;
      cell1.heat = 100;

      const cell2 = grid.getCellRef(5, 6)!;
      cell2.structure = StructureType.VoidCell;
      cell2.heat = 200;

      // Surround with insulators at average temp to minimize interference
      const avgTemp = 150;
      for (const [x, y] of [[5, 4], [4, 5], [6, 5], [4, 6], [6, 6], [5, 7]]) {
        const neighbor = grid.getCellRef(x, y)!;
        neighbor.structure = StructureType.Insulator;
        neighbor.heat = avgTemp;
      }

      physics.processHeatTransfer();

      // With rate 1.0, the void cells should nearly equalize (diff reduces to near 0)
      // Small deviation from insulator neighbors (avg rate ~0.5 with insulators)
      const heat1 = grid.getCell(5, 5)!.heat;
      const heat2 = grid.getCell(5, 6)!.heat;

      // They should have moved very close to each other
      expect(heat1).toBeGreaterThan(130);
      expect(heat2).toBeLessThan(170);
      expect(heat2 - heat1).toBeLessThan(40); // Started at 100 diff, should be much smaller
    });

    it('moderate exchange rate cells move toward equalization', () => {
      // Two turbines (rate 0.2 each, avg = 0.2)
      // Surround with insulators to minimize exchange with other neighbors
      const cell1 = grid.getCellRef(5, 5)!;
      cell1.structure = StructureType.Turbine;
      cell1.heat = 100;

      const cell2 = grid.getCellRef(5, 6)!;
      cell2.structure = StructureType.Turbine;
      cell2.heat = 200;

      // Set all other neighbors to same average temp to isolate the exchange
      // Use insulators (rate 0.01) to minimize interference
      for (const [x, y] of [[5, 4], [4, 5], [6, 5], [4, 6], [6, 6], [5, 7]]) {
        const neighbor = grid.getCellRef(x, y)!;
        neighbor.structure = StructureType.Insulator;
        neighbor.heat = 150; // average of 100 and 200
      }

      physics.processHeatTransfer();

      // The two turbines should have moved toward each other
      // With rate 0.2, diff of 100 reduces by 20, so cells move ~10 toward each other
      const heat1 = grid.getCell(5, 5)!.heat;
      const heat2 = grid.getCell(5, 6)!.heat;

      // Heat1 should have increased, heat2 should have decreased
      expect(heat1).toBeGreaterThan(100);
      expect(heat2).toBeLessThan(200);
      // Their difference should have reduced
      expect(heat2 - heat1).toBeLessThan(100);
    });
  });

  describe('melting behavior', () => {
    it('fuel rod overheating turns to slag, not grid clear', () => {
      // Place some structures far away
      grid.getCellRef(3, 3)!.structure = StructureType.Turbine;
      grid.getCellRef(12, 12)!.structure = StructureType.Ventilator;

      // Overheat fuel rod
      const fuel = grid.getCellRef(5, 5)!;
      fuel.structure = StructureType.FuelRod;
      fuel.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp + 100;

      physics.processOverheating();

      // Fuel rod should turn to slag, not clear grid
      expect(grid.getCell(5, 5)!.structure).toBe(StructureType.MoltenSlag);
      // Other structures should still exist
      expect(grid.getCell(3, 3)!.structure).toBe(StructureType.Turbine);
      expect(grid.getCell(12, 12)!.structure).toBe(StructureType.Ventilator);
    });

    it('non-fuel structures melt to slag when overheating', () => {
      const turbine = grid.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.heat = STRUCTURE_BASE_STATS[StructureType.Turbine].meltTemp + 100;

      physics.processOverheating();

      expect(grid.getCell(5, 5)!.structure).toBe(StructureType.MoltenSlag);
    });

    it('molten slag decays after its lifetime', () => {
      const slag = grid.getCellRef(5, 5)!;
      slag.structure = StructureType.MoltenSlag;
      slag.lifetime = 1; // Will decay on next call
      slag.heat = 500;

      physics.processSlagPlasmaDecay();

      // Should be empty but keep heat
      expect(grid.getCell(5, 5)!.structure).toBe(StructureType.Empty);
      expect(grid.getCell(5, 5)!.heat).toBe(500);
    });
  });

  describe('power flow', () => {
    it('complete power chain: fuel -> turbine -> substation -> money', () => {
      const fuel = grid.getCellRef(5, 5)!;
      fuel.structure = StructureType.FuelRod;
      fuel.lifetime = 100;

      const turbine = grid.getCellRef(5, 6)!;
      turbine.structure = StructureType.Turbine;

      const substation = grid.getCellRef(5, 7)!;
      substation.structure = StructureType.Substation;

      // Run multiple ticks - turbines only work above 100°C
      let totalMoney = 0;
      for (let i = 0; i < 50 && totalMoney === 0; i++) {
        const result = physics.tick();
        totalMoney += result.moneyEarned;
      }

      expect(totalMoney).toBeGreaterThan(0);
    });
  });

  describe('upgrade effects', () => {
    it('melt temp upgrades increase tolerance', () => {
      const base = physics.getEffectiveMeltTemp(StructureType.FuelRod);

      upgradeLevels.set(UpgradeType.MeltTempFuelRod, 3);

      expect(physics.getEffectiveMeltTemp(StructureType.FuelRod)).toBeGreaterThan(base);
    });

    it('insulator upgrades reduce conductivity', () => {
      const insulator = grid.getCellRef(5, 5)!;
      insulator.structure = StructureType.Insulator;

      const base = physics.getEffectiveConductivity(insulator);

      upgradeLevels.set(UpgradeType.InsulatorConductivity, 2);

      expect(physics.getEffectiveConductivity(insulator)).toBeLessThan(base);
    });
  });
});
