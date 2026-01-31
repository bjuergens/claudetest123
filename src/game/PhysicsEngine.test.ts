/**
 * Unit tests for PhysicsEngine
 *
 * Tests heat generation, transfer, dissipation, and power generation in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridManager } from './GridManager.js';
import { PhysicsEngine, PhysicsEvent } from './PhysicsEngine.js';
import { StructureType, Tier, UpgradeType, STRUCTURE_BASE_STATS, getFuelLifetime } from './BalanceConfig.js';

describe('PhysicsEngine', () => {
  let gridManager: GridManager;
  let physicsEngine: PhysicsEngine;
  let upgradeLevels: Map<UpgradeType, number>;

  const getUpgradeLevel = (type: UpgradeType) => upgradeLevels.get(type) ?? 0;

  beforeEach(() => {
    gridManager = new GridManager(16);
    upgradeLevels = new Map();
    physicsEngine = new PhysicsEngine(gridManager, getUpgradeLevel);
  });

  describe('heat generation', () => {
    it('should generate heat from active fuel rods', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.tier = Tier.T1;
      cell.lifetime = 100;

      physicsEngine.processHeatGeneration();

      expect(gridManager.getCell(5, 5)!.heat).toBeGreaterThan(0);
    });

    it('should not generate heat from depleted fuel rods', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.tier = Tier.T1;
      cell.lifetime = 0; // depleted

      physicsEngine.processHeatGeneration();

      expect(gridManager.getCell(5, 5)!.heat).toBe(0);
    });

    it('should apply adjacency bonus for neighboring fuel rods', () => {
      // Place center fuel rod
      const center = gridManager.getCellRef(5, 5)!;
      center.structure = StructureType.FuelRod;
      center.tier = Tier.T1;
      center.lifetime = 100;

      // Get baseline heat generation
      physicsEngine.processHeatGeneration();
      const baseHeat = gridManager.getCell(5, 5)!.heat;

      // Reset and add adjacent fuel rod
      gridManager.getCellRef(5, 5)!.heat = 0;
      const adjacent = gridManager.getCellRef(5, 4)!;
      adjacent.structure = StructureType.FuelRod;
      adjacent.tier = Tier.T1;
      adjacent.lifetime = 100;

      physicsEngine.processHeatGeneration();
      const boostedHeat = gridManager.getCell(5, 5)!.heat;

      expect(boostedHeat).toBeGreaterThan(baseHeat);
    });

    it('should generate more heat for higher tiers', () => {
      const cell1 = gridManager.getCellRef(3, 3)!;
      cell1.structure = StructureType.FuelRod;
      cell1.tier = Tier.T1;
      cell1.lifetime = 100;

      const cell2 = gridManager.getCellRef(8, 8)!;
      cell2.structure = StructureType.FuelRod;
      cell2.tier = Tier.T2;
      cell2.lifetime = 100;

      physicsEngine.processHeatGeneration();

      expect(gridManager.getCell(8, 8)!.heat).toBeGreaterThan(gridManager.getCell(3, 3)!.heat);
    });
  });

  describe('fuel depletion', () => {
    it('should decrease fuel lifetime each tick', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.lifetime = 100;

      physicsEngine.processFuelDepletion();

      expect(gridManager.getCell(5, 5)!.lifetime).toBe(99);
    });

    it('should emit event when fuel is depleted', () => {
      const events: PhysicsEvent[] = [];
      physicsEngine.addEventListener(e => events.push(e));

      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.lifetime = 1;

      physicsEngine.processFuelDepletion();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('fuel_depleted');
      expect(events[0].x).toBe(5);
      expect(events[0].y).toBe(5);
    });

    it('should track depleted fuel rods in stats', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.lifetime = 1;

      physicsEngine.processFuelDepletion();

      expect(physicsEngine.getStats().fuelRodsDepleted).toBe(1);
    });
  });

  describe('heat transfer', () => {
    it('should transfer heat from hot to cold cells', () => {
      const hotCell = gridManager.getCellRef(5, 5)!;
      hotCell.heat = 1000;

      const coldCell = gridManager.getCellRef(5, 6)!;
      coldCell.heat = 0;

      physicsEngine.processHeatTransfer();

      expect(gridManager.getCell(5, 5)!.heat).toBeLessThan(1000);
      expect(gridManager.getCell(5, 6)!.heat).toBeGreaterThan(0);
    });

    it('should respect conductivity differences', () => {
      // Place insulator (low conductivity) and regular cell
      const insulator = gridManager.getCellRef(5, 5)!;
      insulator.structure = StructureType.Insulator;
      insulator.heat = 1000;

      physicsEngine.processHeatTransfer();
      const insulatorHeatAfter = gridManager.getCell(5, 5)!.heat;

      // Compare with empty cell
      gridManager.getCellRef(5, 5)!.structure = StructureType.Empty;
      gridManager.getCellRef(5, 5)!.heat = 1000;

      physicsEngine.processHeatTransfer();
      const emptyHeatAfter = gridManager.getCell(5, 5)!.heat;

      // Insulator should retain more heat due to low conductivity
      expect(insulatorHeatAfter).toBeGreaterThan(emptyHeatAfter);
    });

    it('should lose heat to environment at edges', () => {
      // Place heat at corner (2 edges exposed)
      const corner = gridManager.getCellRef(0, 0)!;
      corner.heat = 1000;

      physicsEngine.processHeatTransfer();

      expect(gridManager.getCell(0, 0)!.heat).toBeLessThan(1000);
    });
  });

  describe('heat dissipation', () => {
    it('should dissipate heat from ventilators', () => {
      const vent = gridManager.getCellRef(5, 5)!;
      vent.structure = StructureType.Ventilator;
      vent.tier = Tier.T1;
      vent.heat = 100;

      physicsEngine.processHeatDissipation();

      expect(gridManager.getCell(5, 5)!.heat).toBeLessThan(100);
    });

    it('should not go below zero heat', () => {
      const vent = gridManager.getCellRef(5, 5)!;
      vent.structure = StructureType.Ventilator;
      vent.tier = Tier.T1;
      vent.heat = 1; // Very low heat

      physicsEngine.processHeatDissipation();

      expect(gridManager.getCell(5, 5)!.heat).toBeGreaterThanOrEqual(0);
    });

    it('should dissipate more heat for higher tier ventilators', () => {
      const vent1 = gridManager.getCellRef(3, 3)!;
      vent1.structure = StructureType.Ventilator;
      vent1.tier = Tier.T1;
      vent1.heat = 500;

      const vent2 = gridManager.getCellRef(8, 8)!;
      vent2.structure = StructureType.Ventilator;
      vent2.tier = Tier.T2;
      vent2.heat = 500;

      physicsEngine.processHeatDissipation();

      // T2 should dissipate more, leaving less heat
      expect(gridManager.getCell(8, 8)!.heat).toBeLessThan(gridManager.getCell(3, 3)!.heat);
    });
  });

  describe('power generation', () => {
    it('should generate power from turbines with heat', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.tier = Tier.T1;
      turbine.heat = 100;

      physicsEngine.processPowerGeneration();

      expect(gridManager.getCell(5, 5)!.power).toBeGreaterThan(0);
      expect(gridManager.getCell(5, 5)!.heat).toBeLessThan(100);
    });

    it('should not generate power without heat', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.tier = Tier.T1;
      turbine.heat = 0;

      physicsEngine.processPowerGeneration();

      expect(gridManager.getCell(5, 5)!.power).toBe(0);
    });

    it('should track total power generated in stats', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.tier = Tier.T1;
      turbine.heat = 100;

      physicsEngine.processPowerGeneration();

      expect(physicsEngine.getStats().totalPowerGenerated).toBeGreaterThan(0);
    });
  });

  describe('power sale', () => {
    it('should transfer power from turbine to adjacent substation', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.power = 100;

      const substation = gridManager.getCellRef(5, 6)!;
      substation.structure = StructureType.Substation;
      substation.tier = Tier.T1;

      physicsEngine.processPowerSale();

      // Turbine should have transferred power
      expect(gridManager.getCell(5, 5)!.power).toBe(0);
      // Substation receives power but also sells some (saleRate applies)
      // Just verify it received the power (it may sell some immediately)
      expect(physicsEngine.getStats().totalMoneyEarned).toBeGreaterThan(0);
    });

    it('should sell power from substations and return earnings', () => {
      const substation = gridManager.getCellRef(5, 5)!;
      substation.structure = StructureType.Substation;
      substation.tier = Tier.T1;
      substation.power = 100;

      const earnings = physicsEngine.processPowerSale();

      expect(earnings).toBeGreaterThan(0);
      expect(gridManager.getCell(5, 5)!.power).toBeLessThan(100);
    });

    it('should emit power_sold event', () => {
      const events: PhysicsEvent[] = [];
      physicsEngine.addEventListener(e => events.push(e));

      const substation = gridManager.getCellRef(5, 5)!;
      substation.structure = StructureType.Substation;
      substation.tier = Tier.T1;
      substation.power = 100;

      physicsEngine.processPowerSale();

      expect(events.some(e => e.type === 'power_sold')).toBe(true);
    });
  });

  describe('overheating', () => {
    it('should melt structures that exceed melt temperature', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;
      turbine.tier = Tier.T1;
      turbine.heat = STRUCTURE_BASE_STATS[StructureType.Turbine].meltTemp + 100;

      const events: PhysicsEvent[] = [];
      physicsEngine.addEventListener(e => events.push(e));

      physicsEngine.processOverheating();

      expect(gridManager.getCell(5, 5)!.structure).toBe(StructureType.Empty);
      expect(events.some(e => e.type === 'structure_melted')).toBe(true);
    });

    it('should trigger meltdown when fuel rod overheats', () => {
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.tier = Tier.T1;
      fuelRod.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp + 100;

      const events: PhysicsEvent[] = [];
      physicsEngine.addEventListener(e => events.push(e));

      const meltdown = physicsEngine.processOverheating();

      expect(meltdown).toBe(true);
      expect(events.some(e => e.type === 'meltdown')).toBe(true);
    });

    it('should clear entire grid on meltdown', () => {
      // Place some structures
      gridManager.getCellRef(3, 3)!.structure = StructureType.Turbine;
      gridManager.getCellRef(8, 8)!.structure = StructureType.Ventilator;

      // Trigger meltdown
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp + 100;

      physicsEngine.processOverheating();

      expect(gridManager.getFilledCellCount()).toBe(0);
    });
  });

  describe('high heat tracking', () => {
    it('should track ticks at high heat', () => {
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.tier = Tier.T1;
      // Set heat to 90% of melt temp
      fuelRod.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp * 0.91;

      physicsEngine.trackHighHeatSurvival();

      expect(physicsEngine.getStats().ticksAtHighHeat).toBe(1);
    });

    it('should not track when below 90% melt temp', () => {
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.tier = Tier.T1;
      fuelRod.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp * 0.5;

      physicsEngine.trackHighHeatSurvival();

      expect(physicsEngine.getStats().ticksAtHighHeat).toBe(0);
    });
  });

  describe('effective stats with upgrades', () => {
    it('should increase melt temp with upgrades', () => {
      const baseMeltTemp = physicsEngine.getEffectiveMeltTemp(StructureType.FuelRod);

      upgradeLevels.set(UpgradeType.MeltTempFuelRod, 3);
      const upgradedMeltTemp = physicsEngine.getEffectiveMeltTemp(StructureType.FuelRod);

      expect(upgradedMeltTemp).toBeGreaterThan(baseMeltTemp);
    });

    it('should increase turbine conductivity with upgrades', () => {
      const turbine = gridManager.getCellRef(5, 5)!;
      turbine.structure = StructureType.Turbine;

      const baseConductivity = physicsEngine.getEffectiveConductivity(turbine);

      upgradeLevels.set(UpgradeType.TurbineConductivity, 2);
      const upgradedConductivity = physicsEngine.getEffectiveConductivity(turbine);

      expect(upgradedConductivity).toBeGreaterThan(baseConductivity);
    });

    it('should decrease insulator conductivity with upgrades', () => {
      const insulator = gridManager.getCellRef(5, 5)!;
      insulator.structure = StructureType.Insulator;

      const baseConductivity = physicsEngine.getEffectiveConductivity(insulator);

      upgradeLevels.set(UpgradeType.InsulatorConductivity, 2);
      const upgradedConductivity = physicsEngine.getEffectiveConductivity(insulator);

      expect(upgradedConductivity).toBeLessThan(baseConductivity);
    });
  });

  describe('tick', () => {
    it('should run all physics phases', () => {
      // Set up a simple reactor
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.tier = Tier.T1;
      fuelRod.lifetime = 100;

      const turbine = gridManager.getCellRef(5, 6)!;
      turbine.structure = StructureType.Turbine;
      turbine.tier = Tier.T1;

      const substation = gridManager.getCellRef(5, 7)!;
      substation.structure = StructureType.Substation;
      substation.tier = Tier.T1;

      const result = physicsEngine.tick();

      expect(result.moneyEarned).toBeGreaterThanOrEqual(0);
      expect(result.meltdown).toBe(false);
    });

    it('should report meltdown in tick result', () => {
      const fuelRod = gridManager.getCellRef(5, 5)!;
      fuelRod.structure = StructureType.FuelRod;
      fuelRod.lifetime = 100; // Active fuel rod
      // Set very high heat to ensure it still exceeds meltTemp after heat transfer/dissipation
      fuelRod.heat = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp * 2;

      const result = physicsEngine.tick();

      expect(result.meltdown).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should allow adding and removing listeners', () => {
      const events: PhysicsEvent[] = [];
      const listener = (e: PhysicsEvent) => events.push(e);

      physicsEngine.addEventListener(listener);

      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.lifetime = 1;

      physicsEngine.processFuelDepletion();
      expect(events).toHaveLength(1);

      physicsEngine.removeEventListener(listener);

      cell.structure = StructureType.FuelRod;
      cell.lifetime = 1;
      physicsEngine.processFuelDepletion();

      expect(events).toHaveLength(1); // No new events
    });
  });
});
