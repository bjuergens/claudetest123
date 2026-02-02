# Heat Game - Game Design Document

A nuclear reactor management incremental/idle game where players build and manage heat generation, transfer, and power production systems.

---

## Table of Contents

1. [Core Concept](#1-core-concept)
2. [Game Loop](#2-game-loop)
3. [Grid System](#3-grid-system)
4. [Structures](#4-structures)
5. [Heat Physics](#5-heat-physics)
6. [Power Generation & Economy](#6-power-generation--economy)
7. [Upgrades](#7-upgrades)
8. [Secrets & Achievements](#8-secrets--achievements)
9. [Progression](#9-progression)
10. [Constants Reference](#10-constants-reference)

---

## 1. Core Concept

**Heat Game** is an incremental reactor management game. Players place structures on a grid to:
- Generate heat (fuel rods)
- Transfer heat (heat exchangers)
- Dissipate heat (ventilators)
- Convert heat to power (turbines)
- Sell power for money (substations)

The core tension: **more heat = more power = more risk of meltdown**.

### Design Pillars

1. **Heat as Core Resource** - Heat flows through the grid following physics rules
2. **Risk vs Reward** - Higher temperatures yield more power but risk structure meltdowns
3. **Exponential Progression** - Each tier is 10x cost, ~10x efficiency
4. **No Punishing Failure** - Meltdowns are learning opportunities, not game-overs

---

## 2. Game Loop

### Tick System

- **Default tick rate**: 1 tick per second (1000ms)
- **Upgradeable**: Overclock reduces tick interval (min ~328ms at max level)

### Per-Tick Processing Order

```
1. Heat Generation      → Fuel rods produce heat
2. Fuel Depletion       → Fuel rod lifetime decreases
3. Heat Transfer        → Heat spreads between adjacent cells
4. Heat Dissipation     → Ventilators/Void Cells remove heat
5. Power Generation     → Turbines convert heat (>100°C) to power
6. Power Sale           → Substations sell power for money
7. Overheating Check    → Structures exceeding melt temp become slag/plasma
8. Residue Decay        → Slag/plasma lifetime decreases
```

### Player Actions

| Action | Effect |
|--------|--------|
| Place Structure | Spend money, add structure to grid |
| Demolish Structure | Remove structure, get partial refund |
| Purchase Upgrade | Spend money, permanent improvement |
| Manual Click | Instant money generation |
| Toggle Exotic Mode | Switch between normal/exotic fuel placement |

---

## 3. Grid System

### Grid Properties

| Property | Value |
|----------|-------|
| Starting Size | 16×16 (256 cells) |
| Maximum Size | 20×20 (400 cells) |
| Coordinate System | (x, y) with (0,0) at top-left |
| Neighbor System | 4-directional (no diagonals) |
| Ambient Temperature | 20°C |

### Grid Expansion

Grid expands by purchasing Reactor Expansion secrets:

| Expansion | Size | Cost |
|-----------|------|------|
| Initial | 16×16 | - |
| Expansion I | 17×17 | 10,000 |
| Expansion II | 18×18 | 100,000 |
| Expansion III | 19×19 | 1,000,000 |
| Expansion IV | 20×20 | 10,000,000 |

**Unlock condition**: Fill the current grid completely with structures.

### Cell Data

Each cell stores:
- Position (x, y)
- Structure type and tier
- Current temperature (°C)
- Stored power
- Remaining lifetime (fuel rods)
- Exotic flag (fuel rods)
- Maximum temperature reached (for secrets)

---

## 4. Structures

### Structure Overview

| Structure | Purpose | Tiers | Secret |
|-----------|---------|-------|--------|
| Fuel Rod | Generates heat | T1-T4 | No |
| Ventilator | Dissipates heat | T1-T4 | No |
| Heat Exchanger | Transfers heat faster | T1-T4 | No |
| Insulator | Blocks heat transfer | T1-T4 | No |
| Turbine | Converts heat to power | T1-T4 | No |
| Substation | Sells power for money | T1-T4 | No |
| Void Cell | Extreme heat sink | T1 only | Yes |
| Ice Cube | Emergency cooling | T1 only | Yes |

### Structure Costs

| Structure | T1 | T2 | T3 | T4 |
|-----------|-----|------|--------|----------|
| Fuel Rod | 10 | 100 | 1,000 | 10,000 |
| Ventilator | 10 | 100 | 1,000 | 10,000 |
| Heat Exchanger | 15 | 150 | 1,500 | 15,000 |
| Insulator | 8 | 80 | 800 | 8,000 |
| Turbine | 25 | 250 | 2,500 | 25,000 |
| Substation | 50 | 500 | 5,000 | 50,000 |
| Void Cell | 100 | - | - | - |
| Ice Cube | 5 | - | - | - |

### Melt Temperatures (Base)

| Structure | Melt Temp | Notes |
|-----------|-----------|-------|
| Fuel Rod | 2,000°C | Most durable |
| Heat Exchanger | 400°C | Medium durability |
| Insulator | 1,000°C | Heat-resistant |
| Ventilator | 200°C | Fragile |
| Turbine | 150°C | Fragile |
| Substation | 80°C | Very fragile |
| Void Cell | ∞ | Cannot melt |
| Ice Cube | 100°C | Intentionally melts |

### Detailed Structure Behaviors

#### Fuel Rod
- **Heat Generation per Tier**: T1=100, T2=1,000, T3=10,000, T4=100,000 heat/tick
- **Lifetime per Tier**: T1=20, T2=200, T3=2,000, T4=20,000 ticks
- **Adjacency Bonus**: +100% heat per adjacent fuel rod
  - Example: 4 fuel rods in square = each generates 5× heat
- **Exotic Variant**: Heat scales with temperature
  - Formula: `multiplier = min(5.0, 1.0 + (temp / 1000) × 0.5)`
  - At 2000°C: 2× heat, at 8000°C+: 5× heat (capped)

#### Ventilator
- **Heat Dissipation per Tier**: T1=5, T2=50, T3=500, T4=5,000 heat/tick
- Removes heat from its cell each tick

#### Heat Exchanger
- **Conductivity**: 0.4 (very high)
- No special effect, just spreads heat quickly between neighbors

#### Insulator
- **Conductivity**: 0.005 (extremely low)
- Creates thermal isolation barriers

#### Turbine
- **Heat Consumption per Tier**: T1=10, T2=100, T3=1,000, T4=10,000 heat/tick
- **Power Generation**: 0.1 power per heat consumed
- **Requirement**: Only works when cell temperature > 100°C
- Transfers power to adjacent substations

#### Substation
- **Power Sale Rate per Tier**: T1=1, T2=10, T3=100, T4=1,000 power/tick
- **Money Earned**: 1 money per power sold
- Most fragile structure (80°C melt temp)

#### Void Cell (Secret)
- **Heat Dissipation**: 50 heat/tick
- **Conductivity**: 1.0 (maximum - pulls heat aggressively)
- Cannot melt - perfect for extreme heat zones
- Only T1 available

#### Ice Cube (Secret)
- **Melt Behavior**: When it melts at 100°C, cools the tile to 0°C
- Leaves molten slag after melting
- Perfect for emergency cooling
- Only T1 available

### Residues (Non-Placeable)

| Residue | Source | Lifetime | Conductivity |
|---------|--------|----------|--------------|
| Molten Slag | Normal structure melt | 10 ticks | 0.5 |
| Plasma | Exotic fuel at 100,000°C | 100 ticks | 1.0 |

- Cannot be removed by player
- Heat remains when residue decays
- Empty cell left behind

---

## 5. Heat Physics

### Heat Transfer Formula

Heat transfers between adjacent cells based on conductivity:

```
avgConductivity = (cell1.conductivity + cell2.conductivity) / 2
transfer = temperatureDifference × avgConductivity / 2
```

Both cells update: warmer cell loses heat, cooler cell gains heat.

### Conductivity Values

| Structure | Base Conductivity |
|-----------|-------------------|
| Void Cell | 1.0 |
| Plasma | 1.0 |
| Molten Slag | 0.5 |
| Heat Exchanger | 0.4 |
| Fuel Rod | 0.3 |
| Ice Cube | 0.3 |
| Turbine | 0.2 |
| Ventilator | 0.2 |
| Substation | 0.2 |
| Empty | 0.06 |
| Insulator | 0.005 |

### Environment Heat Loss

Edge cells lose heat to environment:

```
heatLost = (cellTemp - 20) × 0.05 × numEdges
```

- Corner cells: 2 edges (more heat loss)
- Edge cells: 1 edge
- Interior cells: 0 edges (no environmental loss)

### Meltdown Mechanics

When a structure's temperature exceeds its melt temperature:

1. Structure is destroyed
2. Residue is created:
   - Normal structures → Molten Slag (10 tick lifetime)
   - Exotic fuel at 100,000°C+ → Plasma (100 tick lifetime)
   - Ice Cube → Slag, but temperature resets to 0°C
3. Heat is preserved on the residue
4. Power is lost

**Important**: There is no grid-clearing meltdown event. Structures melt individually.

---

## 6. Power Generation & Economy

### Power Flow

```
Fuel Rod (heat) → Turbine (power) → Substation (money)
```

### Turbine Power Generation

1. Only activates when cell temperature > 100°C
2. Consumes heat above 100°C (up to tier maximum)
3. Generates 0.1 power per heat consumed
4. Transfers power to adjacent substation

### Substation Power Sale

- Sells power up to tier rate each tick
- Earns 1 money per power sold

### Manual Click Income

- **Base**: 1 money per click
- **With upgrades**: 1 + (upgrade level × 1) per click

### Demolish Refund

| Condition | Refund Rate |
|-----------|-------------|
| Base | 50% |
| + Salvage Operations | 75% |
| + Salvage Master | 100% |

---

## 7. Upgrades

### Upgrade Cost Formula

```
cost = baseCost × (costMultiplier ^ currentLevel)
```

### Regular Upgrades

| Upgrade | Base Cost | Multiplier | Max Level | Effect per Level |
|---------|-----------|------------|-----------|------------------|
| Fuel Longevity | 100 | 2.5× | ∞ | +10 ticks lifetime |
| Enriched Fuel | 150 | 2.5× | ∞ | +5 heat/tick |
| Turbine Efficiency | 200 | 2.0× | 10 | +0.03 conductivity |
| Advanced Insulation | 150 | 2.0× | 10 | ×0.5 conductivity |
| Improved Cooling | 100 | 2.0× | ∞ | +2 heat dissipation |
| Power Grid Upgrade | 500 | 3.0× | ∞ | +1 power/tick sale |
| Overclock* | 1,000 | 5.0× | 5 | ×0.8 tick interval |
| Bigger Buttons | 50 | 2.0× | ∞ | +1 money/click |

*Overclock requires Temporal Acceleration secret

### Melt Temperature Upgrades

| Upgrade | Base Cost | Multiplier | Max Level | Effect per Level |
|---------|-----------|------------|-----------|------------------|
| Reinforced Fuel Casing | 500 | 3.0× | 10 | +500°C |
| Heat-Resistant Fans | 100 | 2.5× | 10 | +20°C (Ventilator) |
| Hardened Exchangers | 150 | 2.5× | 10 | +40°C |
| Advanced Ceramics | 120 | 2.5× | 10 | +30°C (Insulator) |
| Reinforced Turbines | 200 | 2.5× | 10 | +15°C |
| Industrial Substations | 300 | 3.0× | 10 | +10°C |

---

## 8. Secrets & Achievements

Secrets are hidden until unlock conditions are met, then must be purchased.

### Secret Unlock Conditions

| Secret | Unlock Condition | Cost |
|--------|------------------|------|
| Exotic Fuel Synthesis | First structure melts | 1,000 |
| Reactor Expansion I | Fill 16×16 grid | 10,000 |
| Reactor Expansion II | Fill 17×17 grid | 100,000 |
| Reactor Expansion III | Fill 18×18 grid | 1,000,000 |
| Reactor Expansion IV | Fill 19×19 grid | 10,000,000 |
| Void Technology | 100 ticks with fuel rod at 90% melt temp | 5,000 |
| Temporal Acceleration | Earn 10,000 total money | 10,000 |
| Salvage Operations | Sell 100 structures | 2,000 |
| Salvage Master | Sell entire full grid at once | 10,000 |
| Cryogenic Fuel Casing | Deplete 10 fuel rods that never exceeded 200°C | 3,000 |
| Superconductor Technology | Deplete 10 fuel rods that never exceeded 100°C | 10,000 |
| Cryogenic Technology | Heat all tiles to 100°C+ simultaneously | 1 |
| Nach mir die Sintflut | Heat all tiles to 5,000°C+ simultaneously | 1,000 |

### Secret Effects

| Secret | Toggleable | Effect |
|--------|------------|--------|
| Exotic Fuel Synthesis | Yes | Build fuel that scales heat with temperature |
| Reactor Expansion I-IV | No | Expand grid size |
| Void Technology | No | Unlock Void Cell structure |
| Temporal Acceleration | No | Unlock Overclock upgrade |
| Salvage Operations | No | 75% demolish refund |
| Salvage Master | No | 100% demolish refund |
| Cryogenic Fuel Casing | No | +500°C fuel melt temp |
| Superconductor Technology | No | +1,000°C fuel melt temp |
| Cryogenic Technology | No | Unlock Ice Cube structure |
| Nach mir die Sintflut | No | Sell All cools tiles above 100°C to 100°C |

---

## 9. Progression

### Early Game (~0-1 hour)

1. **Manual clicking** to earn starting money
2. **First fuel rod** - heat generation begins
3. **First ventilator** - learn heat management
4. **First turbine + substation** - passive income starts
5. **First meltdown** - unlocks Exotic Fuel secret
6. **Early upgrades**: Fuel Longevity, Bigger Buttons

### Mid Game (~1-10 hours)

1. **Tier 2 structures** - 10× efficiency jump
2. **Fill the grid** - unlock Reactor Expansion I
3. **Grid expansions** - more space, more power
4. **Key secrets**:
   - Void Technology (survive high heat)
   - Temporal Acceleration (earn 10k money)
   - Salvage Operations (sell 100 structures)
5. **Melt temperature upgrades** - higher heat tolerance

### Late Game (10+ hours)

1. **Tier 3 and 4 structures** - massive scale
2. **Exotic fuel mastery** - temperature-scaling heat
3. **Void cell placement** - strategic heat sinks
4. **Full expansion** to 20×20
5. **Cooling secrets** - Cryogenic + Superconductor
6. **Optimization challenges** - max power/tick

### Endgame

- No explicit win condition
- Infinite progression
- Optimization goals:
  - Maximum power generation
  - Largest stable temperature
  - Fastest money accumulation
  - Exotic fuel reactor designs

---

## 10. Constants Reference

### Core Constants

| Constant | Value |
|----------|-------|
| Starting Money | 0 |
| Tick Interval | 1000ms |
| Initial Grid Size | 16×16 |
| Maximum Grid Size | 20×20 |
| Ambient Temperature | 20°C |
| Environment Heat Loss Rate | 0.05 per edge |

### Economy Constants

| Constant | Value |
|----------|-------|
| Money per Power | 1 |
| Base Demolish Refund | 50% |
| Base Money per Click | 1 |

### Physics Constants

| Constant | Value |
|----------|-------|
| Turbine Activation Temp | 100°C |
| Power per Heat | 0.1 |
| Heat per Adjacent Fuel Rod | +100% |
| Exotic Max Multiplier | 5.0× |
| Exotic Heat Scaling | +0.5× per 1000°C |

### Structure Tier Scaling

| Tier | Cost Multiplier | Stat Multiplier |
|------|-----------------|-----------------|
| T1 | 1× | 1× |
| T2 | 10× | 10× |
| T3 | 100× | 100× |
| T4 | 1,000× | 1,000× |

---

## Appendix: Quick Reference Tables

### All Structures at a Glance

| Structure | T1 Cost | Heat Gen | Heat Dissip | Conductivity | Melt Temp |
|-----------|---------|----------|-------------|--------------|-----------|
| Fuel Rod | 10 | 100/tick | - | 0.3 | 2000°C |
| Ventilator | 10 | - | 5/tick | 0.2 | 200°C |
| Heat Exchanger | 15 | - | - | 0.4 | 400°C |
| Insulator | 8 | - | - | 0.005 | 1000°C |
| Turbine | 25 | - | - | 0.2 | 150°C |
| Substation | 50 | - | - | 0.2 | 80°C |
| Void Cell | 100 | - | 50/tick | 1.0 | ∞ |
| Ice Cube | 5 | - | - | 0.3 | 100°C |

### Turbine/Substation Power Chain

| Tier | Turbine Heat Consumed | Power Generated | Substation Sale Rate |
|------|----------------------|-----------------|---------------------|
| T1 | 10/tick | 1/tick | 1/tick |
| T2 | 100/tick | 10/tick | 10/tick |
| T3 | 1,000/tick | 100/tick | 100/tick |
| T4 | 10,000/tick | 1,000/tick | 1,000/tick |

---

*This document provides complete specifications for rebuilding Heat Game from scratch.*
