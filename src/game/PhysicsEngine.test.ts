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
  });

  describe('meltdown behavior', () => {
    it('fuel rod overheating triggers meltdown and clears grid', () => {
      // Place some structures
      grid.getCellRef(3, 3)!.structure = StructureType.Turbine;
      grid.getCellRef(8, 8)!.structure = StructureType.Ventilator;

      // Overheat fuel rod
      const fuel = grid.getCellRef(5, 5)!;
      fuel.structure = StructureType.FuelRod;
      fuel.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp + 100;

      const meltdown = physics.processOverheating();

      expect(meltdown).toBe(true);
      expect(grid.getFilledCellCount()).toBe(0);
    });

    it('non-fuel structures melt individually without meltdown', () => {
      const turbine = grid.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.heat = STRUCTURE_BASE_STATS[StructureType.Turbine].meltTemp + 100;

      const meltdown = physics.processOverheating();

      expect(meltdown).toBe(false);
      expect(grid.getCell(5, 5)!.structure).toBe(StructureType.Empty);
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

      const result = physics.tick();

      expect(result.moneyEarned).toBeGreaterThan(0);
      expect(result.meltdown).toBe(false);
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
