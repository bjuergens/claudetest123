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
export type { PhysicsStats } from './PhysicsEngine.js';

export interface UpgradeState {
  levels: Record<UpgradeType, number>;
}

export interface SecretState {
  unlocked: Record<SecretUpgradeType, boolean>;
  purchased: Record<SecretUpgradeType, boolean>;
  enabled: Record<SecretUpgradeType, boolean>;
}

/**
 * Stats owned by HeatGame (game-level stats).
 * Physics stats are owned by PhysicsEngine and queried on demand.
 */
export interface GameStats {
  // Game-owned stats
  totalMoneyEarned: number;
  tickCount: number;
  sellCount: number; // Renamed from demolishCount
  manualClicks: number;
  structuresBuilt: number;
  sellAllFullGrid: boolean; // Flag for unlocking SalvageMaster
}

/**
 * Combined stats view returned by getStats().
 * Combines game-owned stats with physics-owned stats.
 */
export interface CombinedStats extends GameStats {
  // Physics-owned stats (queried from PhysicsEngine)
  totalPowerGenerated: number;
  ticksAtHighHeat: number;
  fuelRodsDepleted: number;
  fuelRodsDepletedCool: number;
  fuelRodsDepletedIce: number;
  // Computed for UI
  allTilesAboveTemp: number;
}

export interface GameState {
  grid: Cell[][];
  gridSize: number;
  money: number;
  stats: GameStats;
  physicsStats?: import('./PhysicsEngine.js').PhysicsStats;
  upgrades: UpgradeState;
  secrets: SecretState;
}

export interface GameEvent {
  type:
    | 'structure_built'
    | 'structure_sold'
    | 'structure_melted'
    | 'power_sold'
    | 'fuel_depleted'
    | 'manual_click'
    | 'upgrade_purchased'
    | 'secret_unlocked'
    | 'secret_purchased'
    | 'grid_expanded'
    | 'sell_all';
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
      totalMoneyEarned: 0,
      tickCount: 0,
      sellCount: 0,
      manualClicks: 0,
      structuresBuilt: 0,
      sellAllFullGrid: false,
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

  getTotalPowerGenerated(): number {
    return this.physicsEngine.getStats().totalPowerGenerated;
  }

  getTotalMoneyEarned(): number {
    return this.stats.totalMoneyEarned;
  }

  /**
   * Get combined stats from game and physics engine.
   * Physics stats are queried on demand (single source of truth).
   */
  getStats(): CombinedStats {
    const physicsStats = this.physicsEngine.getStats();
    return {
      ...this.stats,
      totalPowerGenerated: physicsStats.totalPowerGenerated,
      ticksAtHighHeat: physicsStats.ticksAtHighHeat,
      fuelRodsDepleted: physicsStats.fuelRodsDepleted,
      fuelRodsDepletedCool: physicsStats.fuelRodsDepletedCool,
      fuelRodsDepletedIce: physicsStats.fuelRodsDepletedIce,
      allTilesAboveTemp: this.physicsEngine.getMinGridTemp(),
    };
  }

  /**
   * Get the refund rate based on purchased secrets
   * Default: 50%, with Salvage: 75%, with SalvageMaster: 100%
   */
  getRefundRate(): number {
    if (this.upgradeManager.isSecretPurchased(SecretUpgradeType.SalvageMaster)) {
      return 1.0;
    }
    if (this.upgradeManager.isSecretPurchased(SecretUpgradeType.Salvage)) {
      return 0.75;
    }
    return 0.5;
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

    // Cannot build slag or plasma
    if (structure === StructureType.MoltenSlag || structure === StructureType.Plasma) {
      return false;
    }

    // Check if structure is secret and not unlocked
    const baseStats = STRUCTURE_BASE_STATS[structure];
    if (baseStats.isSecret) {
      if (structure === StructureType.VoidCell &&
          !this.upgradeManager.isSecretPurchased(SecretUpgradeType.VoidCellUnlock)) {
        return false;
      }
      if (structure === StructureType.IceCube &&
          !this.upgradeManager.isSecretPurchased(SecretUpgradeType.IceCubeUnlock)) {
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

  /**
   * Sell a structure at the given position
   * Cannot sell MoltenSlag or Plasma - they decay on their own
   */
  sell(x: number, y: number): boolean {
    const cell = this.gridManager.getCell(x, y);
    if (!cell || cell.structure === StructureType.Empty) return false;

    // Cannot sell molten slag or plasma - they decay on their own
    if (cell.structure === StructureType.MoltenSlag || cell.structure === StructureType.Plasma) {
      return false;
    }

    const oldStructure = cell.structure;
    const oldTier = cell.tier;
    const cellHeat = cell.heat;

    // Refund based on upgrade level: 50% default, 75% with Salvage, 100% with SalvageMaster
    const refundRate = this.getRefundRate();
    const refund = Math.floor(getStructureCost(oldStructure, oldTier) * refundRate);
    this.money += refund;

    this.gridManager.resetCell(x, y);
    // Preserve the heat on the now-empty tile
    const emptyCell = this.gridManager.getCellRef(x, y);
    if (emptyCell) {
      emptyCell.heat = cellHeat;
    }

    this.stats.sellCount++;

    this.emitEvent({
      type: 'structure_sold',
      x,
      y,
      structure: oldStructure,
      tier: oldTier,
      amount: refund,
    });

    this.checkSecretUnlocks();
    return true;
  }

  /**
   * Sell all structures on the grid (except MoltenSlag and Plasma)
   * Returns the total refund amount
   */
  sellAll(): number {
    const gridSize = this.gridManager.getSize();
    const filledBefore = this.gridManager.getFilledCellCount();
    const gridCapacity = gridSize * gridSize;

    let totalRefund = 0;
    let soldCount = 0;

    // Collect all sellable structures first
    const toSell: { x: number; y: number }[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = this.gridManager.getCellRef(x, y);
        if (!cell || cell.structure === StructureType.Empty) continue;
        if (cell.structure === StructureType.MoltenSlag || cell.structure === StructureType.Plasma) continue;
        toSell.push({ x, y });
      }
    }

    // Calculate refund
    const refundRate = this.getRefundRate();
    for (const { x, y } of toSell) {
      const cell = this.gridManager.getCellRef(x, y)!;
      const refund = Math.floor(getStructureCost(cell.structure, cell.tier) * refundRate);
      totalRefund += refund;
    }

    // Add refund to money
    this.money += totalRefund;

    // If "Nach mir die Sintflut" is purchased, cool all tiles above 100°C to 100°C
    const coolTiles = this.upgradeManager.isSecretPurchased(SecretUpgradeType.NachMirDieSintflut);

    // Now sell all and optionally cool
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = this.gridManager.getCellRef(x, y);
        if (!cell) continue;

        const isSellable = cell.structure !== StructureType.Empty &&
                           cell.structure !== StructureType.MoltenSlag &&
                           cell.structure !== StructureType.Plasma;

        if (isSellable) {
          const cellHeat = coolTiles ? Math.min(cell.heat, 100) : cell.heat;
          this.gridManager.resetCell(x, y);
          const emptyCell = this.gridManager.getCellRef(x, y);
          if (emptyCell) {
            emptyCell.heat = cellHeat;
          }
          soldCount++;
        } else if (coolTiles && cell.heat > 100) {
          // Cool empty/slag/plasma tiles too
          cell.heat = 100;
        }
      }
    }

    this.stats.sellCount += soldCount;

    // Check if grid was full before selling (for SalvageMaster unlock)
    if (filledBefore === gridCapacity && soldCount > 0) {
      this.stats.sellAllFullGrid = true;
    }

    this.emitEvent({
      type: 'sell_all',
      amount: totalRefund,
    });

    this.checkSecretUnlocks();
    return totalRefund;
  }

  /** @deprecated Use sell() instead */
  demolish(x: number, y: number): boolean {
    return this.sell(x, y);
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
    // Query physics stats from PhysicsEngine (single source of truth)
    const physicsStats = this.physicsEngine.getStats();
    const unlockStats = {
      meltdownCount: 0, // Meltdowns no longer tracked - structures just melt to slag
      filledCells: this.gridManager.getFilledCellCount(),
      totalMoneyEarned: this.stats.totalMoneyEarned,
      sellCount: this.stats.sellCount,
      ticksAtHighHeat: physicsStats.ticksAtHighHeat,
      fuelRodsDepletedCool: physicsStats.fuelRodsDepletedCool,
      fuelRodsDepletedIce: physicsStats.fuelRodsDepletedIce,
      allTilesAboveTemp: this.physicsEngine.getMinGridTemp(),
      sellAllFullGrid: this.stats.sellAllFullGrid,
    };

    this.upgradeManager.checkSecretUnlocks(unlockStats);
  }

  // ==========================================================================
  // GAME TICK (delegate to PhysicsEngine)
  // ==========================================================================

  tick(): void {
    this.stats.tickCount++;

    // Run physics simulation (PhysicsEngine owns physics stats)
    const result = this.physicsEngine.tick();

    // Store heat balance for UI access
    this.lastTickHeatBalance = result.heatBalance;

    // Add money earned from power sales (HeatGame owns money tracking)
    this.money += result.moneyEarned;
    this.stats.totalMoneyEarned += result.moneyEarned;

    // Reset sellAllFullGrid flag after each tick (it's only true for the tick after a sell all)
    if (this.stats.sellAllFullGrid) {
      this.stats.sellAllFullGrid = false;
    }

    // Check secret unlocks
    this.checkSecretUnlocks();
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  serialize(): string {
    // Get physics stats for serialization (owned by PhysicsEngine)
    const physicsStats = this.physicsEngine.getStats();
    const state: GameState = {
      grid: this.gridManager.getSnapshot(),
      gridSize: this.gridManager.getSize(),
      money: this.money,
      stats: { ...this.stats },
      physicsStats: { ...physicsStats },
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

    // Restore money and game-owned stats (handle legacy field names)
    game.money = state.money;
    const legacyStats = state.stats as unknown as Record<string, unknown>;
    game.stats = {
      totalMoneyEarned: (legacyStats.totalMoneyEarned as number) ?? 0,
      tickCount: (legacyStats.tickCount as number) ?? 0,
      sellCount: (legacyStats.sellCount as number) ?? (legacyStats.demolishCount as number) ?? 0,
      manualClicks: (legacyStats.manualClicks as number) ?? 0,
      structuresBuilt: (legacyStats.structuresBuilt as number) ?? 0,
      sellAllFullGrid: (legacyStats.sellAllFullGrid as boolean) ?? false,
    };

    // Restore upgrades
    game.upgradeManager.restoreUpgradeState(state.upgrades);
    game.upgradeManager.restoreSecretState(state.secrets);

    // Restore physics stats (handle legacy saves without physicsStats)
    if (state.physicsStats) {
      game.physicsEngine.setStats(state.physicsStats);
    } else {
      // Legacy save format - physics stats were in state.stats
      game.physicsEngine.setStats({
        totalPowerGenerated: (legacyStats.totalPowerGenerated as number) ?? 0,
        totalMoneyEarned: (legacyStats.totalMoneyEarned as number) ?? 0,
        fuelRodsDepleted: (legacyStats.fuelRodsDepleted as number) ?? 0,
        ticksAtHighHeat: (legacyStats.ticksAtHighHeat as number) ?? 0,
        fuelRodsDepletedCool: (legacyStats.fuelRodsDepletedCool as number) ?? 0,
        fuelRodsDepletedIce: (legacyStats.fuelRodsDepletedIce as number) ?? 0,
      });
    }

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
