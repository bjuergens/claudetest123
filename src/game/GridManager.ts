/**
 * GridManager - Handles grid creation, neighbor calculations, and cell operations
 *
 * Extracted from HeatGame to reduce cognitive load and enable isolated testing.
 */

import { StructureType, Tier } from './BalanceConfig.js';

export interface Cell {
  x: number;
  y: number;
  structure: StructureType;
  tier: Tier;
  heat: number;
  power: number;
  /** Remaining lifetime in ticks (fuel rods only, 0 = infinite/depleted) */
  lifetime: number;
  /** Whether this is an exotic variant (fuel rods only) */
  isExotic: boolean;
  /** Maximum temperature this cell has reached (fuel rods only, for secret unlocks) */
  maxTempReached: number;
}

export class GridManager {
  private grid: Cell[][];
  private gridSize: number;

  constructor(initialSize: number) {
    this.gridSize = initialSize;
    this.grid = this.createEmptyGrid(initialSize);
  }

  /**
   * Create a new empty grid of the specified size
   */
  createEmptyGrid(size: number): Cell[][] {
    const grid: Cell[][] = [];
    for (let y = 0; y < size; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < size; x++) {
        row.push(this.createEmptyCell(x, y));
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Create an empty cell at the specified coordinates
   */
  createEmptyCell(x: number, y: number): Cell {
    return {
      x,
      y,
      structure: StructureType.Empty,
      tier: Tier.T1,
      heat: 0,
      power: 0,
      lifetime: 0,
      isExotic: false,
      maxTempReached: 0,
    };
  }

  /**
   * Get a copy of a cell at the specified coordinates
   * Returns null if coordinates are out of bounds
   */
  getCell(x: number, y: number): Cell | null {
    if (!this.isValidPosition(x, y)) {
      return null;
    }
    return { ...this.grid[y][x] };
  }

  /**
   * Get a direct reference to a cell (for mutation)
   * Returns null if coordinates are out of bounds
   */
  getCellRef(x: number, y: number): Cell | null {
    if (!this.isValidPosition(x, y)) {
      return null;
    }
    return this.grid[y][x];
  }

  /**
   * Check if coordinates are within grid bounds
   */
  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }

  /**
   * Get the current grid size
   */
  getSize(): number {
    return this.gridSize;
  }

  /**
   * Get a snapshot (deep copy) of the entire grid
   */
  getSnapshot(): Cell[][] {
    return this.grid.map(row => row.map(cell => ({ ...cell })));
  }

  /**
   * Get the internal grid reference (for physics engine)
   */
  getGridRef(): Cell[][] {
    return this.grid;
  }

  /**
   * Get orthogonal neighbors (up, down, left, right) of a cell
   */
  getNeighbors(x: number, y: number): Cell[] {
    const neighbors: Cell[] = [];
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 },  // right
    ];

    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isValidPosition(nx, ny)) {
        neighbors.push(this.grid[ny][nx]);
      }
    }

    return neighbors;
  }

  /**
   * Count active (non-depleted) fuel rods adjacent to a position
   */
  countAdjacentFuelRods(x: number, y: number): number {
    const neighbors = this.getNeighbors(x, y);
    return neighbors.filter(n => n.structure === StructureType.FuelRod && n.lifetime > 0).length;
  }

  /**
   * Count filled (non-empty) cells in the grid
   */
  getFilledCellCount(): number {
    let count = 0;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.grid[y][x].structure !== StructureType.Empty) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Expand the grid to a new size, preserving existing cells
   * Returns true if expansion was successful
   */
  expandGrid(newSize: number, maxSize: number): boolean {
    if (newSize <= this.gridSize) return false;
    if (newSize > maxSize) return false;

    const oldGrid = this.grid;
    const oldSize = this.gridSize;

    // Create new larger grid
    this.grid = this.createEmptyGrid(newSize);
    this.gridSize = newSize;

    // Copy old grid data
    for (let y = 0; y < oldSize; y++) {
      for (let x = 0; x < oldSize; x++) {
        this.grid[y][x] = { ...oldGrid[y][x] };
      }
    }

    return true;
  }

  /**
   * Reset a cell to empty state
   */
  resetCell(x: number, y: number): void {
    if (this.isValidPosition(x, y)) {
      this.grid[y][x] = this.createEmptyCell(x, y);
    }
  }

  /**
   * Clear all cells in the grid (reset to empty)
   */
  clearAll(): void {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        this.grid[y][x] = this.createEmptyCell(x, y);
      }
    }
  }

  /**
   * Iterate over all cells, calling the callback for each
   */
  forEach(callback: (cell: Cell, x: number, y: number) => void): void {
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        callback(this.grid[y][x], x, y);
      }
    }
  }

  /**
   * Restore grid state from serialized data
   */
  restoreFromState(grid: Cell[][], gridSize: number): void {
    this.gridSize = gridSize;
    this.grid = grid.map(row => row.map(cell => ({ ...cell })));
  }
}
