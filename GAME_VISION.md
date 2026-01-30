# Heat Management Idle Game - Vision Document

## Concept

A grid-based idle game where players manage heat flow across a 16x16 grid to generate power and money. The core gameplay revolves around balancing heat generation for profit against the risk of meltdown.

## Core Mechanics

### Grid System
- **16x16 grid** of cells
- Each cell exchanges heat with its **4 orthogonal neighbors** (no diagonal heat transfer)
- Heat flows naturally from hot cells to cooler neighbors each tick

### Cell States
- Initially all cells are **empty**
- Players can build structures on cells using earned money

### Buildable Structures

| Structure | Description | Heat Behavior |
|-----------|-------------|---------------|
| **Fuel Rod** | Generates heat constantly | Produces heat; melts on overheat causing MELTDOWN |
| **Ventilator/Cooling** | Removes heat from the cell | Dissipates heat to the environment |
| **Heat Exchanger** | Transfers heat efficiently between neighbors | Increases heat conductivity |
| **Battery** | Stores power | Can overheat and break |
| **Insulation Plate** | Blocks heat transfer | Reduces heat flow to/from neighbors |
| **Turbine** | Converts local heat to power | Consumes heat, produces power; breaks on overheat |
| **Substation** | Collects and sells power | Gathers power from turbines; auto-sells for money |

### Heat Mechanics
- Heat naturally flows from hot to cold cells each tick
- Heat transfer rate depends on:
  - Temperature difference between cells
  - Structure types (insulation blocks, heat exchangers amplify)
- Ambient/environmental temperature acts as a heat sink at grid edges

### Power & Economy
- **Turbines** convert heat into power (more heat = more power, but risk)
- **Substations** collect power and automatically sell it for money
- Money is used to build more structures
- Higher heat = more profit potential, but greater meltdown risk

### Failure States
- **Structure Breakdown**: Individual structures break when overheated (except fuel rods)
- **Meltdown**: When a fuel rod overheats and melts:
  - ALL structures on the grid are destroyed
  - Player keeps their money
  - Player can rebuild from scratch

## Strategic Depth

The fun comes from:
1. **Risk vs Reward**: Running hotter generates more money but risks meltdown
2. **Heat Management**: Strategic placement of cooling, insulation, and heat exchangers
3. **Efficiency Optimization**: Maximizing power output while staying safe
4. **Recovery Planning**: After meltdown, rebuilding smarter with accumulated wealth

## Technical Architecture

### Classes

```
HeatGame (Game Logic)
├── Grid management (16x16 cells)
├── Heat simulation (transfer calculations)
├── Structure management (building, breaking)
├── Power/money economy
└── Meltdown detection and handling

HeatGameRenderer (UI/Rendering)
├── Grid visualization
├── Heat overlay (color gradient)
├── Structure sprites/icons
├── UI panels (money, power, build menu)
└── Animations (heat flow, meltdown)
```

### Game Loop
1. Process heat generation (fuel rods)
2. Calculate heat transfer between cells
3. Convert heat to power (turbines)
4. Collect and sell power (substations)
5. Check for overheating and meltdowns
6. Render updated state

## Future Considerations
- Save/load game state
- Achievements
- Different fuel rod types
- Upgradeable structures
- Challenge modes with specific goals
