# Architecture Review: Heat Management Game

**Review Date:** 2026-02-01
**Scope:** Complexity, data flows, event flows, redundancy, patterns

---

## Executive Summary

The codebase is well-structured with clear separation of concerns. However, there are several areas where complexity can be reduced, redundant patterns eliminated, and consistency improved.

### Key Findings:
1. **Stats duplication** - PhysicsEngine and HeatGame both track same stats, synced every tick
2. **Triple event system** - Three nearly identical event listener patterns
3. **Excessive secret checking** - Called on every tick, build, demolish, meltdown
4. **Dead code** - `STRUCTURE_COLORS` unused (replaced by HSV colors)
5. **Switch statement explosion** - Could be table-driven

---

## 1. COMPLEXITY HOTSPOTS

### 1.1 PhysicsEngine.ts - Melt Temp Upgrade Mapping (lines 214-221)

**Current:**
```typescript
let upgradeType: UpgradeType | null = null;
switch (structure) {
  case StructureType.FuelRod: upgradeType = UpgradeType.MeltTempFuelRod; break;
  case StructureType.Ventilator: upgradeType = UpgradeType.MeltTempVentilator; break;
  // ... 6 cases
}
```

**Simplify to:**
```typescript
const MELT_TEMP_UPGRADES: Partial<Record<StructureType, UpgradeType>> = {
  [StructureType.FuelRod]: UpgradeType.MeltTempFuelRod,
  [StructureType.Ventilator]: UpgradeType.MeltTempVentilator,
  // ...
};
const upgradeType = MELT_TEMP_UPGRADES[structure];
```

### 1.2 HeatGameRenderer.ts - getUpgradeEffectDisplay() (lines 925-1070)

**Problem:** 150-line switch statement with repeated patterns.

**Simplify:** Create a configuration object:
```typescript
const UPGRADE_EFFECT_CONFIG: Record<UpgradeType, {
  description: string;
  getValues: (level: number, def: UpgradeDefinition) => { current: string; next: string };
}> = { ... };
```

### 1.3 Duplicate "ForTier" Methods in PhysicsEngine

These methods have identical patterns:
- `getEffectivePowerSaleRateForTier()`
- `getEffectiveVentilatorDissipationForTier()`
- `getEffectiveFuelHeatGenerationForTier()`
- `getEffectiveTurbinePowerForTier()`

**Consider:** A single generic method with structure type parameter, or move to BalanceConfig as helper functions.

### 1.4 HeatGame.ts - Pass-through Getters (lines 211-340)

**30+ getters** that just delegate to sub-components:
```typescript
getUpgradeLevel(type) { return this.upgradeManager.getUpgradeLevel(type); }
isSecretUnlocked(type) { return this.upgradeManager.isSecretUnlocked(type); }
// ... many more
```

**Question:** Does UI need these all through HeatGame, or can it access managers directly?

---

## 2. REDUNDANT DATA

### 2.1 Stats Tracked in Two Places

**PhysicsStats** (PhysicsEngine.ts:38-47):
- `totalPowerGenerated`
- `totalMoneyEarned`
- `fuelRodsDepleted`
- `ticksAtHighHeat`
- `fuelRodsDepletedCool`
- `fuelRodsDepletedIce`

**GameStats** (HeatGame.ts:43-55):
- Same fields, plus `meltdownCount`, `tickCount`, etc.

**Current Flow:**
```
PhysicsEngine.tick() → updates PhysicsStats
HeatGame.tick() → syncs from PhysicsStats to GameStats (lines 550-555)
```

**Problem:** Two sources of truth, synced every tick.

**Recommendation:**
- Option A: PhysicsEngine owns physics stats, HeatGame owns game stats, no duplication
- Option B: Single Stats object shared/passed around

### 2.2 Grid Snapshots Created Multiple Times

- `render()` → `getGridSnapshot()` (full grid copy)
- `getCellTooltip()` → `getCell()` (single cell copy)
- Every render creates a full grid snapshot even for static grids

**Recommendation:** Consider dirty-flagging or direct grid access for read-only rendering.

---

## 3. EVENT SYSTEM ISSUES

### 3.1 Triple Event System Pattern

Three nearly identical implementations:
- `GameEventListener` / `eventListeners[]` in HeatGame.ts
- `PhysicsEventListener` / `eventListeners[]` in PhysicsEngine.ts
- `UpgradeEventListener` / `eventListeners[]` in UpgradeManager.ts

Each has identical `addEventListener()`, `removeEventListener()`, `emitEvent()` methods.

**Recommendation:** Extract to a shared `EventEmitter<T>` class:
```typescript
class EventEmitter<T> {
  private listeners: ((event: T) => void)[] = [];
  on(listener: (event: T) => void) { ... }
  off(listener: (event: T) => void) { ... }
  emit(event: T) { ... }
}
```

### 3.2 Event Forwarding Chain

**Current Flow:**
```
PhysicsEngine emits 'meltdown'
  → HeatGame listener catches it (line 167)
  → HeatGame increments meltdownCount
  → HeatGame emits 'meltdown' to its listeners
  → Renderer catches it for animation
```

**Double-handling:** Events are caught, re-emitted, caught again.

**Alternative:** Single event bus that all components publish/subscribe to.

### 3.3 Double-Tapped Events - checkSecretUnlocks()

Called from:
1. `build()` (line 433)
2. `demolish()` (line 459)
3. After meltdown event (line 170)
4. `tick()` (line 562)

**Per tick:** Called at least once, often more if building/demolishing.

**Problem:** Most calls find nothing changed. Checking all secrets every time is wasteful.

**Recommendation:** Only check when relevant stats change:
```typescript
// In tick(), after syncing stats:
if (physicsStats.fuelRodsDepleted !== previousFuelRodsDepleted) {
  this.checkSecretUnlocks();
}
```

---

## 4. DEAD CODE / UNUSED

### 4.1 STRUCTURE_COLORS in HeatGameRenderer.ts (lines 107-116)

```typescript
const STRUCTURE_COLORS: Record<StructureType, string> = {
  [StructureType.Empty]: '#2a2a2a',
  [StructureType.FuelRod]: '#ff6b00',
  // ...
};
```

**Never used.** Rendering uses `getStructureHsvColor()` instead (line 346).

**Action:** Delete `STRUCTURE_COLORS`.

### 4.2 Backward Compatibility Exports (HeatGame.ts)

```typescript
/** @deprecated Use getGridSize() instead */
get GRID_SIZE(): number { ... }

export { CORE_SETTINGS };
export const GRID_SIZE = CORE_SETTINGS.INITIAL_GRID_SIZE;
```

**Question:** Is anything still using these? If not, remove.

---

## 5. EDGE CASE HANDLING NOT NEEDED

### 5.1 Redundant Bounds Checking

`GridManager.getCell()` checks `isValidPosition()`, but callers often check again:

```typescript
// HeatGame.build()
const cell = this.gridManager.getCellRef(x, y)!;  // Force unwrap - trusts prior canBuild check
```

**Pattern:** Sometimes trusts prior check, sometimes re-checks. Be consistent.

### 5.2 Heat Balance Verification (PhysicsEngine.ts:795-813)

```typescript
if (!isBalanced) {
  console.warn(`[PhysicsEngine] Heat balance violation detected!...`);
}
```

**Question:** Is this debug-only code? Either:
- Remove for production (trust the math)
- Make it a test/debug mode flag

---

## 6. INCONSISTENT PATTERNS

### 6.1 Upgrade Queries

PhysicsEngine gets upgrade info via callbacks:
```typescript
constructor(
  private getUpgradeLevel: (type: UpgradeType) => number,
  private isSecretPurchased: (type: SecretUpgradeType) => boolean
)
```

**vs.** HeatGame directly calls `upgradeManager.getUpgradeLevel()`.

**Question:** Why the indirection for PhysicsEngine but not elsewhere?

### 6.2 Cell Access Patterns

- `getCell()` returns a copy
- `getCellRef()` returns direct reference
- `getGridRef()` returns entire grid reference

**Inconsistent:** Sometimes safety copies, sometimes direct mutation.

### 6.3 Money Tracking

- `HeatGame.money` - private field
- `PhysicsStats.totalMoneyEarned` - tracked by physics
- `GameStats.totalMoneyEarned` - synced from physics

Money earned flows:
1. Power sold → PhysicsEngine adds to `stats.totalMoneyEarned`
2. HeatGame syncs from physics stats
3. HeatGame also does `this.money += result.moneyEarned`

Three places tracking money-related values.

---

## 7. UI EXPOSURE

### 7.1 Methods That Could Be Internal

These are public but only used internally or not at all:
- `getGridSnapshot()` - only used by renderer, could be internal
- Multiple `getEffective*ForTier()` methods - UI helpers, consider moving to renderer

### 7.2 Missing UI Exposure

- No way to see individual cell efficiency at a glance
- No "projected income per tick" display
- Heat balance stats shown but not prominently

---

## 8. MODERN DEPENDENCIES

### Current State (Excellent)
- **Zero runtime dependencies** - pure TypeScript
- Dev deps: vitest, playwright, typescript, concurrently

### Potential Additions (NOT recommended unless needed)

| Library | Would Help With | Why Skip |
|---------|-----------------|----------|
| rxjs | Event system | Overkill for this scale |
| immer | Immutable state | Not needed, mutable is fine |
| zustand | State management | Would complicate, not simplify |
| eventemitter3 | Events | Easy to write in 15 lines |

**Verdict:** Keep zero runtime deps. The code is simple enough that adding libraries would add complexity, not remove it.

---

## 9. ACTION ITEMS (Priority Ordered)

### High Impact, Low Effort
1. **Delete `STRUCTURE_COLORS`** - dead code
2. **Add melt temp upgrade mapping table** - replace switch
3. **Cache checkSecretUnlocks()** - only call when stats change

### Medium Impact, Medium Effort
4. **Unify event system** - extract `EventEmitter<T>` class
5. **Consolidate stats ownership** - single source of truth
6. **Table-drive getUpgradeEffectDisplay()** - reduce switch explosion

### Low Priority / Optional
7. **Review pass-through getters** - consider direct manager access
8. **Clean up backward compat exports** - if unused

---

## 10. DATA FLOW DIAGRAMS

### Tick Flow
```
game.tick()
  ├─→ tickCount++
  ├─→ physicsEngine.tick()
  │     ├─→ initCellPerformance()
  │     ├─→ processHeatGeneration() → totalHeatGenerated
  │     ├─→ processFuelDepletion() → emits 'fuel_depleted'
  │     ├─→ processHeatTransfer() → heatLostToEnvironment
  │     ├─→ processHeatDissipation() → heatVentilated
  │     ├─→ processPowerGeneration() → updates stats.totalPowerGenerated
  │     ├─→ processPowerSale() → emits 'power_sold', returns moneyEarned
  │     ├─→ processOverheating() → emits 'meltdown'/'structure_melted'
  │     └─→ return { moneyEarned, heatBalance }
  ├─→ sync stats from physicsEngine to gameStats (REDUNDANT)
  ├─→ money += moneyEarned
  └─→ checkSecretUnlocks() (OFTEN UNNECESSARY)
```

### Event Flow
```
PhysicsEngine event
  │
  ├─→ (fuel_depleted) → HeatGame forwards → Renderer shows
  ├─→ (power_sold) → HeatGame forwards → Renderer shows
  ├─→ (structure_melted) → HeatGame forwards → Renderer shows
  └─→ (meltdown) → HeatGame increments meltdownCount
                 → HeatGame forwards → Renderer animation
                 → HeatGame checkSecretUnlocks()
```

---

## Conclusion

The architecture is sound and follows good principles (composition, single responsibility). The main issues are:

1. **Redundancy** in stats tracking and event forwarding
2. **Inefficiency** in secret unlock checking
3. **Dead code** (STRUCTURE_COLORS)
4. **Switch explosions** that could be tables

None of these are critical bugs, but addressing them would make the codebase leaner and more maintainable.
