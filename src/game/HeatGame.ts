/**
 * Heat Management Game - Core Game Logic
 *
 * Refactored to use composed classes for better separation of concerns:
 * - GridManager: Grid creation and cell operations
 * - PhysicsEngine: Heat/power simulation
 * - UpgradeManager: Upgrade and secret management
 */

import {
  CORE_SETTINGS,
  MANUAL_GENERATION,
  Tier,
  StructureType,
  STRUCTURE_BASE_STATS,
  UpgradeType,
  SecretUpgradeType,
  SECRET_UPGRADE_DEFINITIONS,
  getStructureCost,
  getFuelLifetime,
} from './BalanceConfig.js';

import { GridManager, Cell } from './GridManager.js';
import { PhysicsEngine, PhysicsEvent, TickHeatBalance, CellPerformance } from './PhysicsEngine.js';
import { UpgradeManager, UpgradeEvent } from './UpgradeManager.js';

// Re-export types for backward compatibility
export { StructureType, Tier, UpgradeType, SecretUpgradeType };
export { Cell };
export { TickHeatBalance };
export { CellPerformance };

export interface UpgradeState {
  levels: Record<UpgradeType, number>;
}

export interface SecretState {
  unlocked: Record<SecretUpgradeType, boolean>;
  purchased: Record<SecretUpgradeType, boolean>;
  enabled: Record<SecretUpgradeType, boolean>;
}

export interface GameStats {
  totalPowerGenerated: number;
  totalMoneyEarned: number;
  meltdownCount: number;
  tickCount: number;
  demolishCount: number;
  ticksAtHighHeat: number;
  manualClicks: number;
  structuresBuilt: number;
  fuelRodsDepleted: number;
  fuelRodsDepletedCool: number;
  fuelRodsDepletedIce: number;
}

export interface GameState {
  grid: Cell[][];
  gridSize: number;
  money: number;
  stats: GameStats;
  upgrades: UpgradeState;
  secrets: SecretState;
}

export interface GameEvent {
  type:
    | 'structure_built'
    | 'structure_destroyed'
    | 'structure_melted'
    | 'meltdown'
    | 'power_sold'
    | 'fuel_depleted'
    | 'manual_click'
    | 'upgrade_purchased'
    | 'secret_unlocked'
    | 'secret_purchased'
    | 'grid_expanded';
  x?: number;
  y?: number;
  structure?: StructureType;
  tier?: Tier;
  amount?: number;
  upgradeType?: UpgradeType;
  secretType?: SecretUpgradeType;
  newGridSize?: number;
}

export type GameEventListener = (event: GameEvent) => void;

/**
 * HeatGame - Main game orchestrator
 *
 * Composes GridManager, PhysicsEngine, and UpgradeManager to coordinate
 * game logic while delegating specific responsibilities to each component.
 */
export class HeatGame {
  private gridManager: GridManager;
  private physicsEngine: PhysicsEngine;
  private upgradeManager: UpgradeManager;

  private money: number;
  private stats: GameStats;
  private eventListeners: GameEventListener[] = [];
  private lastTickHeatBalance: TickHeatBalance | null = null;

  constructor(initialMoney: number = CORE_SETTINGS.STARTING_MONEY) {
    // Initialize composed components
    this.gridManager = new GridManager(CORE_SETTINGS.INITIAL_GRID_SIZE);
    this.upgradeManager = new UpgradeManager();
    this.physicsEngine = new PhysicsEngine(
      this.gridManager,
      (type: UpgradeType) => this.upgradeManager.getUpgradeLevel(type),
      (type: SecretUpgradeType) => this.upgradeManager.isSecretPurchased(type)
    );

    this.money = initialMoney;
    this.stats = this.createInitialStats();

    // Wire up event forwarding from sub-components
    this.setupEventForwarding();
  }

  private createInitialStats(): GameStats {
    return {
      totalPowerGenerated: 0,
      totalMoneyEarned: 0,
      meltdownCount: 0,
      tickCount: 0,
      demolishCount: 0,
      ticksAtHighHeat: 0,
      manualClicks: 0,
      structuresBuilt: 0,
      fuelRodsDepleted: 0,
      fuelRodsDepletedCool: 0,
      fuelRodsDepletedIce: 0,
    };
  }

  private setupEventForwarding(): void {
    // Forward physics events
    // Note: Stats are tracked in PhysicsEngine, we only forward events here
    this.physicsEngine.addEventListener((event: PhysicsEvent) => {
      if (event.type === 'fuel_depleted') {
        // Don't increment here - PhysicsEngine already tracks this stat
        this.emitEvent({
          type: 'fuel_depleted',
          x: event.x,
          y: event.y,
          tier: event.tier,
        });
      } else if (event.type === 'power_sold') {
        this.emitEvent({
          type: 'power_sold',
          x: event.x,
          y: event.y,
          amount: event.amount,
        });
      } else if (event.type === 'structure_melted') {
        this.emitEvent({
          type: 'structure_melted',
          x: event.x,
          y: event.y,
          structure: event.structure,
          tier: event.tier,
        });
      } else if (event.type === 'meltdown') {
        this.stats.meltdownCount++;
        this.emitEvent({ type: 'meltdown' });
        this.checkSecretUnlocks();
      }
    });

    // Forward upgrade events
    this.upgradeManager.addEventListener((event: UpgradeEvent) => {
      if (event.type === 'upgrade_purchased') {
        this.emitEvent({ type: 'upgrade_purchased', upgradeType: event.upgradeType });
      } else if (event.type === 'secret_unlocked') {
        this.emitEvent({ type: 'secret_unlocked', secretType: event.secretType });
      } else if (event.type === 'secret_purchased') {
        this.emitEvent({ type: 'secret_purchased', secretType: event.secretType });
      }
    });
  }

  // ==========================================================================
  // EVENT SYSTEM
  // ==========================================================================

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

  // ==========================================================================
  // GETTERS (delegate to sub-components)
  // ==========================================================================

  getCell(x: number, y: number): Cell | null {
    return this.gridManager.getCell(x, y);
  }

  getGridSize(): number {
    return this.gridManager.getSize();
  }

  getMoney(): number {
    return this.money;
  }

  getTickCount(): number {
    return this.stats.tickCount;
  }

  getMeltdownCount(): number {
    return this.stats.meltdownCount;
  }

  getTotalPowerGenerated(): number {
    return this.stats.totalPowerGenerated;
  }

  getTotalMoneyEarned(): number {
    return this.stats.totalMoneyEarned;
  }

  getStats(): GameStats {
    return { ...this.stats };
  }

  getUpgradeLevel(type: UpgradeType): number {
    return this.upgradeManager.getUpgradeLevel(type);
  }

  isSecretUnlocked(type: SecretUpgradeType): boolean {
    return this.upgradeManager.isSecretUnlocked(type);
  }

  isSecretPurchased(type: SecretUpgradeType): boolean {
    return this.upgradeManager.isSecretPurchased(type);
  }

  isSecretEnabled(type: SecretUpgradeType): boolean {
    return this.upgradeManager.isSecretEnabled(type);
  }

  getGridSnapshot(): Cell[][] {
    return this.gridManager.getSnapshot();
  }

  getFilledCellCount(): number {
    return this.gridManager.getFilledCellCount();
  }

  /**
   * Get the heat balance statistics from the last tick
   * Returns null if no tick has been executed yet
   */
  getLastTickHeatBalance(): TickHeatBalance | null {
    return this.lastTickHeatBalance ? { ...this.lastTickHeatBalance } : null;
  }

  /**
   * Get cell performance data for a specific cell
   * Returns null if no tick has been executed yet or cell is invalid
   */
  getCellPerformance(x: number, y: number): CellPerformance | null {
    return this.physicsEngine.getCellPerformance(x, y);
  }

  /**
   * Get the effective melt temperature for a structure type (with upgrades)
   */
  getEffectiveMeltTemp(structure: StructureType): number {
    return this.physicsEngine.getEffectiveMeltTemp(structure);
  }

  /**
   * Get effective power sale rate for a cell (with upgrades)
   */
  getEffectivePowerSaleRate(x: number, y: number): number {
    const cell = this.gridManager.getCellRef(x, y);
    if (!cell) return 0;
    return this.physicsEngine.getEffectivePowerSaleRate(cell);
  }

  /**
   * Get effective power sale rate for a given tier (with upgrades)
   * Used for UI display without an actual cell
   */
  getEffectivePowerSaleRateForTier(tier: Tier): number {
    return this.physicsEngine.getEffectivePowerSaleRateForTier(tier);
  }

  /**
   * Get effective heat dissipation for a ventilator at a given tier (with upgrades)
   */
  getEffectiveVentilatorDissipationForTier(tier: Tier): number {
    return this.physicsEngine.getEffectiveVentilatorDissipationForTier(tier);
  }

  /**
   * Get effective heat generation for a fuel rod at a given tier (with upgrades)
   */
  getEffectiveFuelHeatGenerationForTier(tier: Tier): number {
    return this.physicsEngine.getEffectiveFuelHeatGenerationForTier(tier);
  }

  /**
   * Get effective power generation for a turbine at a given tier
   */
  getEffectiveTurbinePowerForTier(tier: Tier): number {
    return this.physicsEngine.getEffectiveTurbinePowerForTier(tier);
  }

  /**
   * Get effective conductivity for a heat exchanger
   */
  getEffectiveHeatExchangerConductivity(): number {
    return this.physicsEngine.getEffectiveHeatExchangerConductivity();
  }

  /**
   * Get effective conductivity for an insulator (with upgrades)
   */
  getEffectiveInsulatorConductivity(): number {
    return this.physicsEngine.getEffectiveInsulatorConductivity();
  }

  // ==========================================================================
  // MANUAL POWER GENERATION (Clicker)
  // ==========================================================================

  /**
   * Get the current money earned per manual click (with upgrades)
   */
  getMoneyPerClick(): number {
    const upgradeLevel = this.upgradeManager.getUpgradeLevel(UpgradeType.ManualClickPower);
    return MANUAL_GENERATION.BASE_MONEY_PER_CLICK +
      (upgradeLevel * MANUAL_GENERATION.MONEY_PER_LEVEL);
  }

  manualGenerate(): number {
    const upgradeLevel = this.upgradeManager.getUpgradeLevel(UpgradeType.ManualClickPower);
    const moneyEarned = MANUAL_GENERATION.BASE_MONEY_PER_CLICK +
      (upgradeLevel * MANUAL_GENERATION.MONEY_PER_LEVEL);

    this.money += moneyEarned;
    this.stats.totalMoneyEarned += moneyEarned;
    this.stats.manualClicks++;

    this.emitEvent({ type: 'manual_click', amount: moneyEarned });
    return moneyEarned;
  }

  // ==========================================================================
  // BUILDING
  // ==========================================================================

  getStructureCost(structure: StructureType, tier: Tier): number {
    return getStructureCost(structure, tier);
  }

  canBuild(x: number, y: number, structure: StructureType, tier: Tier = Tier.T1): boolean {
    const cell = this.gridManager.getCell(x, y);
    if (!cell) return false;
    if (cell.structure !== StructureType.Empty) return false;

    // Check if structure is secret and not unlocked
    const baseStats = STRUCTURE_BASE_STATS[structure];
    if (baseStats.isSecret) {
      if (structure === StructureType.VoidCell &&
          !this.upgradeManager.isSecretPurchased(SecretUpgradeType.VoidCellUnlock)) {
        return false;
      }
    }

    const cost = getStructureCost(structure, tier);
    return this.money >= cost;
  }

  build(x: number, y: number, structure: StructureType, tier: Tier = Tier.T1, isExotic: boolean = false): boolean {
    if (!this.canBuild(x, y, structure, tier)) return false;

    // Exotic fuel requires the secret to be purchased and enabled
    if (isExotic && structure === StructureType.FuelRod) {
      if (!this.upgradeManager.isSecretPurchased(SecretUpgradeType.ExoticFuel) ||
          !this.upgradeManager.isSecretEnabled(SecretUpgradeType.ExoticFuel)) {
        isExotic = false;
      }
    }

    const cost = getStructureCost(structure, tier);
    this.money -= cost;

    const cell = this.gridManager.getCellRef(x, y)!;
    cell.structure = structure;
    cell.tier = tier;
    cell.heat = 0;
    cell.power = 0;
    cell.isExotic = isExotic;

    // Set lifetime for fuel rods
    if (structure === StructureType.FuelRod) {
      const upgradeLevel = this.upgradeManager.getUpgradeLevel(UpgradeType.FuelLifetime);
      cell.lifetime = getFuelLifetime(tier, upgradeLevel);
    } else {
      cell.lifetime = 0;
    }

    this.stats.structuresBuilt++;

    this.emitEvent({
      type: 'structure_built',
      x,
      y,
      structure,
      tier,
    });

    this.checkSecretUnlocks();
    return true;
  }

  demolish(x: number, y: number): boolean {
    const cell = this.gridManager.getCell(x, y);
    if (!cell || cell.structure === StructureType.Empty) return false;

    const oldStructure = cell.structure;
    const oldTier = cell.tier;

    // Base 75% refund on sell
    const refund = Math.floor(getStructureCost(oldStructure, oldTier) * 0.75);
    this.money += refund;

    this.gridManager.resetCell(x, y);
    this.stats.demolishCount++;

    this.emitEvent({
      type: 'structure_destroyed',
      x,
      y,
      structure: oldStructure,
      tier: oldTier,
    });

    this.checkSecretUnlocks();
    return true;
  }

  // ==========================================================================
  // UPGRADES (delegate to UpgradeManager)
  // ==========================================================================

  getUpgradeCost(type: UpgradeType): number {
    return this.upgradeManager.getUpgradeCost(type);
  }

  canPurchaseUpgrade(type: UpgradeType): boolean {
    return this.upgradeManager.canPurchaseUpgrade(type, this.money);
  }

  purchaseUpgrade(type: UpgradeType): boolean {
    const cost = this.upgradeManager.purchaseUpgrade(type, this.money);
    if (cost > 0) {
      this.money -= cost;
      return true;
    }
    return false;
  }

  // ==========================================================================
  // SECRET UPGRADES (delegate to UpgradeManager)
  // ==========================================================================

  getSecretCost(type: SecretUpgradeType): number {
    return this.upgradeManager.getSecretCost(type);
  }

  canPurchaseSecret(type: SecretUpgradeType): boolean {
    return this.upgradeManager.canPurchaseSecret(type, this.money);
  }

  purchaseSecret(type: SecretUpgradeType): boolean {
    const cost = this.upgradeManager.purchaseSecret(type, this.money);
    if (cost > 0) {
      this.money -= cost;

      // Handle reactor expansion
      const expansionSize = this.upgradeManager.getExpansionSize(type);
      if (expansionSize !== null) {
        this.expandGrid(expansionSize);
      }

      return true;
    }
    return false;
  }

  toggleSecret(type: SecretUpgradeType, enabled: boolean): void {
    this.upgradeManager.toggleSecret(type, enabled);
  }

  private expandGrid(newSize: number): void {
    if (this.gridManager.expandGrid(newSize, CORE_SETTINGS.MAX_GRID_SIZE)) {
      this.emitEvent({ type: 'grid_expanded', newGridSize: newSize });
    }
  }

  private checkSecretUnlocks(): void {
    const stats = {
      meltdownCount: this.stats.meltdownCount,
      filledCells: this.gridManager.getFilledCellCount(),
      totalMoneyEarned: this.stats.totalMoneyEarned,
      demolishCount: this.stats.demolishCount,
      ticksAtHighHeat: this.stats.ticksAtHighHeat,
      fuelRodsDepletedCool: this.stats.fuelRodsDepletedCool,
      fuelRodsDepletedIce: this.stats.fuelRodsDepletedIce,
    };

    this.upgradeManager.checkSecretUnlocks(stats);
  }

  // ==========================================================================
  // GAME TICK (delegate to PhysicsEngine)
  // ==========================================================================

  tick(): void {
    this.stats.tickCount++;

    // Run physics simulation
    const result = this.physicsEngine.tick();

    // Store heat balance for UI access
    this.lastTickHeatBalance = result.heatBalance;

    // Sync stats from physics engine (single source of truth for physics-related stats)
    const physicsStats = this.physicsEngine.getStats();
    this.stats.totalPowerGenerated = physicsStats.totalPowerGenerated;
    this.stats.ticksAtHighHeat = physicsStats.ticksAtHighHeat;
    this.stats.fuelRodsDepleted = physicsStats.fuelRodsDepleted;
    this.stats.fuelRodsDepletedCool = physicsStats.fuelRodsDepletedCool;
    this.stats.fuelRodsDepletedIce = physicsStats.fuelRodsDepletedIce;

    // Add money earned from power sales
    this.money += result.moneyEarned;
    this.stats.totalMoneyEarned += result.moneyEarned;

    // Check secret unlocks
    this.checkSecretUnlocks();
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  serialize(): string {
    const state: GameState = {
      grid: this.gridManager.getSnapshot(),
      gridSize: this.gridManager.getSize(),
      money: this.money,
      stats: { ...this.stats },
      upgrades: this.upgradeManager.getUpgradeState(),
      secrets: this.upgradeManager.getSecretState(),
    };
    return JSON.stringify(state);
  }

  static deserialize(data: string): HeatGame {
    const state = JSON.parse(data) as GameState;
    const game = new HeatGame(0);

    // Restore grid
    game.gridManager.restoreFromState(state.grid, state.gridSize);

    // Restore money and stats
    game.money = state.money;
    game.stats = { ...state.stats };

    // Restore upgrades
    game.upgradeManager.restoreUpgradeState(state.upgrades);
    game.upgradeManager.restoreSecretState(state.secrets);

    // Sync physics engine stats
    game.physicsEngine.setStats({
      totalPowerGenerated: state.stats.totalPowerGenerated,
      totalMoneyEarned: state.stats.totalMoneyEarned,
      fuelRodsDepleted: state.stats.fuelRodsDepleted,
      ticksAtHighHeat: state.stats.ticksAtHighHeat,
      fuelRodsDepletedCool: state.stats.fuelRodsDepletedCool ?? 0,
      fuelRodsDepletedIce: state.stats.fuelRodsDepletedIce ?? 0,
    });

    return game;
  }

  // ==========================================================================
  // BACKWARD COMPATIBILITY
  // ==========================================================================

  /** @deprecated Use getGridSize() instead */
  get GRID_SIZE(): number {
    return this.gridManager.getSize();
  }
}

// Re-export for backward compatibility
export { CORE_SETTINGS };
export const GRID_SIZE = CORE_SETTINGS.INITIAL_GRID_SIZE;
