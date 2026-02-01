/**
 * UpgradeManager Unit Tests
 *
 * Focus: Serialization (data loss risk), max level enforcement, unlock conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UpgradeManager } from './UpgradeManager.js';
import { UpgradeType, SecretUpgradeType, UPGRADE_DEFINITIONS } from './BalanceConfig.js';

describe('UpgradeManager', () => {
  let upgrades: UpgradeManager;

  beforeEach(() => {
    upgrades = new UpgradeManager();
  });

  describe('upgrade purchasing', () => {
    it('increases level and cost after purchase', () => {
      const type = UpgradeType.FuelHeatOutput;
      const initialCost = upgrades.getUpgradeCost(type);

      upgrades.purchaseUpgrade(type, initialCost);

      expect(upgrades.getUpgradeLevel(type)).toBe(1);
      expect(upgrades.getUpgradeCost(type)).toBeGreaterThan(initialCost);
    });

    it('respects max level', () => {
      const type = UpgradeType.TurbineConductivity;
      const maxLevel = UPGRADE_DEFINITIONS[type].maxLevel;

      // Purchase to max
      for (let i = 0; i < maxLevel; i++) {
        upgrades.purchaseUpgrade(type, 1e9);
      }

      expect(upgrades.getUpgradeLevel(type)).toBe(maxLevel);
      expect(upgrades.canPurchaseUpgrade(type, 1e9)).toBe(false);
    });

    it('fails without enough money', () => {
      const cost = upgrades.purchaseUpgrade(UpgradeType.FuelHeatOutput, 0);
      expect(cost).toBe(0);
      expect(upgrades.getUpgradeLevel(UpgradeType.FuelHeatOutput)).toBe(0);
    });
  });

  describe('secret unlocks', () => {
    it('unlocks secrets when conditions are met', () => {
      const stats = {
        meltdownCount: 1,
        filledCells: 0,
        totalMoneyEarned: 10000,
        sellCount: 100,
        ticksAtHighHeat: 0,
        fuelRodsDepletedCool: 0,
        fuelRodsDepletedIce: 0,
      };

      const unlocked = upgrades.checkSecretUnlocks(stats);

      expect(unlocked).toContain(SecretUpgradeType.ExoticFuel);   // 1 meltdown
      expect(unlocked).toContain(SecretUpgradeType.Salvage);       // 100 sells
      expect(unlocked).toContain(SecretUpgradeType.Overclock);     // 10000 money
    });

    it('does not re-unlock already unlocked secrets', () => {
      const stats = {
        meltdownCount: 1,
        filledCells: 0,
        totalMoneyEarned: 0,
        sellCount: 0,
        ticksAtHighHeat: 0,
        fuelRodsDepletedCool: 0,
        fuelRodsDepletedIce: 0,
      };

      const first = upgrades.checkSecretUnlocks(stats);
      const second = upgrades.checkSecretUnlocks(stats);

      expect(first).toContain(SecretUpgradeType.ExoticFuel);
      expect(second).not.toContain(SecretUpgradeType.ExoticFuel);
    });

    it('toggleable secrets auto-enable on purchase', () => {
      upgrades.checkSecretUnlocks({
        meltdownCount: 1,
        filledCells: 0,
        totalMoneyEarned: 0,
        sellCount: 0,
        ticksAtHighHeat: 0,
        fuelRodsDepletedCool: 0,
        fuelRodsDepletedIce: 0,
      });
      upgrades.purchaseSecret(SecretUpgradeType.ExoticFuel, 1e6);

      expect(upgrades.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(true);

      upgrades.toggleSecret(SecretUpgradeType.ExoticFuel, false);
      expect(upgrades.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(false);
    });
  });

  describe('serialization', () => {
    it('upgrade state survives round-trip', () => {
      upgrades.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1e6);
      upgrades.purchaseUpgrade(UpgradeType.FuelHeatOutput, 1e6);

      const state = upgrades.getUpgradeState();
      const restored = new UpgradeManager();
      restored.restoreUpgradeState(state);

      expect(restored.getUpgradeLevel(UpgradeType.FuelHeatOutput)).toBe(2);
    });

    it('secret state survives round-trip', () => {
      upgrades.checkSecretUnlocks({ meltdownCount: 1, filledCells: 0, totalMoneyEarned: 0, demolishCount: 0, ticksAtHighHeat: 0 });
      upgrades.purchaseSecret(SecretUpgradeType.ExoticFuel, 1e6);
      upgrades.toggleSecret(SecretUpgradeType.ExoticFuel, false);

      const state = upgrades.getSecretState();
      const restored = new UpgradeManager();
      restored.restoreSecretState(state);

      expect(restored.isSecretUnlocked(SecretUpgradeType.ExoticFuel)).toBe(true);
      expect(restored.isSecretPurchased(SecretUpgradeType.ExoticFuel)).toBe(true);
      expect(restored.isSecretEnabled(SecretUpgradeType.ExoticFuel)).toBe(false);
    });
  });

  describe('reactor expansion', () => {
    it('returns correct expansion sizes', () => {
      expect(upgrades.getExpansionSize(SecretUpgradeType.ReactorExpansion1)).toBe(17);
      expect(upgrades.getExpansionSize(SecretUpgradeType.ReactorExpansion4)).toBe(20);
      expect(upgrades.getExpansionSize(SecretUpgradeType.Salvage)).toBeNull();
    });
  });
});
