# Nucular Increment - Game Design Document

A nuclear reactor management incremental/idle game where players build and manage heat generation, transfer, and power production systems.

*This document provides rough suggestions for building "Nucular Increment". Implementation details, exact values, and wording are left to the development team.*

---

## Table of Contents

1. [Core Concept](#1-core-concept)
2. [Grid System](#2-grid-system)
3. [Cell Visuals](#3-cell-visuals)
4. [Structures](#4-structures)
5. [Heat Physics](#5-heat-physics)
6. [Power Generation & Economy](#6-power-generation--economy)
7. [Upgrades](#7-upgrades)
8. [Secrets & Achievements](#8-secrets--achievements)
9. [Progression](#9-progression)

---

## 1. Core Concept

**Nucular Increment** is an incremental reactor management game. Players place structures on a grid to:
- Generate heat (fuel rods)
- Transfer heat (heat exchangers)
- Dissipate heat (ventilators)
- Convert heat to power (turbines)
- Sell power for €€ (substations)

The core tension: **more heat = more power = more risk of meltdown**.

### Design Pillars

1. **Heat as Core Resource** - Heat flows through the grid following simplified physics rules
2. **Risk vs Reward** - Higher temperatures yield more power but risk structure meltdowns
3. **Accessible Progression** - Tiers cost 10× more but are only ~5× stronger, keeping earlier tiers relevant
4. **Never Stuck** - Players should always be able to rebuild and recover; meltdowns are learning opportunities

---

## 2. Grid System

### Grid Properties

| Property | Suggestion |
|----------|------------|
| Starting Size | 8×8 |
| Maximum Size | 16×16 (after all expansions) |
| Neighbor System | 4-directional (no diagonals) |
| Initial Temperature | 20°C |
| Minimum Temperature | 0°C |

### Grid Expansion

Grid can be expanded through upgrades or secrets. Suggested progression from 8×8 up to 16×16 in increments (e.g., 8→10→12→14→16, or similar).

**Suggested unlock**: Fill the current grid with structures to unlock the next expansion.

### Closed System

The reactor is a closed system - there is no environmental heat loss at edges. Heat only leaves through ventilators, turbines, or other player-placed structures.

### Starting Configuration

The game begins with a pre-built starter setup and 0 €€:

```
        [INS]
[INS]   [   ]   [TUR] → [SUB]
        [INS]
```

- 3 Insulators surround an empty cell
- 1 Turbine on the 4th side
- 1 Substation behind the turbine

The player must manually generate 10 €€ to place their first fuel rod in the empty cell. This teaches the core loop: fuel rod heats up → turbine converts heat → substation earns €€.

---

## 3. Cell Visuals

All cells are exactly square and the same size.

### Cell Layout

Each cell displays information through edge bars and background color:

```
        ┌─────────────────────┐
        │   [TOP BAR]         │
        │   Efficiency/Status │
┌───┐   ├─────────────────────┤   ┌───┐
│   │   │                     │   │   │
│ L │   │                     │   │ R │
│ E │   │      CELL           │   │ I │
│ F │   │      CONTENT        │   │ G │
│ T │   │                     │   │ H │
│   │   │                     │   │ T │
└───┘   ├─────────────────────┤   └───┘
        │   [BOTTOM BAR]      │
        │   Temperature Delta │
        └─────────────────────┘
```

### Edge Bars

| Position | Shows | Description |
|----------|-------|-------------|
| **Right** | Temperature | Bar from 0°C to structure's melt temperature. Only shown for non-empty cells. |
| **Top** | Efficiency/Capacity | Structure-specific status indicator (see below) |
| **Bottom** | Temperature Delta | Heat change from last tick. Center = no change, left = cooling, right = heating |
| **Left** | (Reserved) | Currently unused. May be used for future features. |

### Top Bar (Efficiency/Capacity) by Structure

| Structure | Top Bar Shows |
|-----------|---------------|
| Fuel Rod | Lifetime remaining (100% = fresh, 0% = depleted) |
| Turbine | Conversion efficiency (0% = idle/too cold, 100% = full capacity) |
| Ventilator | Cooling efficiency (% of max heat dissipation being used) |
| Substation | Power throughput (% of sale capacity being used) |
| Heat Exchanger | Heat flow rate (% of max transfer occurring) |
| Insulator | Heat blocked (% of potential transfer being blocked) |
| Void Cell | Heat absorption (% of capacity being used) |
| Ice Cube | Integrity (100% = solid, decreases as it heats toward melt) |

### Background Color

Cell background uses HSL color model to convey multiple data points simultaneously:

| Component | Maps To | Details |
|-----------|---------|---------|
| **Hue** | Structure type | Each structure type has a distinct hue |
| **Lightness** | Temperature | Logarithmic scale: darker = colder, lighter = hotter |
| **Saturation** | Tier level | Higher tier = more saturated color |

**Temperature to Lightness mapping** (logarithmic):
- 0°C → 0.2 (dark)
- 100°C → 0.4
- 1000°C → 0.6 (bright)
- Higher temperatures continue the logarithmic progression

**Empty cells**: Display temperature as grayscale only (no hue or saturation).

### Hover Details

When hovering over a cell, display concise information **inside the cell**:

**All cells show:**
- Current temperature (in °C)
- Temperature delta from last tick
- Tier as Roman numeral (I, II, III, IV)
- Lifetime production stat (structure-specific)

**Lifetime production by structure:**

| Structure | Lifetime Stat |
|-----------|---------------|
| Fuel Rod | Heat generated |
| Turbine | Power generated |
| Substation | €€ earned |
| Ventilator | Heat dissipated |
| Heat Exchanger | Heat transferred |
| Insulator | Heat blocked |
| Void Cell | Heat absorbed |
| Ice Cube | (shows integrity %) |
| Residues | Ticks until decay |

---

## 4. Structures

### Structure Overview

| Structure | Purpose | Tiers | Secret |
|-----------|---------|-------|--------|
| Fuel Rod | Generates heat | T1-T4 | No |
| Ventilator | Dissipates heat (down to 20°C) | T1-T4 | No |
| Heat Exchanger | Transfers heat faster between cells | T1-T4 | No |
| Insulator | Blocks heat transfer | T1-T4 | No |
| Turbine | Converts heat to power | T1-T4 | No |
| Substation | Sells power for €€ | T1-T4 | No |
| Void Cell | Extreme heat sink | T1 only | Yes |
| Ice Cube | Emergency cooling (leaves water when melted) | T1 only | Yes |

### Tier Scaling

- Each tier costs approximately **10× more** than the previous
- Each tier is approximately **5× stronger** than the previous
- This keeps lower tiers somewhat relevant and creates interesting cost/benefit decisions

### Tier 1 Costs

| Structure | T1 Cost |
|-----------|---------|
| Fuel Rod | 10 €€ |
| Insulator | 5 €€ |
| Ventilator | 15 €€ |
| Heat Exchanger | 15 €€ |
| Turbine | 25 €€ |
| Substation | 50 €€ |

### Tier 1 Melt Temperatures

| Structure | T1 Melt Temp |
|-----------|--------------|
| Fuel Rod | 2000°C |
| Insulator | 1500°C |
| Heat Exchanger | 800°C |
| Turbine | 300°C |
| Ventilator | 100°C |
| Substation | 80°C |

Special cases:
- **Void Cell** - Cannot melt
- **Ice Cube** - Intentionally melts at low temperature

### Structure Behaviors

#### Fuel Rod
- Generates heat each tick based on tier
- Has finite lifetime before depletion
- **Adjacency bonus**: Fuel rods next to other fuel rods generate more heat (suggested: +100% per adjacent fuel rod)
- **Exotic Variant** (secret): Heat generation scales with current temperature

#### Ventilator
- Removes heat from its cell each tick
- Reduces temperature toward 20°C (ambient)

#### Heat Exchanger
- High conductivity - spreads heat quickly between neighboring cells
- No special effect beyond fast heat transfer

#### Insulator
- Very low conductivity - blocks most heat transfer
- Creates thermal isolation barriers

#### Turbine
- Converts heat above a threshold (suggested: 100°C) into power
- Transfers power to adjacent substations

#### Substation
- Sells stored power for €€
- Should be the most fragile structure to create interesting placement challenges

#### Void Cell (Secret)
- Extreme heat dissipation
- Very high conductivity (pulls heat from neighbors aggressively)
- Cannot melt - perfect for extreme heat zones

#### Ice Cube (Secret)
- When it melts, cools the tile significantly (suggested: to 0°C)
- Leaves water after melting (not slag)
- Perfect for emergency cooling situations

### Residues

When structures melt, they may leave temporary residue:
- **Molten Slag** - Left by most melted structures, decays over time
- **Plasma** - Left by exotic fuel at extreme temperatures, longer decay
- **Water** - Left by melted ice cubes

Residues cannot be removed by the player and must decay naturally.

---

## 5. Heat Physics

### Core Principle

Heat transfer should be **simple enough for players to understand and plan around**. This is the core game mechanic - players need to intuitively grasp how heat will flow to make strategic decisions.

### Heat Transfer

Heat transfers between adjacent cells based on their conductivity values. Higher conductivity = faster heat transfer.

Suggested conductivity ordering (highest to lowest):
1. Void Cell, Plasma (maximum)
2. Heat Exchanger (very high)
3. Molten Slag (moderate)
4. Fuel Rod, Turbine, Ventilator, Substation (normal)
5. Empty cell (low)
6. Insulator (very low)

The exact formula is left to the development team. Consider offering different heat exchange algorithms in options to experiment with what feels most fun.

### Meltdown Mechanics

When a structure's temperature exceeds its melt temperature:
1. Structure is destroyed
2. Appropriate residue is created (slag, plasma, or water)
3. Heat is preserved on the residue
4. Residue decays after some ticks, leaving an empty cell

Structures melt individually - there is no grid-clearing meltdown event.

---

## 6. Power Generation & Economy

### Power Flow

```
Fuel Rod (heat) → Turbine (power) → Substation (€€)
```

### Turbine Behavior

- Only activates when cell temperature exceeds a threshold
- Consumes heat and converts it to power
- Transfers power to adjacent substations

### Substation Behavior

- Sells stored power for €€
- Sale rate depends on tier

### Manual Power Generation

Players can manually generate €€ through direct interaction (clicking, tapping, etc.). This provides early-game income before automation is established.

The exact wording and presentation is left to the development team.

### Recycle Mechanic

Players can recycle (remove) placed structures to recover a portion of their cost.

Suggested progression:
- Base refund: ~50%
- With upgrades/secrets: Up to 100%

---

## 7. Upgrades

### Upgrade Philosophy

Upgrades provide permanent improvements. Cost should scale exponentially while benefits scale linearly, creating meaningful progression decisions.

### Suggested Upgrade Categories

For each structure type, consider upgrades for:
- **Efficiency** - Better at their main function
- **Durability** - Higher melt temperature
- **Special effects** - Unique bonuses

### Global Upgrades (Suggestions)

- **Fuel Longevity** - Fuel rods last longer
- **Improved Cooling** - Ventilators dissipate more heat
- **Power Grid** - Substations sell power faster
- **Tick Speed** - Game runs faster (requires secret unlock)
- **Manual Generation** - Manual power generation gives more €€
- **Better Recycling** - Higher refund when recycling structures

Exact names, costs, and values are left to the development team.

---

## 8. Secrets & Achievements

Secrets are hidden features unlocked by meeting certain conditions. Once unlocked, they typically require a purchase to activate.

### Suggested Secrets

| Secret | Unlock Condition (Suggestion) |
|--------|------------------------------|
| Exotic Fuel | First structure melts |
| Grid Expansions | Fill current grid completely |
| Void Technology | Survive with fuel rod at high heat for extended time |
| Faster Ticks | Earn threshold amount of €€ |
| Better Recycling | Recycle many structures |
| Ice Technology | Heat entire grid to threshold temperature |
| Cooling Mastery | Deplete fuel rods while keeping them cool |

### Toggleable Secrets

Some secrets (like Exotic Fuel) should be toggleable - players can enable/disable the feature after purchase.

### Open for Expansion

The development team is encouraged to add new secrets if they have good ideas that fit the game's design pillars.

---

## 9. Progression

*All progression suggestions are guidelines. Players should be encouraged to find alternative paths, but should always be able to guess where a possible next step could be.*

### Early Game

1. Start with pre-built setup (insulators + turbine + substation)
2. Manual power generation to earn first 10 €€
3. Place first fuel rod - heat generation begins, passive income starts
4. Expand the starter setup with more structures
5. First meltdown - discover that recovery is possible
6. Early upgrades to improve efficiency

### Mid Game

1. Higher tier structures
2. Fill the grid to unlock expansions
3. Discover and unlock secrets
4. Experiment with exotic fuel
5. Optimize layouts for maximum power

### Late Game

1. Highest tier structures
2. Full grid expansion
3. Secret structures (Void Cell, Ice Cube)
4. Extreme temperature management
5. Optimization challenges

### Endgame

*To be implemented in future updates.*

Planned direction: New Game+ mechanics with bonuses, new structures, and new upgrades in subsequent runs. For initial release, leave the endgame open.

---

## Appendix: Quick Reference

### Structure Summary (Tier 1)

| Structure | T1 Cost | T1 Melt | Purpose |
|-----------|---------|---------|---------|
| Fuel Rod | 10 €€ | 2000°C | Heat generation |
| Insulator | 5 €€ | 1500°C | Heat blocking |
| Ventilator | 15 €€ | 100°C | Heat removal |
| Heat Exchanger | 15 €€ | 800°C | Fast heat transfer |
| Turbine | 25 €€ | 300°C | Heat → Power |
| Substation | 50 €€ | 80°C | Power → €€ |
| Void Cell | (secret) | ∞ | Extreme cooling |
| Ice Cube | (secret) | (low) | Emergency cooling |

### Key Design Points

- Grid: 8×8 starting, expandable to 16×16
- Closed system (no environmental heat loss)
- Tiers: 10× cost, 5× power
- Currency: €€ (double euro)
- Recovery always possible (never stuck)
- Heat physics should be intuitive and plannable

---

*Development team: Feel free to adjust values, names, and mechanics as needed. This document describes the vision and feel of the game - the specifics are yours to refine.*
