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

3. **Stats Ownership**:
   - Physics stats (totalPowerGenerated, ticksAtHighHeat, fuelRodsDepleted) → owned by PhysicsEngine
   - Game stats (meltdownCount, structuresBuilt, demolishCount) → owned by HeatGame
   - HeatGame syncs from PhysicsEngine after each tick

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
- Prefer explicit state sync over implicit coupling
- Events are for UI notification, not state management
- Single source of truth for each piece of state
