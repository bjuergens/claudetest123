/**
 * Unit tests for GridManager
 *
 * Tests grid creation, neighbor calculations, and cell operations in isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from './GridManager.js';
import { StructureType, Tier } from './BalanceConfig.js';

describe('GridManager', () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager(16);
  });

  describe('initialization', () => {
    it('should create a grid of the specified size', () => {
      expect(gridManager.getSize()).toBe(16);
    });

    it('should initialize all cells as empty', () => {
      const snapshot = gridManager.getSnapshot();
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          expect(snapshot[y][x].structure).toBe(StructureType.Empty);
          expect(snapshot[y][x].heat).toBe(0);
          expect(snapshot[y][x].power).toBe(0);
        }
      }
    });

    it('should set correct x,y coordinates for each cell', () => {
      const snapshot = gridManager.getSnapshot();
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          expect(snapshot[y][x].x).toBe(x);
          expect(snapshot[y][x].y).toBe(y);
        }
      }
    });
  });

  describe('getCell', () => {
    it('should return a copy of the cell at valid coordinates', () => {
      const cell = gridManager.getCell(5, 5);
      expect(cell).not.toBeNull();
      expect(cell!.x).toBe(5);
      expect(cell!.y).toBe(5);
    });

    it('should return null for out-of-bounds coordinates', () => {
      expect(gridManager.getCell(-1, 0)).toBeNull();
      expect(gridManager.getCell(0, -1)).toBeNull();
      expect(gridManager.getCell(16, 0)).toBeNull();
      expect(gridManager.getCell(0, 16)).toBeNull();
    });

    it('should return a copy, not a reference', () => {
      const cell = gridManager.getCell(5, 5);
      cell!.heat = 100;
      const cellAgain = gridManager.getCell(5, 5);
      expect(cellAgain!.heat).toBe(0);
    });
  });

  describe('getCellRef', () => {
    it('should return a reference that can be mutated', () => {
      const cellRef = gridManager.getCellRef(5, 5);
      cellRef!.heat = 100;
      const cell = gridManager.getCell(5, 5);
      expect(cell!.heat).toBe(100);
    });

    it('should return null for out-of-bounds coordinates', () => {
      expect(gridManager.getCellRef(-1, 0)).toBeNull();
      expect(gridManager.getCellRef(16, 0)).toBeNull();
    });
  });

  describe('isValidPosition', () => {
    it('should return true for valid positions', () => {
      expect(gridManager.isValidPosition(0, 0)).toBe(true);
      expect(gridManager.isValidPosition(15, 15)).toBe(true);
      expect(gridManager.isValidPosition(8, 8)).toBe(true);
    });

    it('should return false for invalid positions', () => {
      expect(gridManager.isValidPosition(-1, 0)).toBe(false);
      expect(gridManager.isValidPosition(0, -1)).toBe(false);
      expect(gridManager.isValidPosition(16, 0)).toBe(false);
      expect(gridManager.isValidPosition(0, 16)).toBe(false);
    });
  });

  describe('getNeighbors', () => {
    it('should return 4 neighbors for center cells', () => {
      const neighbors = gridManager.getNeighbors(8, 8);
      expect(neighbors).toHaveLength(4);
    });

    it('should return 3 neighbors for edge cells', () => {
      const neighbors = gridManager.getNeighbors(0, 8);
      expect(neighbors).toHaveLength(3);
    });

    it('should return 2 neighbors for corner cells', () => {
      const neighbors = gridManager.getNeighbors(0, 0);
      expect(neighbors).toHaveLength(2);
    });

    it('should return orthogonal neighbors only', () => {
      const neighbors = gridManager.getNeighbors(5, 5);
      const positions = neighbors.map(n => ({ x: n.x, y: n.y }));

      expect(positions).toContainEqual({ x: 5, y: 4 }); // up
      expect(positions).toContainEqual({ x: 5, y: 6 }); // down
      expect(positions).toContainEqual({ x: 4, y: 5 }); // left
      expect(positions).toContainEqual({ x: 6, y: 5 }); // right
    });
  });

  describe('countAdjacentFuelRods', () => {
    it('should return 0 when no fuel rods are adjacent', () => {
      expect(gridManager.countAdjacentFuelRods(5, 5)).toBe(0);
    });

    it('should count active fuel rods only', () => {
      // Place active fuel rod
      const cell1 = gridManager.getCellRef(5, 4)!;
      cell1.structure = StructureType.FuelRod;
      cell1.lifetime = 100;

      // Place depleted fuel rod
      const cell2 = gridManager.getCellRef(5, 6)!;
      cell2.structure = StructureType.FuelRod;
      cell2.lifetime = 0;

      expect(gridManager.countAdjacentFuelRods(5, 5)).toBe(1);
    });

    it('should count all adjacent active fuel rods', () => {
      const positions = [
        { x: 5, y: 4 },
        { x: 5, y: 6 },
        { x: 4, y: 5 },
        { x: 6, y: 5 },
      ];

      for (const pos of positions) {
        const cell = gridManager.getCellRef(pos.x, pos.y)!;
        cell.structure = StructureType.FuelRod;
        cell.lifetime = 100;
      }

      expect(gridManager.countAdjacentFuelRods(5, 5)).toBe(4);
    });
  });

  describe('getFilledCellCount', () => {
    it('should return 0 for empty grid', () => {
      expect(gridManager.getFilledCellCount()).toBe(0);
    });

    it('should count non-empty cells', () => {
      gridManager.getCellRef(0, 0)!.structure = StructureType.FuelRod;
      gridManager.getCellRef(1, 1)!.structure = StructureType.Turbine;
      gridManager.getCellRef(2, 2)!.structure = StructureType.Ventilator;

      expect(gridManager.getFilledCellCount()).toBe(3);
    });
  });

  describe('expandGrid', () => {
    it('should expand grid to new size', () => {
      gridManager.getCellRef(5, 5)!.structure = StructureType.FuelRod;

      const result = gridManager.expandGrid(18, 20);
      expect(result).toBe(true);
      expect(gridManager.getSize()).toBe(18);
    });

    it('should preserve existing cells after expansion', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.FuelRod;
      cell.heat = 500;

      gridManager.expandGrid(18, 20);

      const preserved = gridManager.getCell(5, 5);
      expect(preserved!.structure).toBe(StructureType.FuelRod);
      expect(preserved!.heat).toBe(500);
    });

    it('should not expand beyond max size', () => {
      const result = gridManager.expandGrid(25, 20);
      expect(result).toBe(false);
      expect(gridManager.getSize()).toBe(16);
    });

    it('should not shrink the grid', () => {
      const result = gridManager.expandGrid(10, 20);
      expect(result).toBe(false);
      expect(gridManager.getSize()).toBe(16);
    });
  });

  describe('resetCell', () => {
    it('should reset a cell to empty state', () => {
      const cell = gridManager.getCellRef(5, 5)!;
      cell.structure = StructureType.Turbine;
      cell.heat = 500;
      cell.power = 100;

      gridManager.resetCell(5, 5);

      const reset = gridManager.getCell(5, 5);
      expect(reset!.structure).toBe(StructureType.Empty);
      expect(reset!.heat).toBe(0);
      expect(reset!.power).toBe(0);
    });

    it('should preserve coordinates after reset', () => {
      gridManager.resetCell(5, 5);
      const cell = gridManager.getCell(5, 5);
      expect(cell!.x).toBe(5);
      expect(cell!.y).toBe(5);
    });
  });

  describe('clearAll', () => {
    it('should reset all cells to empty', () => {
      // Fill some cells
      for (let i = 0; i < 5; i++) {
        gridManager.getCellRef(i, i)!.structure = StructureType.FuelRod;
      }

      gridManager.clearAll();

      expect(gridManager.getFilledCellCount()).toBe(0);
    });
  });

  describe('forEach', () => {
    it('should iterate over all cells', () => {
      let count = 0;
      gridManager.forEach(() => count++);
      expect(count).toBe(16 * 16);
    });

    it('should provide correct cell references', () => {
      gridManager.forEach((cell, x, y) => {
        expect(cell.x).toBe(x);
        expect(cell.y).toBe(y);
      });
    });
  });

  describe('restoreFromState', () => {
    it('should restore grid from serialized state', () => {
      // Create a state to restore
      const state = gridManager.getSnapshot();
      state[5][5].structure = StructureType.Turbine;
      state[5][5].heat = 250;

      // Create new grid manager and restore
      const newGridManager = new GridManager(10);
      newGridManager.restoreFromState(state, 16);

      expect(newGridManager.getSize()).toBe(16);
      const cell = newGridManager.getCell(5, 5);
      expect(cell!.structure).toBe(StructureType.Turbine);
      expect(cell!.heat).toBe(250);
    });
  });
});
