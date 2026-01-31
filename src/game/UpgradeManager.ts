/**
 * UpgradeManager - Handles regular upgrades and secret upgrades
 *
 * Extracted from HeatGame to reduce cognitive load and enable isolated testing.
 * This class manages upgrade purchasing, secret unlock conditions, and toggle states.
 */

import {
  UpgradeType,
  UPGRADE_DEFINITIONS,
  SecretUpgradeType,
  SECRET_UPGRADE_DEFINITIONS,
  getUpgradeCost,
  getSecretUnlockProgress,
} from './BalanceConfig.js';

export interface UpgradeState {
  levels: Record<UpgradeType, number>;
}

export interface SecretState {
  unlocked: Record<SecretUpgradeType, boolean>;
  purchased: Record<SecretUpgradeType, boolean>;
  enabled: Record<SecretUpgradeType, boolean>;
}

export interface UpgradeEvent {
  type: 'upgrade_purchased' | 'secret_unlocked' | 'secret_purchased';
  upgradeType?: UpgradeType;
  secretType?: SecretUpgradeType;
}

export type UpgradeEventListener = (event: UpgradeEvent) => void;

export interface UnlockStats {
  meltdownCount: number;
  filledCells: number;
  totalMoneyEarned: number;
  demolishCount: number;
  ticksAtHighHeat: number;
}

/**
 * UpgradeManager handles all upgrade-related logic including:
 * - Regular upgrade purchasing and level tracking
 * - Secret upgrade unlocking, purchasing, and toggling
 */
export class UpgradeManager {
  private upgrades: UpgradeState;
  private secrets: SecretState;
  private eventListeners: UpgradeEventListener[] = [];

  constructor() {
    this.upgrades = this.createInitialUpgradeState();
    this.secrets = this.createInitialSecretState();
  }

  private createInitialUpgradeState(): UpgradeState {
    const levels: Record<UpgradeType, number> = {} as Record<UpgradeType, number>;
    for (const type of Object.values(UpgradeType)) {
      levels[type] = 0;
    }
    return { levels };
  }

  private createInitialSecretState(): SecretState {
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

  /**
   * Add an event listener for upgrade events
   */
  addEventListener(listener: UpgradeEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(listener: UpgradeEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private emitEvent(event: UpgradeEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  // ==========================================================================
  // REGULAR UPGRADES
  // ==========================================================================

  /**
   * Get the current level of an upgrade
   */
  getUpgradeLevel(type: UpgradeType): number {
    return this.upgrades.levels[type];
  }

  /**
   * Get the cost for the next level of an upgrade
   */
  getUpgradeCost(type: UpgradeType): number {
    const currentLevel = this.upgrades.levels[type];
    return getUpgradeCost(type, currentLevel);
  }

  /**
   * Check if an upgrade can be purchased
   */
  canPurchaseUpgrade(type: UpgradeType, currentMoney: number): boolean {
    const definition = UPGRADE_DEFINITIONS[type];
    const currentLevel = this.upgrades.levels[type];

    if (definition.maxLevel > 0 && currentLevel >= definition.maxLevel) {
      return false;
    }

    const cost = getUpgradeCost(type, currentLevel);
    return currentMoney >= cost;
  }

  /**
   * Purchase an upgrade
   * Returns the cost if successful, 0 if failed
   */
  purchaseUpgrade(type: UpgradeType, currentMoney: number): number {
    if (!this.canPurchaseUpgrade(type, currentMoney)) return 0;

    const cost = getUpgradeCost(type, this.upgrades.levels[type]);
    this.upgrades.levels[type]++;

    this.emitEvent({ type: 'upgrade_purchased', upgradeType: type });
    return cost;
  }

  // ==========================================================================
  // SECRET UPGRADES
  // ==========================================================================

  /**
   * Check if a secret upgrade is unlocked
   */
  isSecretUnlocked(type: SecretUpgradeType): boolean {
    return this.secrets.unlocked[type];
  }

  /**
   * Check if a secret upgrade has been purchased
   */
  isSecretPurchased(type: SecretUpgradeType): boolean {
    return this.secrets.purchased[type];
  }

  /**
   * Check if a toggleable secret is enabled
   */
  isSecretEnabled(type: SecretUpgradeType): boolean {
    return this.secrets.enabled[type];
  }

  /**
   * Get the cost of a secret upgrade
   */
  getSecretCost(type: SecretUpgradeType): number {
    return SECRET_UPGRADE_DEFINITIONS[type].cost;
  }

  /**
   * Check if a secret can be purchased
   */
  canPurchaseSecret(type: SecretUpgradeType, currentMoney: number): boolean {
    if (!this.secrets.unlocked[type]) return false;
    if (this.secrets.purchased[type]) return false;

    const cost = SECRET_UPGRADE_DEFINITIONS[type].cost;
    return currentMoney >= cost;
  }

  /**
   * Purchase a secret upgrade
   * Returns the cost if successful, 0 if failed
   */
  purchaseSecret(type: SecretUpgradeType, currentMoney: number): number {
    if (!this.canPurchaseSecret(type, currentMoney)) return 0;

    const cost = SECRET_UPGRADE_DEFINITIONS[type].cost;
    this.secrets.purchased[type] = true;

    // Auto-enable toggleable secrets
    if (SECRET_UPGRADE_DEFINITIONS[type].isToggle) {
      this.secrets.enabled[type] = true;
    }

    this.emitEvent({ type: 'secret_purchased', secretType: type });
    return cost;
  }

  /**
   * Toggle a secret upgrade on/off
   */
  toggleSecret(type: SecretUpgradeType, enabled: boolean): void {
    if (!this.secrets.purchased[type]) return;
    if (!SECRET_UPGRADE_DEFINITIONS[type].isToggle) return;

    this.secrets.enabled[type] = enabled;
  }

  /**
   * Check and unlock secrets based on current game stats
   * Returns array of newly unlocked secrets
   */
  checkSecretUnlocks(stats: UnlockStats): SecretUpgradeType[] {
    const newlyUnlocked: SecretUpgradeType[] = [];

    for (const type of Object.values(SecretUpgradeType)) {
      if (this.secrets.unlocked[type]) continue;

      const progress = getSecretUnlockProgress(type, stats);
      if (progress.unlocked) {
        this.secrets.unlocked[type] = true;
        newlyUnlocked.push(type);
        this.emitEvent({ type: 'secret_unlocked', secretType: type });
      }
    }

    return newlyUnlocked;
  }

  /**
   * Get the grid size expansion for a reactor expansion secret
   */
  getExpansionSize(type: SecretUpgradeType): number | null {
    switch (type) {
      case SecretUpgradeType.ReactorExpansion1: return 17;
      case SecretUpgradeType.ReactorExpansion2: return 18;
      case SecretUpgradeType.ReactorExpansion3: return 19;
      case SecretUpgradeType.ReactorExpansion4: return 20;
      default: return null;
    }
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  /**
   * Get the current upgrade state for serialization
   */
  getUpgradeState(): UpgradeState {
    return {
      levels: { ...this.upgrades.levels },
    };
  }

  /**
   * Get the current secret state for serialization
   */
  getSecretState(): SecretState {
    return {
      unlocked: { ...this.secrets.unlocked },
      purchased: { ...this.secrets.purchased },
      enabled: { ...this.secrets.enabled },
    };
  }

  /**
   * Restore upgrade state from serialized data
   */
  restoreUpgradeState(state: UpgradeState): void {
    this.upgrades = {
      levels: { ...state.levels },
    };
  }

  /**
   * Restore secret state from serialized data
   */
  restoreSecretState(state: SecretState): void {
    this.secrets = {
      unlocked: { ...state.unlocked },
      purchased: { ...state.purchased },
      enabled: { ...state.enabled },
    };
  }
}
