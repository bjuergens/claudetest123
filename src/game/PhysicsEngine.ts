/**
 * PhysicsEngine - Handles heat generation, transfer, dissipation, and power generation
 *
 * Extracted from HeatGame to reduce cognitive load and enable isolated testing.
 * This class is responsible for all physics simulation logic.
 */

import {
  CORE_SETTINGS,
  StructureType,
  Tier,
  STRUCTURE_BASE_STATS,
  FUEL_ADJACENCY,
  ECONOMY,
  UpgradeType,
  UPGRADE_DEFINITIONS,
  SecretUpgradeType,
  EXOTIC_FUEL,
  getFuelHeatGeneration,
} from './BalanceConfig.js';
import { Cell, GridManager } from './GridManager.js';

export interface PhysicsEvent {
  type: 'fuel_depleted' | 'power_sold' | 'structure_melted' | 'meltdown';
  x?: number;
  y?: number;
  tier?: Tier;
  structure?: StructureType;
  amount?: number;
}

export type PhysicsEventListener = (event: PhysicsEvent) => void;

export interface UpgradeLevels {
  [key: string]: number;
}

export interface PhysicsStats {
  totalPowerGenerated: number;
  totalMoneyEarned: number;
  fuelRodsDepleted: number;
  ticksAtHighHeat: number;
  /** Fuel rods depleted that never exceeded 200°C */
  fuelRodsDepletedCool: number;
  /** Fuel rods depleted that never exceeded 100°C */
  fuelRodsDepletedIce: number;
}

/**
 * PhysicsEngine handles all physics simulation for the heat game.
 * It operates on a GridManager and uses upgrade levels for calculations.
 */
export class PhysicsEngine {
  private eventListeners: PhysicsEventListener[] = [];
  private stats: PhysicsStats = {
    totalPowerGenerated: 0,
    totalMoneyEarned: 0,
    fuelRodsDepleted: 0,
    ticksAtHighHeat: 0,
    fuelRodsDepletedCool: 0,
    fuelRodsDepletedIce: 0,
  };

  constructor(
    private gridManager: GridManager,
    private getUpgradeLevel: (type: UpgradeType) => number,
    private isSecretPurchased: (type: SecretUpgradeType) => boolean = () => false
  ) {}

  /**
   * Add an event listener for physics events
   */
  addEventListener(listener: PhysicsEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: PhysicsEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: PhysicsEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  /**
   * Get the current physics stats
   */
  getStats(): PhysicsStats {
    return { ...this.stats };
  }

  /**
   * Reset stats (used after deserialization)
   */
  setStats(stats: PhysicsStats): void {
    this.stats = { ...stats };
  }

  /**
   * Get effective melt temperature for a structure type (with upgrades)
   */
  getEffectiveMeltTemp(structure: StructureType): number {
    const baseTemp = STRUCTURE_BASE_STATS[structure].meltTemp;
    let effectiveTemp = baseTemp;

    let upgradeType: UpgradeType | null = null;
    switch (structure) {
      case StructureType.FuelRod: upgradeType = UpgradeType.MeltTempFuelRod; break;
      case StructureType.Ventilator: upgradeType = UpgradeType.MeltTempVentilator; break;
      case StructureType.HeatExchanger: upgradeType = UpgradeType.MeltTempHeatExchanger; break;
      case StructureType.Insulator: upgradeType = UpgradeType.MeltTempInsulator; break;
      case StructureType.Turbine: upgradeType = UpgradeType.MeltTempTurbine; break;
      case StructureType.Substation: upgradeType = UpgradeType.MeltTempSubstation; break;
    }

    if (upgradeType) {
      const level = this.getUpgradeLevel(upgradeType);
      const definition = UPGRADE_DEFINITIONS[upgradeType];
      effectiveTemp += level * definition.improvementPerLevel;
    }

    // Apply secret upgrade bonuses for fuel rods
    if (structure === StructureType.FuelRod) {
      if (this.isSecretPurchased(SecretUpgradeType.FuelMeltTempBonus)) {
        effectiveTemp += 500; // +500°C from Cryogenic Fuel Casing
      }
      if (this.isSecretPurchased(SecretUpgradeType.CoolRunning)) {
        effectiveTemp += 1000; // +1000°C from Superconductor Technology
      }
    }

    return effectiveTemp;
  }

  /**
   * Get effective conductivity for a cell (with upgrades)
   */
  getEffectiveConductivity(cell: Cell): number {
    const baseConductivity = STRUCTURE_BASE_STATS[cell.structure].conductivity;

    if (cell.structure === StructureType.Turbine) {
      const level = this.getUpgradeLevel(UpgradeType.TurbineConductivity);
      const definition = UPGRADE_DEFINITIONS[UpgradeType.TurbineConductivity];
      return baseConductivity + (level * definition.improvementPerLevel);
    }

    if (cell.structure === StructureType.Insulator) {
      const level = this.getUpgradeLevel(UpgradeType.InsulatorConductivity);
      if (level > 0) {
        return baseConductivity * Math.pow(0.5, level);
      }
    }

    return baseConductivity;
  }

  /**
   * Get effective heat dissipation for a cell (with upgrades)
   */
  getEffectiveHeatDissipation(cell: Cell): number {
    if (cell.structure !== StructureType.Ventilator && cell.structure !== StructureType.VoidCell) {
      return 0;
    }

    const baseStats = STRUCTURE_BASE_STATS[cell.structure];
    let dissipation = baseStats.heatDissipation;

    if (cell.structure === StructureType.Ventilator) {
      dissipation *= Math.pow(10, cell.tier - 1);

      const level = this.getUpgradeLevel(UpgradeType.VentilatorDissipation);
      const definition = UPGRADE_DEFINITIONS[UpgradeType.VentilatorDissipation];
      dissipation += level * definition.improvementPerLevel;
    }

    return dissipation;
  }

  /**
   * Get effective power sale rate for a cell (with upgrades)
   */
  getEffectivePowerSaleRate(cell: Cell): number {
    if (cell.structure !== StructureType.Substation) return 0;

    const baseStats = STRUCTURE_BASE_STATS[cell.structure];
    let saleRate = baseStats.powerSaleRate;

    saleRate *= Math.pow(10, cell.tier - 1);

    const level = this.getUpgradeLevel(UpgradeType.SubstationSaleRate);
    const definition = UPGRADE_DEFINITIONS[UpgradeType.SubstationSaleRate];
    saleRate += level * definition.improvementPerLevel;

    return saleRate;
  }

  /**
   * Process heat generation from fuel rods
   */
  processHeatGeneration(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];

        if (cell.structure !== StructureType.FuelRod) continue;
        if (cell.lifetime <= 0) continue;

        const upgradeLevel = this.getUpgradeLevel(UpgradeType.FuelHeatOutput);
        let heatGeneration = getFuelHeatGeneration(cell.tier, upgradeLevel);

        // Adjacency bonus
        const adjacentFuelRods = this.gridManager.countAdjacentFuelRods(x, y);
        const adjacencyMultiplier = 1 + (adjacentFuelRods * FUEL_ADJACENCY.BONUS_PER_ADJACENT);
        heatGeneration *= adjacencyMultiplier;

        // Exotic fuel scaling
        if (cell.isExotic) {
          const tempMultiplier = Math.min(
            EXOTIC_FUEL.MAX_MULTIPLIER,
            EXOTIC_FUEL.BASE_MULTIPLIER + (cell.heat / 1000) * EXOTIC_FUEL.HEAT_SCALING
          );
          heatGeneration *= tempMultiplier;
        }

        cell.heat += heatGeneration;

        // Track max temperature for secret unlock tracking
        if (cell.heat > cell.maxTempReached) {
          cell.maxTempReached = cell.heat;
        }
      }
    }
  }

  /**
   * Process fuel depletion
   */
  processFuelDepletion(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];

        if (cell.structure !== StructureType.FuelRod) continue;
        if (cell.lifetime <= 0) continue;

        cell.lifetime--;

        if (cell.lifetime <= 0) {
          this.stats.fuelRodsDepleted++;

          // Track clean depletions for secret unlocks
          if (cell.maxTempReached <= 200) {
            this.stats.fuelRodsDepletedCool++;
          }
          if (cell.maxTempReached <= 100) {
            this.stats.fuelRodsDepletedIce++;
          }

          this.emitEvent({
            type: 'fuel_depleted',
            x,
            y,
            tier: cell.tier,
          });
        }
      }
    }
  }

  /**
   * Process heat transfer between cells
   */
  processHeatTransfer(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();

    const heatDeltas: number[][] = [];
    for (let y = 0; y < gridSize; y++) {
      heatDeltas.push(new Array(gridSize).fill(0));
    }

    const transferRate = CORE_SETTINGS.BASE_HEAT_TRANSFER_RATE;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        const cellConductivity = this.getEffectiveConductivity(cell);
        const neighbors = this.gridManager.getNeighbors(x, y);

        for (const neighbor of neighbors) {
          const neighborConductivity = this.getEffectiveConductivity(neighbor);
          const heatDiff = cell.heat - neighbor.heat;

          if (heatDiff > 0) {
            const conductivity = Math.min(cellConductivity, neighborConductivity);
            const transfer = heatDiff * transferRate * conductivity;
            heatDeltas[y][x] -= transfer;
            heatDeltas[neighbor.y][neighbor.x] += transfer;
          }
        }

        // Edge cells lose heat to environment
        const edgeCount = 4 - neighbors.length;
        if (edgeCount > 0 && cell.heat > CORE_SETTINGS.AMBIENT_TEMPERATURE) {
          const heatAboveAmbient = cell.heat - CORE_SETTINGS.AMBIENT_TEMPERATURE;
          const envTransfer = heatAboveAmbient * CORE_SETTINGS.ENVIRONMENT_HEAT_TRANSFER_RATE * edgeCount;
          heatDeltas[y][x] -= envTransfer;
        }
      }
    }

    // Apply deltas
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        grid[y][x].heat = Math.max(0, grid[y][x].heat + heatDeltas[y][x]);
      }
    }
  }

  /**
   * Process heat dissipation (ventilators and void cells)
   */
  processHeatDissipation(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        const dissipation = this.getEffectiveHeatDissipation(cell);
        cell.heat = Math.max(0, cell.heat - dissipation);
      }
    }
  }

  /**
   * Process power generation (turbines)
   */
  processPowerGeneration(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.structure !== StructureType.Turbine) continue;
        if (cell.heat <= 100) continue; // Turbines only work above 100°C

        const baseStats = STRUCTURE_BASE_STATS[StructureType.Turbine];
        const maxHeatConsumption = baseStats.maxHeatConsumption * Math.pow(10, cell.tier - 1);
        const powerGeneration = baseStats.powerGeneration;

        // Only consume heat above 100°C
        const heatAbove100 = cell.heat - 100;
        const heatConsumed = Math.min(heatAbove100, maxHeatConsumption);
        const powerGenerated = heatConsumed * powerGeneration;

        cell.heat -= heatConsumed;
        cell.power += powerGenerated;
        this.stats.totalPowerGenerated += powerGenerated;
      }
    }
  }

  /**
   * Process power sale (substations)
   * Returns the amount of money earned
   */
  processPowerSale(): number {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();
    let totalEarnings = 0;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];

        // Turbines transfer power to nearby substations
        if (cell.structure === StructureType.Turbine && cell.power > 0) {
          const neighbors = this.gridManager.getNeighbors(x, y);
          for (const neighbor of neighbors) {
            if (neighbor.structure === StructureType.Substation) {
              grid[neighbor.y][neighbor.x].power += cell.power;
              cell.power = 0;
              break;
            }
          }
        }

        // Substations sell power
        if (cell.structure === StructureType.Substation && cell.power > 0) {
          const saleRate = this.getEffectivePowerSaleRate(cell);
          const powerToSell = Math.min(cell.power, saleRate);
          const earnings = powerToSell * ECONOMY.MONEY_PER_POWER;

          totalEarnings += earnings;
          this.stats.totalMoneyEarned += earnings;
          cell.power -= powerToSell;

          if (earnings > 0) {
            this.emitEvent({
              type: 'power_sold',
              x,
              y,
              amount: earnings,
            });
          }
        }
      }
    }

    return totalEarnings;
  }

  /**
   * Process overheating and meltdowns
   * Returns true if a meltdown occurred
   */
  processOverheating(): boolean {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();
    let meltdown = false;
    const meltedCells: { x: number; y: number; structure: StructureType; tier: Tier }[] = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.structure === StructureType.Empty) continue;

        const meltTemp = this.getEffectiveMeltTemp(cell.structure);
        if (cell.heat > meltTemp) {
          if (cell.structure === StructureType.FuelRod) {
            meltdown = true;
          } else {
            meltedCells.push({ x, y, structure: cell.structure, tier: cell.tier });
          }
        }
      }
    }

    // Melt non-fuel structures
    for (const { x, y, structure, tier } of meltedCells) {
      this.gridManager.resetCell(x, y);
      this.emitEvent({
        type: 'structure_melted',
        x,
        y,
        structure,
        tier,
      });
    }

    if (meltdown) {
      this.gridManager.clearAll();
      this.emitEvent({ type: 'meltdown' });
    }

    return meltdown;
  }

  /**
   * Track high heat survival (for secret unlock)
   */
  trackHighHeatSurvival(): void {
    const grid = this.gridManager.getGridRef();
    const gridSize = this.gridManager.getSize();
    let hasHighHeatFuelRod = false;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.structure !== StructureType.FuelRod) continue;

        const meltTemp = this.getEffectiveMeltTemp(StructureType.FuelRod);
        if (cell.heat >= meltTemp * 0.9) {
          hasHighHeatFuelRod = true;
          break;
        }
      }
      if (hasHighHeatFuelRod) break;
    }

    if (hasHighHeatFuelRod) {
      this.stats.ticksAtHighHeat++;
    }
  }

  /**
   * Run a complete physics tick
   * Returns the money earned from power sales
   */
  tick(): { moneyEarned: number; meltdown: boolean } {
    this.processHeatGeneration();
    this.processFuelDepletion();
    this.processHeatTransfer();
    this.processHeatDissipation();
    this.processPowerGeneration();
    const moneyEarned = this.processPowerSale();
    const meltdown = this.processOverheating();
    this.trackHighHeatSurvival();

    return { moneyEarned, meltdown };
  }
}
