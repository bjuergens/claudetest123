/**
 * Game Balance Configuration
 *
 * All balancing values in one place for easy tuning.
 *
 * DESIGN PHILOSOPHY:
 * - Each tier is ~100x more expensive than the previous
 * - Each tier is ~10x more efficient than the previous
 * - Fuel rods have finite lifetime (other items last until melted/sold)
 * - Upgrades: linear improvement, exponential cost
 * - Secret upgrades are hidden until unlock conditions are met
 */

// =============================================================================
// CORE GAME SETTINGS
// =============================================================================

export const CORE_SETTINGS = {
  /** Starting money (player starts from zero) */
  STARTING_MONEY: 0,

  /** Tick interval in milliseconds (1 tick per second) */
  TICK_INTERVAL_MS: 1000,

  /** Initial grid size */
  INITIAL_GRID_SIZE: 16,

  /** Maximum grid size (after all expansions) */
  MAX_GRID_SIZE: 20,

  /** Base heat transfer rate between cells */
  BASE_HEAT_TRANSFER_RATE: 0.1,

  /** Heat transfer rate to environment (edge cells) */
  ENVIRONMENT_HEAT_TRANSFER_RATE: 0.05,

  /** Ambient temperature in Celsius */
  AMBIENT_TEMPERATURE: 20,
};

// =============================================================================
// MANUAL POWER GENERATION (Clicker)
// =============================================================================

export const MANUAL_GENERATION = {
  /** Base money per click */
  BASE_MONEY_PER_CLICK: 1,

  /** Money increase per upgrade level (additive) */
  MONEY_PER_LEVEL: 1,
};

// =============================================================================
// TIER DEFINITIONS
// =============================================================================

export enum Tier {
  T1 = 1,
  T2 = 2,
  T3 = 3,
  T4 = 4,
}

// =============================================================================
// STRUCTURE BASE STATS (Tier 1)
// =============================================================================

export enum StructureType {
  Empty = 'empty',
  FuelRod = 'fuel_rod',
  Ventilator = 'ventilator',
  HeatExchanger = 'heat_exchanger',
  Insulator = 'insulator',
  Turbine = 'turbine',
  Substation = 'substation',
  VoidCell = 'void_cell', // Secret structure
}

export interface StructureBaseStats {
  /** Display name */
  name: string;

  /** Base cost in T1 (scales with tier) */
  baseCost: number;

  /** Melting temperature in Celsius */
  meltTemp: number;

  /** Heat conductivity multiplier (1.0 = normal) */
  conductivity: number;

  /** Heat generated per tick (fuel rods only) */
  heatGeneration: number;

  /** Heat dissipated per tick (ventilators only) */
  heatDissipation: number;

  /** Power generated per heat unit consumed (turbines only) */
  powerGeneration: number;

  /** Max heat consumed per tick for power (turbines only) */
  maxHeatConsumption: number;

  /** Power sold per tick (substations only) */
  powerSaleRate: number;

  /** Fuel lifetime in ticks (fuel rods only, 0 = infinite) */
  baseLifetime: number;

  /** Whether this structure can be tiered */
  canBeTiered: boolean;

  /** Whether this is a secret structure (hidden until unlocked) */
  isSecret: boolean;
}

/**
 * Base stats for all structures at Tier 1
 *
 * Melt temperatures (in Celsius):
 * - Substation: 80°C (very fragile, needs protection)
 * - Turbine: 150°C (moderate, needs cooling)
 * - Ventilator: 200°C (can handle some heat)
 * - Heat Exchanger: 400°C (built for heat transfer)
 * - Fuel Rod: 1000°C (can overheat with clustered fuel)
 * - Insulator: 1000°C (heat resistant, designed to contain fuel)
 *
 * Heat Exchange Factor (conductivity):
 * The rate controls how fast heat flows between adjacent cells.
 * Rate of 1.0 = cells fully equalize temperature in one tick (per neighbor pair)
 * Rate of 0.5 = cells move halfway toward equalization (per neighbor pair)
 * Rate of 0.0 = no heat exchange
 * The effective rate between two cells is the average of their factors.
 *
 * Note: Since each cell has up to 4 neighbors, total heat flow per tick is
 * the sum of all pairwise exchanges. Values are calibrated to produce similar
 * heat spread rates as the original algorithm.
 *
 * - Void Cell: 1.0 (maximum - pulls heat extremely fast)
 * - Heat Exchanger: 0.4 (very fast transfer)
 * - Fuel Rod: 0.3 (fast - heat spreads from fuel)
 * - Turbine, Ventilator, Substation: 0.2 (normal)
 * - Empty: 0.06 (slow - air gap)
 * - Insulator: 0.005 (extremely slow - designed to block heat)
 */
export const STRUCTURE_BASE_STATS: Record<StructureType, StructureBaseStats> = {
  [StructureType.Empty]: {
    name: 'Empty',
    baseCost: 0,
    meltTemp: Infinity,
    conductivity: 0.06,
    heatGeneration: 0,
    heatDissipation: 0,
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: false,
    isSecret: false,
  },

  [StructureType.FuelRod]: {
    name: 'Fuel Rod',
    baseCost: 10,
    meltTemp: 1000, // Lowered to make meltdowns achievable with new heat exchange algorithm
    conductivity: 0.3,
    heatGeneration: 100, // T1: 100 heat/tick - high enough to cause meltdowns when clustered
    heatDissipation: 0,
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 20, // T1: 20 ticks, T2: 200 ticks (linear scaling)
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.Ventilator]: {
    name: 'Ventilator',
    baseCost: 10,
    meltTemp: 200,
    conductivity: 0.2,
    heatGeneration: 0,
    heatDissipation: 5, // T1: 5 heat/tick removed
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.HeatExchanger]: {
    name: 'Heat Exchanger',
    baseCost: 15,
    meltTemp: 400,
    conductivity: 0.4,
    heatGeneration: 0,
    heatDissipation: 0,
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.Insulator]: {
    name: 'Insulator',
    baseCost: 8,
    meltTemp: 1000,
    conductivity: 0.005,
    heatGeneration: 0,
    heatDissipation: 0,
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.Turbine]: {
    name: 'Turbine',
    baseCost: 25, // T1: 25, T2: 2500 (close to user's 250 for T2 if we adjust)
    meltTemp: 150,
    conductivity: 0.2,
    heatGeneration: 0,
    heatDissipation: 0,
    powerGeneration: 0.1, // Power per heat consumed
    maxHeatConsumption: 10, // Max heat consumed per tick
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.Substation]: {
    name: 'Substation',
    baseCost: 50, // T1: 50, T2: 5000 (close to user's 500 for T2 if we adjust)
    meltTemp: 80,
    conductivity: 0.2,
    heatGeneration: 0,
    heatDissipation: 0,
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 1, // Power units sold per tick (converted to money)
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: false,
  },

  [StructureType.VoidCell]: {
    name: 'Void Cell',
    baseCost: 100,
    meltTemp: Infinity, // Cannot melt
    conductivity: 1.0, // Maximum - pulls heat extremely fast
    heatGeneration: 0,
    heatDissipation: 50, // Destroys heat
    powerGeneration: 0,
    maxHeatConsumption: 0,
    powerSaleRate: 0,
    baseLifetime: 0,
    canBeTiered: true,
    isSecret: true, // Unlocked via secret
  },
};

// =============================================================================
// FUEL ROD ADJACENCY BONUS
// =============================================================================

export const FUEL_ADJACENCY = {
  /** Heat multiplier per adjacent fuel rod (4-way orthogonal) */
  BONUS_PER_ADJACENT: 1.0, // 1 adjacent = 2x, 2 = 3x, 3 = 4x, 4 = 5x (500%)
};

// =============================================================================
// ECONOMY
// =============================================================================

export const ECONOMY = {
  /** Money earned per power unit sold */
  MONEY_PER_POWER: 1,

  /** Refund percentage when demolishing (0 = no refund, 1 = full refund) */
  DEMOLISH_REFUND_RATE: 0, // Default: no refund (can be unlocked)
};

// =============================================================================
// UPGRADES (Regular)
// =============================================================================

export enum UpgradeType {
  // Per-tier fuel upgrades
  FuelLifetime = 'fuel_lifetime',
  FuelHeatOutput = 'fuel_heat_output',

  // Structure upgrades
  TurbineConductivity = 'turbine_conductivity',
  InsulatorConductivity = 'insulator_conductivity',
  SubstationSaleRate = 'substation_sale_rate',
  VentilatorDissipation = 'ventilator_dissipation',

  // Global upgrades
  TickSpeed = 'tick_speed',
  ManualClickPower = 'manual_click_power',

  // Melt temperature upgrades (one per structure type)
  MeltTempFuelRod = 'melt_temp_fuel_rod',
  MeltTempVentilator = 'melt_temp_ventilator',
  MeltTempHeatExchanger = 'melt_temp_heat_exchanger',
  MeltTempInsulator = 'melt_temp_insulator',
  MeltTempTurbine = 'melt_temp_turbine',
  MeltTempSubstation = 'melt_temp_substation',
}

export interface UpgradeDefinition {
  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Base cost for level 1 */
  baseCost: number;

  /** Cost multiplier per level (exponential) */
  costMultiplier: number;

  /** Maximum level (0 = unlimited) */
  maxLevel: number;

  /** Improvement per level (linear, additive or multiplicative depends on type) */
  improvementPerLevel: number;

  /** Whether improvement is multiplicative (true) or additive (false) */
  isMultiplicative: boolean;

  /** For per-tier upgrades, which tier this applies to (null = all) */
  appliesTo?: Tier;
}

export const UPGRADE_DEFINITIONS: Record<UpgradeType, UpgradeDefinition> = {
  [UpgradeType.FuelLifetime]: {
    name: 'Fuel Longevity',
    description: 'Fuel rods last longer before depleting',
    baseCost: 100,
    costMultiplier: 2.5,
    maxLevel: 0,
    improvementPerLevel: 10, // +10 ticks per level
    isMultiplicative: false,
  },

  [UpgradeType.FuelHeatOutput]: {
    name: 'Enriched Fuel',
    description: 'Fuel rods generate more heat per tick',
    baseCost: 150,
    costMultiplier: 2.5,
    maxLevel: 0,
    improvementPerLevel: 5, // +5 heat per level
    isMultiplicative: false,
  },

  [UpgradeType.TurbineConductivity]: {
    name: 'Turbine Efficiency',
    description: 'Turbines transfer heat more effectively',
    baseCost: 200,
    costMultiplier: 2.0,
    maxLevel: 10,
    improvementPerLevel: 0.03, // +0.03 heat exchange per level (0.15 base + 0.3 max = 0.45)
    isMultiplicative: false,
  },

  [UpgradeType.InsulatorConductivity]: {
    name: 'Advanced Insulation',
    description: 'Insulators block even more heat',
    baseCost: 150,
    costMultiplier: 2.0,
    maxLevel: 10,
    improvementPerLevel: 0.5, // 0.5x multiplier per level (gets lower)
    isMultiplicative: true,
  },

  [UpgradeType.SubstationSaleRate]: {
    name: 'Power Grid Upgrade',
    description: 'Substations sell more power per tick',
    baseCost: 500,
    costMultiplier: 3.0,
    maxLevel: 0,
    improvementPerLevel: 1, // +1 power/tick per level
    isMultiplicative: false,
  },

  [UpgradeType.VentilatorDissipation]: {
    name: 'Improved Cooling',
    description: 'Ventilators remove more heat per tick',
    baseCost: 100,
    costMultiplier: 2.0,
    maxLevel: 0,
    improvementPerLevel: 2, // +2 heat dissipation per level
    isMultiplicative: false,
  },

  [UpgradeType.TickSpeed]: {
    name: 'Overclock',
    description: 'Game runs faster (careful: heat accumulates faster too!)',
    baseCost: 1000,
    costMultiplier: 5.0,
    maxLevel: 5,
    improvementPerLevel: 0.8, // 0.8x tick interval per level (faster)
    isMultiplicative: true,
  },

  [UpgradeType.ManualClickPower]: {
    name: 'Bigger Buttons',
    description: 'Manual generation gives more money per click',
    baseCost: 50,
    costMultiplier: 2.0,
    maxLevel: 0,
    improvementPerLevel: 1, // +1 per click per level
    isMultiplicative: false,
  },

  // Melt temperature upgrades
  [UpgradeType.MeltTempFuelRod]: {
    name: 'Reinforced Fuel Casing',
    description: 'Fuel rods can withstand higher temperatures',
    baseCost: 500,
    costMultiplier: 3.0,
    maxLevel: 10,
    improvementPerLevel: 500, // +500°C per level
    isMultiplicative: false,
  },

  [UpgradeType.MeltTempVentilator]: {
    name: 'Heat-Resistant Fans',
    description: 'Ventilators can withstand higher temperatures',
    baseCost: 100,
    costMultiplier: 2.5,
    maxLevel: 10,
    improvementPerLevel: 20, // +20°C per level
    isMultiplicative: false,
  },

  [UpgradeType.MeltTempHeatExchanger]: {
    name: 'Hardened Exchangers',
    description: 'Heat exchangers can withstand higher temperatures',
    baseCost: 150,
    costMultiplier: 2.5,
    maxLevel: 10,
    improvementPerLevel: 40, // +40°C per level
    isMultiplicative: false,
  },

  [UpgradeType.MeltTempInsulator]: {
    name: 'Advanced Ceramics',
    description: 'Insulators can withstand higher temperatures',
    baseCost: 120,
    costMultiplier: 2.5,
    maxLevel: 10,
    improvementPerLevel: 30, // +30°C per level
    isMultiplicative: false,
  },

  [UpgradeType.MeltTempTurbine]: {
    name: 'Reinforced Turbines',
    description: 'Turbines can withstand higher temperatures',
    baseCost: 200,
    costMultiplier: 2.5,
    maxLevel: 10,
    improvementPerLevel: 15, // +15°C per level
    isMultiplicative: false,
  },

  [UpgradeType.MeltTempSubstation]: {
    name: 'Industrial Substations',
    description: 'Substations can withstand higher temperatures',
    baseCost: 300,
    costMultiplier: 3.0,
    maxLevel: 10,
    improvementPerLevel: 10, // +10°C per level (they're fragile!)
    isMultiplicative: false,
  },
};

// =============================================================================
// SECRET UPGRADES
// =============================================================================

export enum SecretUpgradeType {
  ExoticFuel = 'exotic_fuel',
  ReactorExpansion1 = 'reactor_expansion_1', // 16 -> 17
  ReactorExpansion2 = 'reactor_expansion_2', // 17 -> 18
  ReactorExpansion3 = 'reactor_expansion_3', // 18 -> 19
  ReactorExpansion4 = 'reactor_expansion_4', // 19 -> 20
  VoidCellUnlock = 'void_cell_unlock',
  Overclock = 'overclock',
  Salvage = 'salvage',
  FuelMeltTempBonus = 'fuel_melt_temp_bonus', // Unlocked by keeping fuel rods under 200°C
  CoolRunning = 'cool_running', // Unlocked by keeping fuel rods under 100°C
}

export interface SecretUpgradeDefinition {
  /** Display name (shown after unlock) */
  name: string;

  /** Description (shown after unlock) */
  description: string;

  /** Hint shown before unlock (cryptic) */
  hint: string;

  /** Cost to purchase after unlock condition is met */
  cost: number;

  /** Whether this is a toggle (can be turned on/off) */
  isToggle: boolean;
}

export const SECRET_UPGRADE_DEFINITIONS: Record<SecretUpgradeType, SecretUpgradeDefinition> = {
  [SecretUpgradeType.ExoticFuel]: {
    name: 'Exotic Fuel Synthesis',
    description: 'Unlock exotic fuel rods that generate more heat the hotter they get. Toggle to build exotic variants.',
    hint: '???',
    cost: 1000,
    isToggle: true,
  },

  [SecretUpgradeType.ReactorExpansion1]: {
    name: 'Reactor Expansion I',
    description: 'Expand the reactor grid to 17x17',
    hint: '???',
    cost: 10_000,
    isToggle: false,
  },

  [SecretUpgradeType.ReactorExpansion2]: {
    name: 'Reactor Expansion II',
    description: 'Expand the reactor grid to 18x18',
    hint: '???',
    cost: 100_000,
    isToggle: false,
  },

  [SecretUpgradeType.ReactorExpansion3]: {
    name: 'Reactor Expansion III',
    description: 'Expand the reactor grid to 19x19',
    hint: '???',
    cost: 1_000_000,
    isToggle: false,
  },

  [SecretUpgradeType.ReactorExpansion4]: {
    name: 'Reactor Expansion IV',
    description: 'Expand the reactor grid to 20x20 (maximum)',
    hint: '???',
    cost: 10_000_000,
    isToggle: false,
  },

  [SecretUpgradeType.VoidCellUnlock]: {
    name: 'Void Technology',
    description: 'Unlock Void Cells - mysterious structures that absorb massive amounts of heat',
    hint: '???',
    cost: 5000,
    isToggle: false,
  },

  [SecretUpgradeType.Overclock]: {
    name: 'Temporal Acceleration',
    description: 'Unlock 2x tick speed upgrade',
    hint: '???',
    cost: 10_000,
    isToggle: false,
  },

  [SecretUpgradeType.Salvage]: {
    name: 'Salvage Operations',
    description: 'Get 50% refund when demolishing structures',
    hint: '???',
    cost: 2000,
    isToggle: false,
  },

  [SecretUpgradeType.FuelMeltTempBonus]: {
    name: 'Cryogenic Fuel Casing',
    description: 'Increases fuel rod melting temperature by 500°C. Achieved through careful temperature management.',
    hint: '???',
    cost: 3000,
    isToggle: false,
  },

  [SecretUpgradeType.CoolRunning]: {
    name: 'Superconductor Technology',
    description: 'Increases fuel rod melting temperature by 1000°C. Mastery of sub-100°C fuel operation.',
    hint: '???',
    cost: 10000,
    isToggle: false,
  },
};

// =============================================================================
// SECRET UNLOCK CONDITIONS
// =============================================================================

export interface SecretUnlockCondition {
  type: 'meltdown' | 'fill_grid' | 'survive_heat' | 'total_earned' | 'demolish_count' | 'fuel_depleted_cool' | 'fuel_depleted_ice';
  /** Threshold value for the condition */
  threshold: number;
  /** For survive_heat: percentage of max temp (0.9 = 90%) */
  heatPercentage?: number;
}

export const SECRET_UNLOCK_CONDITIONS: Record<SecretUpgradeType, SecretUnlockCondition> = {
  [SecretUpgradeType.ExoticFuel]: {
    type: 'meltdown',
    threshold: 1, // First meltdown
  },

  [SecretUpgradeType.ReactorExpansion1]: {
    type: 'fill_grid',
    threshold: 256, // All 16x16 cells filled
  },

  [SecretUpgradeType.ReactorExpansion2]: {
    type: 'fill_grid',
    threshold: 289, // All 17x17 cells filled
  },

  [SecretUpgradeType.ReactorExpansion3]: {
    type: 'fill_grid',
    threshold: 324, // All 18x18 cells filled
  },

  [SecretUpgradeType.ReactorExpansion4]: {
    type: 'fill_grid',
    threshold: 361, // All 19x19 cells filled
  },

  [SecretUpgradeType.VoidCellUnlock]: {
    type: 'survive_heat',
    threshold: 100, // 100 ticks at 90% max heat
    heatPercentage: 0.9,
  },

  [SecretUpgradeType.Overclock]: {
    type: 'total_earned',
    threshold: 10_000, // 10,000 total money earned
  },

  [SecretUpgradeType.Salvage]: {
    type: 'demolish_count',
    threshold: 100, // Demolish 100 structures
  },

  [SecretUpgradeType.FuelMeltTempBonus]: {
    type: 'fuel_depleted_cool',
    threshold: 10, // Deplete 10 fuel rods that never exceeded 200°C
  },

  [SecretUpgradeType.CoolRunning]: {
    type: 'fuel_depleted_ice',
    threshold: 10, // Deplete 10 fuel rods that never exceeded 100°C
  },
};

// =============================================================================
// EXOTIC FUEL MECHANICS
// =============================================================================

export const EXOTIC_FUEL = {
  /** Base heat multiplier at 0°C */
  BASE_MULTIPLIER: 1.0,

  /** Additional multiplier per 1000°C of current temperature */
  HEAT_SCALING: 0.5, // At 2000°C: 1.0 + (2000/1000 * 0.5) = 2.0x heat output

  /** Maximum multiplier cap */
  MAX_MULTIPLIER: 5.0,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate the cost of a structure at a given tier
 */
export function getStructureCost(type: StructureType, tier: Tier): number {
  const baseStats = STRUCTURE_BASE_STATS[type];
  // Adjust tier multiplier to match user's specified costs more closely
  // User said T2 fuel rod = 100, turbine = 250, substation = 500
  // With base costs of 10, 25, 50 and T2 multiplier of 10, we get 100, 250, 500
  const tierMultiplier = Math.pow(10, tier - 1);
  return Math.round(baseStats.baseCost * tierMultiplier);
}

/**
 * Calculate fuel rod lifetime at a given tier (with upgrades)
 */
export function getFuelLifetime(tier: Tier, upgradeLevel: number): number {
  const baseStats = STRUCTURE_BASE_STATS[StructureType.FuelRod];
  // Lifetime scales linearly with tier: T1=20, T2=200, T3=2000
  const tierLifetime = baseStats.baseLifetime * Math.pow(10, tier - 1);
  const upgradeBonus = upgradeLevel * UPGRADE_DEFINITIONS[UpgradeType.FuelLifetime].improvementPerLevel;
  return tierLifetime + upgradeBonus;
}

/**
 * Calculate fuel rod heat generation at a given tier (with upgrades)
 */
export function getFuelHeatGeneration(tier: Tier, upgradeLevel: number): number {
  const baseStats = STRUCTURE_BASE_STATS[StructureType.FuelRod];
  // Heat scales exponentially with tier: T1=10, T2=100, T3=1000
  const tierHeat = baseStats.heatGeneration * Math.pow(10, tier - 1);
  const upgradeBonus = upgradeLevel * UPGRADE_DEFINITIONS[UpgradeType.FuelHeatOutput].improvementPerLevel;
  return tierHeat + upgradeBonus;
}

/**
 * Calculate upgrade cost at a given level
 */
export function getUpgradeCost(upgradeType: UpgradeType, level: number): number {
  const definition = UPGRADE_DEFINITIONS[upgradeType];
  return Math.round(definition.baseCost * Math.pow(definition.costMultiplier, level));
}

/**
 * Calculate secret upgrade unlock progress
 */
export function getSecretUnlockProgress(
  upgradeType: SecretUpgradeType,
  gameStats: {
    meltdownCount: number;
    filledCells: number;
    totalMoneyEarned: number;
    demolishCount: number;
    ticksAtHighHeat: number;
    fuelRodsDepletedCool: number;
    fuelRodsDepletedIce: number;
  }
): { current: number; required: number; unlocked: boolean } {
  const condition = SECRET_UNLOCK_CONDITIONS[upgradeType];
  let current = 0;

  switch (condition.type) {
    case 'meltdown':
      current = gameStats.meltdownCount;
      break;
    case 'fill_grid':
      current = gameStats.filledCells;
      break;
    case 'total_earned':
      current = gameStats.totalMoneyEarned;
      break;
    case 'demolish_count':
      current = gameStats.demolishCount;
      break;
    case 'survive_heat':
      current = gameStats.ticksAtHighHeat;
      break;
    case 'fuel_depleted_cool':
      current = gameStats.fuelRodsDepletedCool;
      break;
    case 'fuel_depleted_ice':
      current = gameStats.fuelRodsDepletedIce;
      break;
  }

  return {
    current,
    required: condition.threshold,
    unlocked: current >= condition.threshold,
  };
}
