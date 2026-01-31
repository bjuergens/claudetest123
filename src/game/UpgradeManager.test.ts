/**
 * Unit tests for UpgradeManager
 *
 * Tests upgrade purchasing, secret unlocking, and toggle states in isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UpgradeManager, UpgradeEvent } from './UpgradeManager.js';
import { UpgradeType, SecretUpgradeType, UPGRADE_DEFINITIONS, SECRET_UPGRADE_DEFINITIONS } from './BalanceConfig.js';

describe('UpgradeManager', () => {
  let upgradeManager: UpgradeManager;

  beforeEach(() => {
    upgradeManager = new UpgradeManager();
  });

  describe('initialization', () => {
    it('should start with all upgrades at level 0', () => {
      for (const type of Object.values(UpgradeType)) {
        expect(upgradeManager.getUpgradeLevel(type)).toBe(0);
      }
    });

    it('should start with all secrets locked', () => {
      for (const type of Object.values(SecretUpgradeType)) {
        expect(upgradeManager.isSecretUnlocked(type)).toBe(false);
        expect(upgradeManager.isSecretPurchased(type)).toBe(false);
        expect(upgradeManager.isSecretEnabled(type)).toBe(false);
      }
    });
  });

  describe('regular upgrades', () => {
    it('should return correct upgrade cost', () => {
      const cost = upgradeManager.getUpgradeCost(UpgradeType.FuelHeatOutput);
      expect(cost).toBeGreaterThan(0);
    });

    it('should allow purchasing upgrades with enough money', () => {
      const type = UpgradeType.FuelHeatOutput;
      const cost = upgradeManager.getUpgradeCost(type);

      expect(upgradeManager.canPurchaseUpgrade(type, cost)).toBe(true);
      expect(upgradeManager.canPurchaseUpgrade(type, cost - 1)).toBe(false);
    });

    it('should increase level on purchase', () => {
      const type = UpgradeType.FuelHeatOutput;
      const cost = upgradeManager.getUpgradeCost(type);

      const spent = upgradeManager.purchaseUpgrade(type, cost);

      expect(spent).toBe(cost);
      expect(upgradeManager.getUpgradeLevel(type)).toBe(1);
    });

    it('should return 0 if purchase fails', () => {
      const type = UpgradeType.FuelHeatOutput;

      const spent = upgradeManager.purchaseUpgrade(type, 0);

      expect(spent).toBe(0);
      expect(upgradeManager.getUpgradeLevel(type)).toBe(0);
    });

    it('should increase cost after each purchase', () => {
      const type = UpgradeType.FuelHeatOutput;
      const initialCost = upgradeManager.getUpgradeCost(type);

      upgradeManager.purchaseUpgrade(type, 1000000);

      const newCost = upgradeManager.getUpgradeCost(type);
      expect(newCost).toBeGreaterThan(initialCost);
    });

    it('should respect max level', () => {
      // TurbineConductivity has maxLevel: 10
      const type = UpgradeType.TurbineConductivity;
      const maxLevel = UPGRADE_DEFINITIONS[type].maxLevel;

      // Purchase up to max level
      for (let i = 0; i < maxLevel; i++) {
        upgradeManager.purchaseUpgrade(type, 1000000000);
      }

      expect(upgradeManager.getUpgradeLevel(type)).toBe(maxLevel);
      expect(upgradeManager.canPurchaseUpgrade(type, 1000000000)).toBe(false);
    });

    it('should emit event on purchase', () => {
      const events: UpgradeEvent[] = [];
      upgradeManager.addEventListener(e => events.push(e));

      upgradeManager.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1000000);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('upgrade_purchased');
      expect(events[0].upgradeType).toBe(UpgradeType.FuelHeatOutput);
    });
  });

  describe('secret upgrades', () => {
    it('should return correct secret cost', () => {
      const cost = upgradeManager.getSecretCost(SecretUpgradeType.Salvage);
      expect(cost).toBe(SECRET_UPGRADE_DEFINITIONS[SecretUpgradeType.Salvage].cost);
    });

    it('should not allow purchasing locked secrets', () => {
      expect(upgradeManager.canPurchaseSecret(SecretUpgradeType.Salvage, 1000000)).toBe(false);
    });

    it('should not allow purchasing already purchased secrets', () => {
      // ExoticFuel requires 1 meltdown to unlock
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      const cost = upgradeManager.getSecretCost(SecretUpgradeType.ExoticFuel);
      upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, cost);

      expect(upgradeManager.canPurchaseSecret(SecretUpgradeType.ExoticFuel, 1000000)).toBe(false);
    });

    it('should unlock secrets based on stats', () => {
      // ExoticFuel requires 1 meltdown
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };

      const unlocked = upgradeManager.checkSecretUnlocks(stats);

      expect(unlocked).toContain(SecretUpgradeType.ExoticFuel);
      expect(upgradeManager.isSecretUnlocked(SecretUpgradeType.ExoticFuel)).toBe(true);
    });

    it('should emit event on secret unlock', () => {
      const events: UpgradeEvent[] = [];
      upgradeManager.addEventListener(e => events.push(e));

      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      expect(events.some(e => e.type === 'secret_unlocked')).toBe(true);
    });

    it('should allow purchasing unlocked secrets with enough money', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      const cost = upgradeManager.getSecretCost(SecretUpgradeType.ExoticFuel);
      expect(upgradeManager.canPurchaseSecret(SecretUpgradeType.ExoticFuel, cost)).toBe(true);
      expect(upgradeManager.canPurchaseSecret(SecretUpgradeType.ExoticFuel, cost - 1)).toBe(false);
    });

    it('should mark secret as purchased after buying', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      const cost = upgradeManager.getSecretCost(SecretUpgradeType.ExoticFuel);
      const spent = upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, cost);

      expect(spent).toBe(cost);
      expect(upgradeManager.isSecretPurchased(SecretUpgradeType.ExoticFuel)).toBe(true);
    });

    it('should emit event on secret purchase', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      const events: UpgradeEvent[] = [];
      upgradeManager.addEventListener(e => events.push(e));

      upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, 1000000);

      expect(events.some(e => e.type === 'secret_purchased')).toBe(true);
    });
  });

  describe('toggleable secrets', () => {
    it('should auto-enable toggleable secrets on purchase', () => {
      // Exotic fuel is toggleable, requires 1 meltdown
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, 1000000);

      expect(upgradeManager.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(true);
    });

    it('should allow toggling purchased toggleable secrets', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);
      upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, 1000000);

      upgradeManager.toggleSecret(SecretUpgradeType.ExoticFuel, false);
      expect(upgradeManager.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(false);

      upgradeManager.toggleSecret(SecretUpgradeType.ExoticFuel, true);
      expect(upgradeManager.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(true);
    });

    it('should not toggle unpurchased secrets', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);

      upgradeManager.toggleSecret(SecretUpgradeType.ExoticFuel, true);

      expect(upgradeManager.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(false);
    });

    it('should not toggle non-toggleable secrets', () => {
      // Salvage requires 100 demolishes and is not toggleable
      const stats = { meltdownCount: 0, filledCells: 0, totalMoneyEarned: 0, demolishCount: 100, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);
      upgradeManager.purchaseSecret(SecretUpgradeType.Salvage, 1000000);

      upgradeManager.toggleSecret(SecretUpgradeType.Salvage, true);

      // Salvage is not toggleable, so enabled should remain false
      expect(upgradeManager.isSecretEnabled(SecretUpgradeType.Salvage)).toBe(false);
    });
  });

  describe('reactor expansion', () => {
    it('should return correct expansion size for reactor expansions', () => {
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.ReactorExpansion1)).toBe(17);
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.ReactorExpansion2)).toBe(18);
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.ReactorExpansion3)).toBe(19);
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.ReactorExpansion4)).toBe(20);
    });

    it('should return null for non-expansion secrets', () => {
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.Salvage)).toBeNull();
      expect(upgradeManager.getExpansionSize(SecretUpgradeType.ExoticFuel)).toBeNull();
    });
  });

  describe('serialization', () => {
    it('should get upgrade state for serialization', () => {
      upgradeManager.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1000000);
      upgradeManager.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1000000);

      const state = upgradeManager.getUpgradeState();

      expect(state.levels[UpgradeType.FuelHeatOutput]).toBe(2);
    });

    it('should get secret state for serialization', () => {
      // ExoticFuel requires 1 meltdown
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };
      upgradeManager.checkSecretUnlocks(stats);
      upgradeManager.purchaseSecret(SecretUpgradeType.ExoticFuel, 1000000);

      const state = upgradeManager.getSecretState();

      expect(state.unlocked[SecretUpgradeType.ExoticFuel]).toBe(true);
      expect(state.purchased[SecretUpgradeType.ExoticFuel]).toBe(true);
    });

    it('should restore upgrade state from serialization', () => {
      const state = upgradeManager.getUpgradeState();
      state.levels[UpgradeType.FuelHeatOutput] = 5;

      const newManager = new UpgradeManager();
      newManager.restoreUpgradeState(state);

      expect(newManager.getUpgradeLevel(UpgradeType.FuelHeatOutput)).toBe(5);
    });

    it('should restore secret state from serialization', () => {
      const state = upgradeManager.getSecretState();
      state.unlocked[SecretUpgradeType.Salvage] = true;
      state.purchased[SecretUpgradeType.Salvage] = true;

      const newManager = new UpgradeManager();
      newManager.restoreSecretState(state);

      expect(newManager.isSecretUnlocked(SecretUpgradeType.Salvage)).toBe(true);
      expect(newManager.isSecretPurchased(SecretUpgradeType.Salvage)).toBe(true);
    });
  });

  describe('event listeners', () => {
    it('should allow adding and removing listeners', () => {
      const events: UpgradeEvent[] = [];
      const listener = (e: UpgradeEvent) => events.push(e);

      upgradeManager.addEventListener(listener);
      upgradeManager.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1000000);
      expect(events).toHaveLength(1);

      upgradeManager.removeEventListener(listener);
      upgradeManager.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1000000);
      expect(events).toHaveLength(1); // No new events
    });
  });

  describe('multiple unlock conditions', () => {
    it('should unlock multiple secrets when conditions are met', () => {
      // Stats that should unlock both Salvage (100 demolishes) and ExoticFuel (1 meltdown) and Overclock (10000 money)
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 10000, demolishCount: 100, ticksAtHighHeat: 0 };

      const unlocked = upgradeManager.checkSecretUnlocks(stats);

      expect(unlocked).toContain(SecretUpgradeType.ExoticFuel);
      expect(unlocked).toContain(SecretUpgradeType.Salvage);
      expect(unlocked).toContain(SecretUpgradeType.Overclock);
    });

    it('should not re-unlock already unlocked secrets', () => {
      const stats = { meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 };

      const firstUnlock = upgradeManager.checkSecretUnlocks(stats);
      expect(firstUnlock).toContain(SecretUpgradeType.ExoticFuel);

      const secondUnlock = upgradeManager.checkSecretUnlocks(stats);
      expect(secondUnlock).not.toContain(SecretUpgradeType.ExoticFuel);
    });
  });
});
