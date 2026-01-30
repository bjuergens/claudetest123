/**
 * Heat Management Game - Core Game Logic
 *
 * This class handles all game state and simulation:
 * - 16x16 grid management
 * - Heat transfer calculations
 * - Structure placement and destruction
 * - Power generation and economy
 * - Meltdown detection
 */
export const GRID_SIZE = 16;
export var StructureType;
(function (StructureType) {
    StructureType["Empty"] = "empty";
    StructureType["FuelRod"] = "fuel_rod";
    StructureType["Ventilator"] = "ventilator";
    StructureType["HeatExchanger"] = "heat_exchanger";
    StructureType["Battery"] = "battery";
    StructureType["InsulationPlate"] = "insulation_plate";
    StructureType["Turbine"] = "turbine";
    StructureType["Substation"] = "substation";
})(StructureType || (StructureType = {}));
export const STRUCTURE_STATS = {
    [StructureType.Empty]: {
        maxHeat: Infinity,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 1.0,
        powerGeneration: 0,
        cost: 0,
    },
    [StructureType.FuelRod]: {
        maxHeat: 1000,
        heatGeneration: 50,
        heatDissipation: 0,
        heatConductivity: 1.0,
        powerGeneration: 0,
        cost: 100,
    },
    [StructureType.Ventilator]: {
        maxHeat: 500,
        heatGeneration: 0,
        heatDissipation: 30,
        heatConductivity: 1.0,
        powerGeneration: 0,
        cost: 50,
    },
    [StructureType.HeatExchanger]: {
        maxHeat: 800,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 2.0,
        powerGeneration: 0,
        cost: 75,
    },
    [StructureType.Battery]: {
        maxHeat: 300,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 0.5,
        powerGeneration: 0,
        cost: 150,
    },
    [StructureType.InsulationPlate]: {
        maxHeat: 2000,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 0.1,
        powerGeneration: 0,
        cost: 30,
    },
    [StructureType.Turbine]: {
        maxHeat: 600,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 1.0,
        powerGeneration: 0.1,
        powerConsumption: 20, // Heat consumed to generate power
        cost: 200,
    },
    [StructureType.Substation]: {
        maxHeat: 400,
        heatGeneration: 0,
        heatDissipation: 0,
        heatConductivity: 1.0,
        powerGeneration: 0,
        cost: 250,
    },
};
export class HeatGame {
    constructor(initialMoney = 500) {
        this.eventListeners = [];
        this.state = this.createInitialState(initialMoney);
    }
    createInitialState(initialMoney) {
        const grid = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            const row = [];
            for (let x = 0; x < GRID_SIZE; x++) {
                row.push({
                    x,
                    y,
                    structure: StructureType.Empty,
                    heat: 0,
                    power: 0,
                });
            }
            grid.push(row);
        }
        return {
            grid,
            money: initialMoney,
            totalPowerGenerated: 0,
            totalMoneyEarned: 0,
            meltdownCount: 0,
            tickCount: 0,
        };
    }
    // Event system
    addEventListener(listener) {
        this.eventListeners.push(listener);
    }
    removeEventListener(listener) {
        const index = this.eventListeners.indexOf(listener);
        if (index !== -1) {
            this.eventListeners.splice(index, 1);
        }
    }
    emitEvent(event) {
        for (const listener of this.eventListeners) {
            listener(event);
        }
    }
    // Getters for game state (read-only access)
    getCell(x, y) {
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
            return null;
        }
        return { ...this.state.grid[y][x] };
    }
    getMoney() {
        return this.state.money;
    }
    getTickCount() {
        return this.state.tickCount;
    }
    getMeltdownCount() {
        return this.state.meltdownCount;
    }
    getTotalPowerGenerated() {
        return this.state.totalPowerGenerated;
    }
    getTotalMoneyEarned() {
        return this.state.totalMoneyEarned;
    }
    getGridSnapshot() {
        return this.state.grid.map(row => row.map(cell => ({ ...cell })));
    }
    // Building structures
    canBuild(x, y, structure) {
        const cell = this.getCell(x, y);
        if (!cell)
            return false;
        if (cell.structure !== StructureType.Empty)
            return false;
        const cost = STRUCTURE_STATS[structure].cost;
        return this.state.money >= cost;
    }
    build(x, y, structure) {
        if (!this.canBuild(x, y, structure))
            return false;
        const cost = STRUCTURE_STATS[structure].cost;
        this.state.money -= cost;
        this.state.grid[y][x].structure = structure;
        this.emitEvent({
            type: 'structure_built',
            x,
            y,
            structure,
        });
        return true;
    }
    // Remove a structure (refunds nothing)
    demolish(x, y) {
        const cell = this.getCell(x, y);
        if (!cell || cell.structure === StructureType.Empty)
            return false;
        const oldStructure = this.state.grid[y][x].structure;
        this.state.grid[y][x].structure = StructureType.Empty;
        this.state.grid[y][x].heat = 0;
        this.state.grid[y][x].power = 0;
        this.emitEvent({
            type: 'structure_destroyed',
            x,
            y,
            structure: oldStructure,
        });
        return true;
    }
    // Get neighbors for heat transfer
    getNeighbors(x, y) {
        const neighbors = [];
        const directions = [
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 }, // down
            { dx: -1, dy: 0 }, // left
            { dx: 1, dy: 0 }, // right
        ];
        for (const { dx, dy } of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                neighbors.push(this.state.grid[ny][nx]);
            }
        }
        return neighbors;
    }
    // Main game tick - processes one frame of simulation
    tick() {
        this.state.tickCount++;
        // Phase 1: Heat generation (fuel rods)
        this.processHeatGeneration();
        // Phase 2: Heat transfer between cells
        this.processHeatTransfer();
        // Phase 3: Heat dissipation (ventilators)
        this.processHeatDissipation();
        // Phase 4: Power generation (turbines)
        this.processPowerGeneration();
        // Phase 5: Power collection and sale (substations)
        this.processPowerSale();
        // Phase 6: Check for overheating and meltdowns
        this.processOverheating();
    }
    processHeatGeneration() {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                const stats = STRUCTURE_STATS[cell.structure];
                cell.heat += stats.heatGeneration;
            }
        }
    }
    processHeatTransfer() {
        // Calculate heat deltas first, then apply (to avoid order-dependent results)
        const heatDeltas = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            heatDeltas.push(new Array(GRID_SIZE).fill(0));
        }
        const transferRate = 0.1; // Base heat transfer rate
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                const cellStats = STRUCTURE_STATS[cell.structure];
                const neighbors = this.getNeighbors(x, y);
                for (const neighbor of neighbors) {
                    const neighborStats = STRUCTURE_STATS[neighbor.structure];
                    const heatDiff = cell.heat - neighbor.heat;
                    // Heat flows from hot to cold
                    if (heatDiff > 0) {
                        const conductivity = Math.min(cellStats.heatConductivity, neighborStats.heatConductivity);
                        const transfer = heatDiff * transferRate * conductivity;
                        heatDeltas[y][x] -= transfer;
                        heatDeltas[neighbor.y][neighbor.x] += transfer;
                    }
                }
                // Edge cells lose heat to environment
                const edgeCount = 4 - neighbors.length;
                if (edgeCount > 0 && cell.heat > 0) {
                    const envTransfer = cell.heat * transferRate * 0.5 * edgeCount;
                    heatDeltas[y][x] -= envTransfer;
                }
            }
        }
        // Apply deltas
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                this.state.grid[y][x].heat = Math.max(0, this.state.grid[y][x].heat + heatDeltas[y][x]);
            }
        }
    }
    processHeatDissipation() {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                const stats = STRUCTURE_STATS[cell.structure];
                cell.heat = Math.max(0, cell.heat - stats.heatDissipation);
            }
        }
    }
    processPowerGeneration() {
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                if (cell.structure === StructureType.Turbine && cell.heat > 0) {
                    const stats = STRUCTURE_STATS[cell.structure];
                    const heatConsumed = Math.min(cell.heat, 20); // Consume up to 20 heat
                    const powerGenerated = heatConsumed * stats.powerGeneration;
                    cell.heat -= heatConsumed;
                    cell.power += powerGenerated;
                    this.state.totalPowerGenerated += powerGenerated;
                }
            }
        }
    }
    processPowerSale() {
        const powerPrice = 10; // Money per power unit
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                // Turbines transfer power to nearby substations
                if (cell.structure === StructureType.Turbine && cell.power > 0) {
                    const neighbors = this.getNeighbors(x, y);
                    for (const neighbor of neighbors) {
                        if (neighbor.structure === StructureType.Substation) {
                            this.state.grid[neighbor.y][neighbor.x].power += cell.power;
                            cell.power = 0;
                            break;
                        }
                    }
                }
                // Substations sell power automatically
                if (cell.structure === StructureType.Substation && cell.power > 0) {
                    const earnings = cell.power * powerPrice;
                    this.state.money += earnings;
                    this.state.totalMoneyEarned += earnings;
                    this.emitEvent({
                        type: 'power_sold',
                        x,
                        y,
                        amount: earnings,
                    });
                    cell.power = 0;
                }
            }
        }
    }
    processOverheating() {
        let meltdown = false;
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = this.state.grid[y][x];
                if (cell.structure === StructureType.Empty)
                    continue;
                const stats = STRUCTURE_STATS[cell.structure];
                if (cell.heat > stats.maxHeat) {
                    if (cell.structure === StructureType.FuelRod) {
                        // Fuel rod meltdown - catastrophic failure
                        meltdown = true;
                    }
                    else {
                        // Regular structure breaks
                        this.demolish(x, y);
                    }
                }
            }
        }
        if (meltdown) {
            this.triggerMeltdown();
        }
    }
    triggerMeltdown() {
        this.state.meltdownCount++;
        // Destroy all structures but keep money
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                this.state.grid[y][x].structure = StructureType.Empty;
                this.state.grid[y][x].heat = 0;
                this.state.grid[y][x].power = 0;
            }
        }
        this.emitEvent({ type: 'meltdown' });
    }
    // Serialization for save/load
    serialize() {
        return JSON.stringify(this.state);
    }
    static deserialize(data) {
        const state = JSON.parse(data);
        const game = new HeatGame(0);
        game.state = state;
        return game;
    }
}
