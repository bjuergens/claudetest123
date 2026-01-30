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

  /** Upgrade cost multiplier per level */
  UPGRADE_COST_MULTIPLIER: 2.0,

  /** Base cost for first upgrade */
  UPGRADE_BASE_COST: 50,

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

/** Cost multiplier per tier (T1 = 1x, T2 = 100x, T3 = 10000x, etc.) */
export const TIER_COST_MULTIPLIER: Record<Tier, number> = {
  [Tier.T1]: 1,
  [Tier.T2]: 100,
  [Tier.T3]: 10_000,
  [Tier.T4]: 1_000_000,
};

/** Efficiency multiplier per tier (T1 = 1x, T2 = 10x, T3 = 100x, etc.) */
export const TIER_EFFICIENCY_MULTIPLIER: Record<Tier, number> = {
  [Tier.T1]: 1,
  [Tier.T2]: 10,
  [Tier.T3]: 100,
  [Tier.T4]: 1000,
};

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
 * - Insulator: 300°C (designed to handle heat)
 * - Heat Exchanger: 400°C (built for heat transfer)
 * - Fuel Rod: 5000°C (extremely heat resistant)
 *
 * Conductivity:
 * - Fuel Rod: 1.5 (high - heat spreads from fuel)
 * - Heat Exchanger: 2.0 (very high - designed for transfer)
 * - Turbine, Ventilator, Substation: 1.0 (normal)
 * - Empty: 0.3 (low - air gap)
 * - Insulator: 0.05 (very low - designed to block)
 */
export const STRUCTURE_BASE_STATS: Record<StructureType, StructureBaseStats> = {
  [StructureType.Empty]: {
    name: 'Empty',
    baseCost: 0,
    meltTemp: Infinity,
    conductivity: 0.3,
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
    meltTemp: 5000,
    conductivity: 1.5,
    heatGeneration: 10, // T1: 10 heat/tick, T2: 100 heat/tick, etc.
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
    conductivity: 1.0,
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
    conductivity: 2.0,
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
    meltTemp: 300,
    conductivity: 0.05,
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
    conductivity: 1.0,
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
    conductivity: 1.0,
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
    conductivity: 10.0, // Extremely high - sucks in heat
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
  BONUS_PER_ADJACENT: 0.5, // 1 adjacent = 1.5x, 2 = 2x, 3 = 2.5x, 4 = 3x
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
    improvementPerLevel: 0.2, // +0.2 conductivity per level
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
};

// =============================================================================
// SECRET UNLOCK CONDITIONS
// =============================================================================

export interface SecretUnlockCondition {
  type: 'meltdown' | 'fill_grid' | 'survive_heat' | 'total_earned' | 'demolish_count';
  /** Threshold value for the condition */
  threshold: number;
  /** For survive_heat: percentage of max temp (0.9 = 90%) */
  heatPercentage?: number;
  /** For survive_heat: number of ticks to survive */
  survivalTicks?: number;
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
    threshold: 100, // 100 ticks
    heatPercentage: 0.9, // 90% of max heat
    survivalTicks: 100,
  },

  [SecretUpgradeType.Overclock]: {
    type: 'total_earned',
    threshold: 10_000, // 10,000 total money earned
  },

  [SecretUpgradeType.Salvage]: {
    type: 'demolish_count',
    threshold: 100, // Demolish 100 structures
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
  }

  return {
    current,
    required: condition.threshold,
    unlocked: current >= condition.threshold,
  };
}
