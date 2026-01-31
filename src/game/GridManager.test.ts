/**
 * GridManager Unit Tests
 *
 * Focus: Data integrity, grid expansion (data loss risk), neighbor calculations (core mechanic)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from './GridManager.js';
import { StructureType } from './BalanceConfig.js';

describe('GridManager', () => {
  let grid: GridManager;

  beforeEach(() => {
    grid = new GridManager(16);
  });

  describe('data integrity', () => {
    it('getCell returns copy, getCellRef returns mutable reference', () => {
      const copy = grid.getCell(5, 5)!;
      copy.heat = 999;
      expect(grid.getCell(5, 5)!.heat).toBe(0); // unchanged

      const ref = grid.getCellRef(5, 5)!;
      ref.heat = 999;
      expect(grid.getCell(5, 5)!.heat).toBe(999); // changed
    });

    it('expandGrid preserves existing cell data', () => {
      const cell = grid.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.heat = 500;
      cell.lifetime = 42;

      grid.expandGrid(18, 20);

      const preserved = grid.getCell(5, 5)!;
      expect(preserved.structure).toBe(StructureType.FuelRod);
      expect(preserved.heat).toBe(500);
      expect(preserved.lifetime).toBe(42);
      expect(grid.getSize()).toBe(18);
    });

    it('restoreFromState correctly restores grid', () => {
      const state = grid.getSnapshot();
      state[5][5].structure = StructureType.Turbine;
      state[5][5].heat = 250;

      const newGrid = new GridManager(10);
      newGrid.restoreFromState(state, 16);

      expect(newGrid.getSize()).toBe(16);
      expect(newGrid.getCell(5, 5)!.structure).toBe(StructureType.Turbine);
      expect(newGrid.getCell(5, 5)!.heat).toBe(250);
    });
  });

  describe('neighbor calculations', () => {
    it('returns correct neighbor count at center/edge/corner', () => {
      expect(grid.getNeighbors(8, 8)).toHaveLength(4);  // center
      expect(grid.getNeighbors(0, 8)).toHaveLength(3);  // edge
      expect(grid.getNeighbors(0, 0)).toHaveLength(2);  // corner
    });

    it('countAdjacentFuelRods only counts active fuel rods', () => {
      // Active fuel rod
      const active = grid.getCellRef(5, 4)!;
      active.structure = StructureType.FuelRod;
      active.lifetime = 100;

      // Depleted fuel rod
      const depleted = grid.getCellRef(5, 6)!;
      depleted.structure = StructureType.FuelRod;
      depleted.lifetime = 0;

      expect(grid.countAdjacentFuelRods(5, 5)).toBe(1);
    });
  });

  describe('bounds checking', () => {
    it('returns null for out-of-bounds access', () => {
      expect(grid.getCell(-1, 0)).toBeNull();
      expect(grid.getCell(16, 0)).toBeNull();
      expect(grid.getCellRef(-1, 0)).toBeNull();
    });

    it('rejects invalid expansions', () => {
      expect(grid.expandGrid(25, 20)).toBe(false); // beyond max
      expect(grid.expandGrid(10, 20)).toBe(false); // shrinking
      expect(grid.getSize()).toBe(16);
    });
  });
});
