/**
 * Heat Management Game - Core Game Logic
 *
 * Refactored to support:
 * - Tiered items (T1-T4)
 * - Fuel rod lifetime and depletion
 * - Adjacency heat bonus for fuel rods
 * - Manual power generation (clicker)
 * - Upgrade system (regular + secret)
 * - Exotic fuel rods
 * - Dynamic grid size (16x16 to 20x20)
 * - Variable melt temperatures and conductivity
 */

import {
  CORE_SETTINGS,
  MANUAL_GENERATION,
  Tier,
  StructureType,
  STRUCTURE_BASE_STATS,
  FUEL_ADJACENCY,
  ECONOMY,
  UpgradeType,
  UPGRADE_DEFINITIONS,
  SecretUpgradeType,
  SECRET_UPGRADE_DEFINITIONS,
  EXOTIC_FUEL,
  getStructureCost,
  getFuelLifetime,
  getFuelHeatGeneration,
  getUpgradeCost,
  getSecretUnlockProgress,
} from './BalanceConfig.js';

// Re-export types for backward compatibility
export { StructureType, Tier, UpgradeType, SecretUpgradeType };

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
}

export interface UpgradeState {
  levels: Record<UpgradeType, number>;
}

export interface SecretState {
  /** Whether the unlock condition has been met */
  unlocked: Record<SecretUpgradeType, boolean>;
  /** Whether the upgrade has been purchased */
  purchased: Record<SecretUpgradeType, boolean>;
  /** Toggle state for toggleable secrets */
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

// Helper to create initial upgrade state
function createInitialUpgradeState(): UpgradeState {
  const levels: Record<UpgradeType, number> = {} as Record<UpgradeType, number>;
  for (const type of Object.values(UpgradeType)) {
    levels[type] = 0;
  }
  return { levels };
}

// Helper to create initial secret state
function createInitialSecretState(): SecretState {
  const unlocked: Record<SecretUpgradeType, boolean> = {} as Record<SecretUpgradeType, boolean>;
  const purchased: Record<SecretUpgradeType, boolean> = {} as Record<SecretUpgradeType, boolean>;
  const enabled: Record<SecretUpgradeType, boolean> = {} as Record<SecretUpgradeType, boolean>;

  for (const type of Object.values(SecretUpgradeType)) {
    unlocked[type] = false;
    purchased[type] = false;
    enabled[type] = false;
  }
  return { unlocked, purchased, enabled };
}

export class HeatGame {
  private state: GameState;
  private eventListeners: GameEventListener[] = [];

  constructor(initialMoney: number = CORE_SETTINGS.STARTING_MONEY) {
    this.state = this.createInitialState(initialMoney);
  }

  private createInitialState(initialMoney: number): GameState {
    const gridSize = CORE_SETTINGS.INITIAL_GRID_SIZE;
    const grid = this.createEmptyGrid(gridSize);

    return {
      grid,
      gridSize,
      money: initialMoney,
      stats: {
        totalPowerGenerated: 0,
        totalMoneyEarned: 0,
        meltdownCount: 0,
        tickCount: 0,
        demolishCount: 0,
        ticksAtHighHeat: 0,
        manualClicks: 0,
        structuresBuilt: 0,
        fuelRodsDepleted: 0,
      },
      upgrades: createInitialUpgradeState(),
      secrets: createInitialSecretState(),
    };
  }

  private createEmptyGrid(size: number): Cell[][] {
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

  private createEmptyCell(x: number, y: number): Cell {
    return {
      x,
      y,
      structure: StructureType.Empty,
      tier: Tier.T1,
      heat: 0,
      power: 0,
      lifetime: 0,
      isExotic: false,
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

  // ==========================================================================
  // GETTERS
  // ==========================================================================

  getCell(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.state.gridSize || y < 0 || y >= this.state.gridSize) {
      return null;
    }
    return { ...this.state.grid[y][x] };
  }

  getGridSize(): number {
    return this.state.gridSize;
  }

  getMoney(): number {
    return this.state.money;
  }

  getTickCount(): number {
    return this.state.stats.tickCount;
  }

  getMeltdownCount(): number {
    return this.state.stats.meltdownCount;
  }

  getTotalPowerGenerated(): number {
    return this.state.stats.totalPowerGenerated;
  }

  getTotalMoneyEarned(): number {
    return this.state.stats.totalMoneyEarned;
  }

  getStats(): GameStats {
    return { ...this.state.stats };
  }

  getUpgradeLevel(type: UpgradeType): number {
    return this.state.upgrades.levels[type];
  }

  isSecretUnlocked(type: SecretUpgradeType): boolean {
    return this.state.secrets.unlocked[type];
  }

  isSecretPurchased(type: SecretUpgradeType): boolean {
    return this.state.secrets.purchased[type];
  }

  isSecretEnabled(type: SecretUpgradeType): boolean {
    return this.state.secrets.enabled[type];
  }

  getGridSnapshot(): Cell[][] {
    return this.state.grid.map(row => row.map(cell => ({ ...cell })));
  }

  getFilledCellCount(): number {
    let count = 0;
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        if (this.state.grid[y][x].structure !== StructureType.Empty) {
          count++;
        }
      }
    }
    return count;
  }

  // ==========================================================================
  // MANUAL POWER GENERATION (Clicker)
  // ==========================================================================

  manualGenerate(): number {
    const upgradeLevel = this.state.upgrades.levels[UpgradeType.ManualClickPower];
    const moneyEarned = MANUAL_GENERATION.BASE_MONEY_PER_CLICK +
      (upgradeLevel * MANUAL_GENERATION.MONEY_PER_LEVEL);

    this.state.money += moneyEarned;
    this.state.stats.totalMoneyEarned += moneyEarned;
    this.state.stats.manualClicks++;

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
    const cell = this.getCell(x, y);
    if (!cell) return false;
    if (cell.structure !== StructureType.Empty) return false;

    // Check if structure is secret and not unlocked
    const baseStats = STRUCTURE_BASE_STATS[structure];
    if (baseStats.isSecret) {
      if (structure === StructureType.VoidCell && !this.state.secrets.purchased[SecretUpgradeType.VoidCellUnlock]) {
        return false;
      }
    }

    const cost = getStructureCost(structure, tier);
    return this.state.money >= cost;
  }

  build(x: number, y: number, structure: StructureType, tier: Tier = Tier.T1, isExotic: boolean = false): boolean {
    if (!this.canBuild(x, y, structure, tier)) return false;

    // Exotic fuel requires the secret to be purchased and enabled
    if (isExotic && structure === StructureType.FuelRod) {
      if (!this.state.secrets.purchased[SecretUpgradeType.ExoticFuel] ||
          !this.state.secrets.enabled[SecretUpgradeType.ExoticFuel]) {
        isExotic = false;
      }
    }

    const cost = getStructureCost(structure, tier);
    this.state.money -= cost;

    const cell = this.state.grid[y][x];
    cell.structure = structure;
    cell.tier = tier;
    cell.heat = 0;
    cell.power = 0;
    cell.isExotic = isExotic;

    // Set lifetime for fuel rods
    if (structure === StructureType.FuelRod) {
      const upgradeLevel = this.state.upgrades.levels[UpgradeType.FuelLifetime];
      cell.lifetime = getFuelLifetime(tier, upgradeLevel);
    } else {
      cell.lifetime = 0;
    }

    this.state.stats.structuresBuilt++;

    this.emitEvent({
      type: 'structure_built',
      x,
      y,
      structure,
      tier,
    });

    // Check for secret unlocks
    this.checkSecretUnlocks();

    return true;
  }

  demolish(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || cell.structure === StructureType.Empty) return false;

    const oldStructure = this.state.grid[y][x].structure;
    const oldTier = this.state.grid[y][x].tier;

    // Refund if salvage is unlocked
    if (this.state.secrets.purchased[SecretUpgradeType.Salvage]) {
      const refund = Math.floor(getStructureCost(oldStructure, oldTier) * 0.5);
      this.state.money += refund;
    }

    // Reset cell
    this.state.grid[y][x] = this.createEmptyCell(x, y);
    this.state.stats.demolishCount++;

    this.emitEvent({
      type: 'structure_destroyed',
      x,
      y,
      structure: oldStructure,
      tier: oldTier,
    });

    // Check for salvage unlock
    this.checkSecretUnlocks();

    return true;
  }

  // ==========================================================================
  // UPGRADES
  // ==========================================================================

  getUpgradeCost(type: UpgradeType): number {
    const currentLevel = this.state.upgrades.levels[type];
    return getUpgradeCost(type, currentLevel);
  }

  canPurchaseUpgrade(type: UpgradeType): boolean {
    const definition = UPGRADE_DEFINITIONS[type];
    const currentLevel = this.state.upgrades.levels[type];

    // Check max level
    if (definition.maxLevel > 0 && currentLevel >= definition.maxLevel) {
      return false;
    }

    const cost = getUpgradeCost(type, currentLevel);
    return this.state.money >= cost;
  }

  purchaseUpgrade(type: UpgradeType): boolean {
    if (!this.canPurchaseUpgrade(type)) return false;

    const cost = getUpgradeCost(type, this.state.upgrades.levels[type]);
    this.state.money -= cost;
    this.state.upgrades.levels[type]++;

    this.emitEvent({ type: 'upgrade_purchased', upgradeType: type });
    return true;
  }

  // ==========================================================================
  // SECRET UPGRADES
  // ==========================================================================

  getSecretCost(type: SecretUpgradeType): number {
    return SECRET_UPGRADE_DEFINITIONS[type].cost;
  }

  canPurchaseSecret(type: SecretUpgradeType): boolean {
    if (!this.state.secrets.unlocked[type]) return false;
    if (this.state.secrets.purchased[type]) return false;

    const cost = SECRET_UPGRADE_DEFINITIONS[type].cost;
    return this.state.money >= cost;
  }

  purchaseSecret(type: SecretUpgradeType): boolean {
    if (!this.canPurchaseSecret(type)) return false;

    const cost = SECRET_UPGRADE_DEFINITIONS[type].cost;
    this.state.money -= cost;
    this.state.secrets.purchased[type] = true;

    // Auto-enable toggleable secrets
    if (SECRET_UPGRADE_DEFINITIONS[type].isToggle) {
      this.state.secrets.enabled[type] = true;
    }

    // Handle reactor expansion
    if (type === SecretUpgradeType.ReactorExpansion1) {
      this.expandGrid(17);
    } else if (type === SecretUpgradeType.ReactorExpansion2) {
      this.expandGrid(18);
    } else if (type === SecretUpgradeType.ReactorExpansion3) {
      this.expandGrid(19);
    } else if (type === SecretUpgradeType.ReactorExpansion4) {
      this.expandGrid(20);
    }

    this.emitEvent({ type: 'secret_purchased', secretType: type });
    return true;
  }

  toggleSecret(type: SecretUpgradeType, enabled: boolean): void {
    if (!this.state.secrets.purchased[type]) return;
    if (!SECRET_UPGRADE_DEFINITIONS[type].isToggle) return;

    this.state.secrets.enabled[type] = enabled;
  }

  private expandGrid(newSize: number): void {
    if (newSize <= this.state.gridSize) return;
    if (newSize > CORE_SETTINGS.MAX_GRID_SIZE) return;

    const oldGrid = this.state.grid;
    const oldSize = this.state.gridSize;

    // Create new larger grid
    this.state.grid = this.createEmptyGrid(newSize);
    this.state.gridSize = newSize;

    // Copy old grid data
    for (let y = 0; y < oldSize; y++) {
      for (let x = 0; x < oldSize; x++) {
        this.state.grid[y][x] = { ...oldGrid[y][x] };
      }
    }

    this.emitEvent({ type: 'grid_expanded', newGridSize: newSize });
  }

  private checkSecretUnlocks(): void {
    const stats = {
      meltdownCount: this.state.stats.meltdownCount,
      filledCells: this.getFilledCellCount(),
      totalMoneyEarned: this.state.stats.totalMoneyEarned,
      demolishCount: this.state.stats.demolishCount,
      ticksAtHighHeat: this.state.stats.ticksAtHighHeat,
    };

    for (const type of Object.values(SecretUpgradeType)) {
      if (this.state.secrets.unlocked[type]) continue;

      const progress = getSecretUnlockProgress(type, stats);
      if (progress.unlocked) {
        this.state.secrets.unlocked[type] = true;
        this.emitEvent({ type: 'secret_unlocked', secretType: type });
      }
    }
  }

  // ==========================================================================
  // NEIGHBORS
  // ==========================================================================

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
      if (nx >= 0 && nx < this.state.gridSize && ny >= 0 && ny < this.state.gridSize) {
        neighbors.push(this.state.grid[ny][nx]);
      }
    }

    return neighbors;
  }

  private countAdjacentFuelRods(x: number, y: number): number {
    const neighbors = this.getNeighbors(x, y);
    return neighbors.filter(n => n.structure === StructureType.FuelRod && n.lifetime > 0).length;
  }

  // ==========================================================================
  // EFFECTIVE STATS (with upgrades)
  // ==========================================================================

  private getEffectiveMeltTemp(structure: StructureType): number {
    const baseTemp = STRUCTURE_BASE_STATS[structure].meltTemp;

    // Get the appropriate melt temp upgrade
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
      const level = this.state.upgrades.levels[upgradeType];
      const definition = UPGRADE_DEFINITIONS[upgradeType];
      return baseTemp + (level * definition.improvementPerLevel);
    }

    return baseTemp;
  }

  private getEffectiveConductivity(cell: Cell): number {
    const baseConductivity = STRUCTURE_BASE_STATS[cell.structure].conductivity;

    if (cell.structure === StructureType.Turbine) {
      const level = this.state.upgrades.levels[UpgradeType.TurbineConductivity];
      const definition = UPGRADE_DEFINITIONS[UpgradeType.TurbineConductivity];
      return baseConductivity + (level * definition.improvementPerLevel);
    }

    if (cell.structure === StructureType.Insulator) {
      const level = this.state.upgrades.levels[UpgradeType.InsulatorConductivity];
      if (level > 0) {
        // Multiplicative reduction
        return baseConductivity * Math.pow(0.5, level);
      }
    }

    return baseConductivity;
  }

  private getEffectiveHeatDissipation(cell: Cell): number {
    if (cell.structure !== StructureType.Ventilator && cell.structure !== StructureType.VoidCell) {
      return 0;
    }

    const baseStats = STRUCTURE_BASE_STATS[cell.structure];
    let dissipation = baseStats.heatDissipation;

    // Scale with tier for ventilators
    if (cell.structure === StructureType.Ventilator) {
      dissipation *= Math.pow(10, cell.tier - 1);

      // Add upgrade bonus
      const level = this.state.upgrades.levels[UpgradeType.VentilatorDissipation];
      const definition = UPGRADE_DEFINITIONS[UpgradeType.VentilatorDissipation];
      dissipation += level * definition.improvementPerLevel;
    }

    return dissipation;
  }

  private getEffectivePowerSaleRate(cell: Cell): number {
    if (cell.structure !== StructureType.Substation) return 0;

    const baseStats = STRUCTURE_BASE_STATS[cell.structure];
    let saleRate = baseStats.powerSaleRate;

    // Scale with tier
    saleRate *= Math.pow(10, cell.tier - 1);

    // Add upgrade bonus
    const level = this.state.upgrades.levels[UpgradeType.SubstationSaleRate];
    const definition = UPGRADE_DEFINITIONS[UpgradeType.SubstationSaleRate];
    saleRate += level * definition.improvementPerLevel;

    return saleRate;
  }

  // ==========================================================================
  // GAME TICK
  // ==========================================================================

  tick(): void {
    this.state.stats.tickCount++;

    // Phase 1: Heat generation (fuel rods with adjacency bonus)
    this.processHeatGeneration();

    // Phase 2: Fuel depletion
    this.processFuelDepletion();

    // Phase 3: Heat transfer between cells
    this.processHeatTransfer();

    // Phase 4: Heat dissipation (ventilators)
    this.processHeatDissipation();

    // Phase 5: Power generation (turbines)
    this.processPowerGeneration();

    // Phase 6: Power collection and sale (substations)
    this.processPowerSale();

    // Phase 7: Check for overheating and meltdowns
    this.processOverheating();

    // Phase 8: Track high heat survival
    this.trackHighHeatSurvival();

    // Phase 9: Check secret unlocks
    this.checkSecretUnlocks();
  }

  private processHeatGeneration(): void {
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];

        if (cell.structure !== StructureType.FuelRod) continue;
        if (cell.lifetime <= 0) continue; // Depleted fuel generates no heat

        // Get base heat generation for this tier
        const upgradeLevel = this.state.upgrades.levels[UpgradeType.FuelHeatOutput];
        let heatGeneration = getFuelHeatGeneration(cell.tier, upgradeLevel);

        // Adjacency bonus (4-way orthogonal)
        const adjacentFuelRods = this.countAdjacentFuelRods(x, y);
        const adjacencyMultiplier = 1 + (adjacentFuelRods * FUEL_ADJACENCY.BONUS_PER_ADJACENT);
        heatGeneration *= adjacencyMultiplier;

        // Exotic fuel: heat scales with current temperature
        if (cell.isExotic) {
          const tempMultiplier = Math.min(
            EXOTIC_FUEL.MAX_MULTIPLIER,
            EXOTIC_FUEL.BASE_MULTIPLIER + (cell.heat / 1000) * EXOTIC_FUEL.HEAT_SCALING
          );
          heatGeneration *= tempMultiplier;
        }

        cell.heat += heatGeneration;
      }
    }
  }

  private processFuelDepletion(): void {
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];

        if (cell.structure !== StructureType.FuelRod) continue;
        if (cell.lifetime <= 0) continue;

        cell.lifetime--;

        if (cell.lifetime <= 0) {
          this.state.stats.fuelRodsDepleted++;
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

  private processHeatTransfer(): void {
    const heatDeltas: number[][] = [];
    for (let y = 0; y < this.state.gridSize; y++) {
      heatDeltas.push(new Array(this.state.gridSize).fill(0));
    }

    const transferRate = CORE_SETTINGS.BASE_HEAT_TRANSFER_RATE;

    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];
        const cellConductivity = this.getEffectiveConductivity(cell);
        const neighbors = this.getNeighbors(x, y);

        for (const neighbor of neighbors) {
          const neighborConductivity = this.getEffectiveConductivity(neighbor);
          const heatDiff = cell.heat - neighbor.heat;

          // Heat flows from hot to cold
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
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        this.state.grid[y][x].heat = Math.max(0, this.state.grid[y][x].heat + heatDeltas[y][x]);
      }
    }
  }

  private processHeatDissipation(): void {
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];
        const dissipation = this.getEffectiveHeatDissipation(cell);
        cell.heat = Math.max(0, cell.heat - dissipation);
      }
    }
  }

  private processPowerGeneration(): void {
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];
        if (cell.structure !== StructureType.Turbine) continue;
        if (cell.heat <= 0) continue;

        const baseStats = STRUCTURE_BASE_STATS[StructureType.Turbine];
        const maxHeatConsumption = baseStats.maxHeatConsumption * Math.pow(10, cell.tier - 1);
        const powerGeneration = baseStats.powerGeneration;

        const heatConsumed = Math.min(cell.heat, maxHeatConsumption);
        const powerGenerated = heatConsumed * powerGeneration;

        cell.heat -= heatConsumed;
        cell.power += powerGenerated;
        this.state.stats.totalPowerGenerated += powerGenerated;
      }
    }
  }

  private processPowerSale(): void {
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
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

        // Substations sell power
        if (cell.structure === StructureType.Substation && cell.power > 0) {
          const saleRate = this.getEffectivePowerSaleRate(cell);
          const powerToSell = Math.min(cell.power, saleRate);
          const earnings = powerToSell * ECONOMY.MONEY_PER_POWER;

          this.state.money += earnings;
          this.state.stats.totalMoneyEarned += earnings;
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
  }

  private processOverheating(): void {
    let meltdown = false;
    const meltedCells: { x: number; y: number; structure: StructureType; tier: Tier }[] = [];

    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];
        if (cell.structure === StructureType.Empty) continue;

        const meltTemp = this.getEffectiveMeltTemp(cell.structure);
        if (cell.heat > meltTemp) {
          if (cell.structure === StructureType.FuelRod) {
            // Fuel rod meltdown - catastrophic failure
            meltdown = true;
          } else {
            // Regular structure melts
            meltedCells.push({ x, y, structure: cell.structure, tier: cell.tier });
          }
        }
      }
    }

    // Melt non-fuel structures
    for (const { x, y, structure, tier } of meltedCells) {
      this.state.grid[y][x] = this.createEmptyCell(x, y);
      this.emitEvent({
        type: 'structure_melted',
        x,
        y,
        structure,
        tier,
      });
    }

    if (meltdown) {
      this.triggerMeltdown();
    }
  }

  private triggerMeltdown(): void {
    this.state.stats.meltdownCount++;

    // Destroy all structures but keep money
    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        this.state.grid[y][x] = this.createEmptyCell(x, y);
      }
    }

    this.emitEvent({ type: 'meltdown' });

    // Check for exotic fuel unlock
    this.checkSecretUnlocks();
  }

  private trackHighHeatSurvival(): void {
    // Check if any fuel rod is at >90% of its melt temp
    let hasHighHeatFuelRod = false;

    for (let y = 0; y < this.state.gridSize; y++) {
      for (let x = 0; x < this.state.gridSize; x++) {
        const cell = this.state.grid[y][x];
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
      this.state.stats.ticksAtHighHeat++;
    }
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  serialize(): string {
    return JSON.stringify(this.state);
  }

  static deserialize(data: string): HeatGame {
    const state = JSON.parse(data) as GameState;
    const game = new HeatGame(0);
    game.state = state;
    return game;
  }

  // ==========================================================================
  // BACKWARD COMPATIBILITY (for tests)
  // ==========================================================================

  /** @deprecated Use getGridSize() instead */
  get GRID_SIZE(): number {
    return this.state.gridSize;
  }
}

// Re-export GRID_SIZE for backward compatibility
export { CORE_SETTINGS };
export const GRID_SIZE = CORE_SETTINGS.INITIAL_GRID_SIZE;
