# Project Conventions

## Architecture

```
HeatGame (orchestrator)
├── GridManager     - Grid state and neighbor calculations
├── PhysicsEngine   - Heat/power simulation
└── UpgradeManager  - Upgrades and secrets
```

### Key Design Decisions

1. **Shared Mutable State**: PhysicsEngine operates directly on GridManager's grid via `getGridRef()`. This assumes single-threaded execution.

2. **Upgrade Callback**: PhysicsEngine queries upgrades via closure `(type) => upgradeManager.getUpgradeLevel(type)`. Don't purchase upgrades during physics tick.

3. **Stats Ownership** (Single Source of Truth):
   - Physics stats → **owned by PhysicsEngine**, queried on demand via `physicsEngine.getStats()`
     - `totalPowerGenerated`, `ticksAtHighHeat`, `fuelRodsDepleted`, `fuelRodsDepletedCool`, `fuelRodsDepletedIce`
   - Game stats → **owned by HeatGame**
     - `meltdownCount`, `tickCount`, `structuresBuilt`, `demolishCount`, `manualClicks`, `totalMoneyEarned`
   - **No sync/duplication**: `getStats()` combines both on demand

4. **Cell Access Patterns**:
   - `getCell()` → returns copy (for read-only external access)
   - `getCellRef()` → returns reference (for mutation, internal use)
   - `getGridRef()` → returns entire grid reference (for PhysicsEngine)
   - **Prefer references** over copies when mutation is needed

5. **Error Handling** (Fail Fast):
   - Physics violations (e.g., heat balance) throw `HeatBalanceError`
   - Game loop catches exceptions, pauses game, shows toast notification
   - User can resume from Options menu
   - Detailed crash info logged to console

## Testing Philosophy

**Keep tests lean.** Only test:
- Data loss scenarios (serialization, grid expansion)
- Complex interactions (upgrades affecting physics)
- Edge cases that would be hard to debug

**Don't test:**
- Trivial getters/setters
- Type correctness (compiler handles this)
- Initialization defaults
- Event listener add/remove patterns

## Commands

```bash
npm test          # Run unit tests
npm run build     # TypeScript compile
npm run dev       # Watch mode + serve
```

## Code Style

- Use composition over inheritance
- Single source of truth for each piece of state (no sync/duplication)
- Query data from owner on demand instead of caching copies
- Events are for UI notification, not state management
- Fail fast on invariant violations (throw, don't warn)
