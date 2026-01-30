/**
 * Heat Management Game - Core Game Logic
 */

import { GRID_SIZE } from '../constants.js';

// Re-export for backward compatibility
export { GRID_SIZE };

export enum StructureType {
  Empty = 'empty',
  FuelRod = 'fuel_rod',
  Ventilator = 'ventilator',
  HeatExchanger = 'heat_exchanger',
  Battery = 'battery',
  InsulationPlate = 'insulation_plate',
  Turbine = 'turbine',
  Substation = 'substation',
}

export interface StructureStats {
  maxHeat: number;
  heatGeneration: number;      // Heat produced per tick (fuel rods)
  heatDissipation: number;     // Heat removed per tick (ventilators)
  heatConductivity: number;    // Multiplier for heat transfer (1.0 = normal)
  powerGeneration: number;     // Power produced per heat unit (turbines)
  cost: number;                // Money cost to build
}

export const STRUCTURE_STATS: Record<StructureType, StructureStats> = {
  [StructureType.Empty]: {
    maxHeat: Infinity,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 1.0,
    powerGeneration: 0,
    cost: 0,
  },
  [StructureType.FuelRod]: {
    maxHeat: 1000,
    heatGeneration: 50,
    heatDissipation: 0,
    heatConductivity: 1.0,
    powerGeneration: 0,
    cost: 100,
  },
  [StructureType.Ventilator]: {
    maxHeat: 500,
    heatGeneration: 0,
    heatDissipation: 30,
    heatConductivity: 1.0,
    powerGeneration: 0,
    cost: 50,
  },
  [StructureType.HeatExchanger]: {
    maxHeat: 800,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 2.0,
    powerGeneration: 0,
    cost: 75,
  },
  [StructureType.Battery]: {
    maxHeat: 300,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 0.5,
    powerGeneration: 0,
    cost: 150,
  },
  [StructureType.InsulationPlate]: {
    maxHeat: 2000,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 0.1,
    powerGeneration: 0,
    cost: 30,
  },
  [StructureType.Turbine]: {
    maxHeat: 600,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 1.0,
    powerGeneration: 0.1,
    powerConsumption: 20,      // Heat consumed to generate power
    cost: 200,
  } as StructureStats,
  [StructureType.Substation]: {
    maxHeat: 400,
    heatGeneration: 0,
    heatDissipation: 0,
    heatConductivity: 1.0,
    powerGeneration: 0,
    cost: 250,
  },
};

export interface Cell {
  x: number;
  y: number;
  structure: StructureType;
  heat: number;
  power: number;              // Power stored (for substations/batteries)
}

export interface GameState {
  grid: Cell[][];
  money: number;
  totalPowerGenerated: number;
  totalMoneyEarned: number;
  meltdownCount: number;
  tickCount: number;
}

export interface GameEvent {
  type: 'structure_built' | 'structure_destroyed' | 'meltdown' | 'power_sold';
  x?: number;
  y?: number;
  structure?: StructureType;
  amount?: number;
}

export type GameEventListener = (event: GameEvent) => void;

export class HeatGame {
  private state: GameState;
  private eventListeners: GameEventListener[] = [];

  constructor(initialMoney: number = 500) {
    this.state = this.createInitialState(initialMoney);
  }

  private createInitialState(initialMoney: number): GameState {
    const grid: Cell[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push({
          x,
          y,
          structure: StructureType.Empty,
          heat: 0,
          power: 0,
        });
      }
      grid.push(row);
    }

    return {
      grid,
      money: initialMoney,
      totalPowerGenerated: 0,
      totalMoneyEarned: 0,
      meltdownCount: 0,
      tickCount: 0,
    };
  }

  // Event system
  addEventListener(listener: GameEventListener): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: GameEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: GameEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  // Getters for game state (read-only access)
  getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return null;
    }
    return { ...this.state.grid[y][x] };
  }

  getMoney(): number {
    return this.state.money;
  }

  getTickCount(): number {
    return this.state.tickCount;
  }

  getMeltdownCount(): number {
    return this.state.meltdownCount;
  }

  getTotalPowerGenerated(): number {
    return this.state.totalPowerGenerated;
  }

  getTotalMoneyEarned(): number {
    return this.state.totalMoneyEarned;
  }

  getGridSnapshot(): Cell[][] {
    return this.state.grid.map(row => row.map(cell => ({ ...cell })));
  }

  // Building structures
  canBuild(x: number, y: number, structure: StructureType): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    if (cell.structure !== StructureType.Empty) return false;

    const cost = STRUCTURE_STATS[structure].cost;
    return this.state.money >= cost;
  }

  build(x: number, y: number, structure: StructureType): boolean {
    if (!this.canBuild(x, y, structure)) return false;

    const cost = STRUCTURE_STATS[structure].cost;
    this.state.money -= cost;
    this.state.grid[y][x].structure = structure;

    this.emitEvent({
      type: 'structure_built',
      x,
      y,
      structure,
    });

    return true;
  }

  // Remove a structure (refunds nothing)
  demolish(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || cell.structure === StructureType.Empty) return false;

    const oldStructure = this.state.grid[y][x].structure;
    this.state.grid[y][x].structure = StructureType.Empty;
    this.state.grid[y][x].heat = 0;
    this.state.grid[y][x].power = 0;

    this.emitEvent({
      type: 'structure_destroyed',
      x,
      y,
      structure: oldStructure,
    });

    return true;
  }

  // Get neighbors for heat transfer
  private getNeighbors(x: number, y: number): Cell[] {
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
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        neighbors.push(this.state.grid[ny][nx]);
      }
    }

    return neighbors;
  }

  // Main game tick - processes one frame of simulation
  tick(): void {
    this.state.tickCount++;

    // Phase 1: Heat generation (fuel rods)
    this.processHeatGeneration();

    // Phase 2: Heat transfer between cells
    this.processHeatTransfer();

    // Phase 3: Heat dissipation (ventilators)
    this.processHeatDissipation();

    // Phase 4: Power generation (turbines)
    this.processPowerGeneration();

    // Phase 5: Power collection and sale (substations)
    this.processPowerSale();

    // Phase 6: Check for overheating and meltdowns
    this.processOverheating();
  }

  private processHeatGeneration(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];
        const stats = STRUCTURE_STATS[cell.structure];
        cell.heat += stats.heatGeneration;
      }
    }
  }

  private processHeatTransfer(): void {
    // Calculate heat deltas first, then apply (to avoid order-dependent results)
    const heatDeltas: number[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      heatDeltas.push(new Array(GRID_SIZE).fill(0));
    }

    const transferRate = 0.1; // Base heat transfer rate

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];
        const cellStats = STRUCTURE_STATS[cell.structure];
        const neighbors = this.getNeighbors(x, y);

        for (const neighbor of neighbors) {
          const neighborStats = STRUCTURE_STATS[neighbor.structure];
          const heatDiff = cell.heat - neighbor.heat;

          // Heat flows from hot to cold
          if (heatDiff > 0) {
            const conductivity = Math.min(cellStats.heatConductivity, neighborStats.heatConductivity);
            const transfer = heatDiff * transferRate * conductivity;
            heatDeltas[y][x] -= transfer;
            heatDeltas[neighbor.y][neighbor.x] += transfer;
          }
        }

        // Edge cells lose heat to environment
        const edgeCount = 4 - neighbors.length;
        if (edgeCount > 0 && cell.heat > 0) {
          const envTransfer = cell.heat * transferRate * 0.5 * edgeCount;
          heatDeltas[y][x] -= envTransfer;
        }
      }
    }

    // Apply deltas
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        this.state.grid[y][x].heat = Math.max(0, this.state.grid[y][x].heat + heatDeltas[y][x]);
      }
    }
  }

  private processHeatDissipation(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];
        const stats = STRUCTURE_STATS[cell.structure];
        cell.heat = Math.max(0, cell.heat - stats.heatDissipation);
      }
    }
  }

  private processPowerGeneration(): void {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];
        if (cell.structure === StructureType.Turbine && cell.heat > 0) {
          const stats = STRUCTURE_STATS[cell.structure];
          const heatConsumed = Math.min(cell.heat, 20); // Consume up to 20 heat
          const powerGenerated = heatConsumed * stats.powerGeneration;

          cell.heat -= heatConsumed;
          cell.power += powerGenerated;
          this.state.totalPowerGenerated += powerGenerated;
        }
      }
    }
  }

  private processPowerSale(): void {
    const powerPrice = 10; // Money per power unit

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];

        // Turbines transfer power to nearby substations
        if (cell.structure === StructureType.Turbine && cell.power > 0) {
          const neighbors = this.getNeighbors(x, y);
          for (const neighbor of neighbors) {
            if (neighbor.structure === StructureType.Substation) {
              this.state.grid[neighbor.y][neighbor.x].power += cell.power;
              cell.power = 0;
              break;
            }
          }
        }

        // Substations sell power automatically
        if (cell.structure === StructureType.Substation && cell.power > 0) {
          const earnings = cell.power * powerPrice;
          this.state.money += earnings;
          this.state.totalMoneyEarned += earnings;

          this.emitEvent({
            type: 'power_sold',
            x,
            y,
            amount: earnings,
          });

          cell.power = 0;
        }
      }
    }
  }

  private processOverheating(): void {
    let meltdown = false;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.state.grid[y][x];
        if (cell.structure === StructureType.Empty) continue;

        const stats = STRUCTURE_STATS[cell.structure];
        if (cell.heat > stats.maxHeat) {
          if (cell.structure === StructureType.FuelRod) {
            // Fuel rod meltdown - catastrophic failure
            meltdown = true;
          } else {
            // Regular structure breaks
            this.demolish(x, y);
          }
        }
      }
    }

    if (meltdown) {
      this.triggerMeltdown();
    }
  }

  private triggerMeltdown(): void {
    this.state.meltdownCount++;

    // Destroy all structures but keep money
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        this.state.grid[y][x].structure = StructureType.Empty;
        this.state.grid[y][x].heat = 0;
        this.state.grid[y][x].power = 0;
      }
    }

    this.emitEvent({ type: 'meltdown' });
  }

  // Serialization for save/load
  serialize(): string {
    return JSON.stringify(this.state);
  }

  static deserialize(data: string): HeatGame {
    const state = JSON.parse(data) as GameState;
    const game = new HeatGame(0);
    game.state = state;
    return game;
  }
}
