/**
 * Heat Management Game - UI/Rendering
 *
 * This class handles all visual presentation:
 * - Grid rendering with heat visualization
 * - Structure sprites/icons
 * - UI panels (money, stats, build menu)
 * - Animations and visual effects
 */
import { StructureType, STRUCTURE_STATS, GRID_SIZE, } from './HeatGame.js';
export const DEFAULT_RENDER_CONFIG = {
    cellSize: 32,
    gridPadding: 10,
    showHeatOverlay: true,
    showGrid: true,
};
// Color mapping for structures
const STRUCTURE_COLORS = {
    [StructureType.Empty]: '#2a2a2a',
    [StructureType.FuelRod]: '#ff6b00',
    [StructureType.Ventilator]: '#00aaff',
    [StructureType.HeatExchanger]: '#ffaa00',
    [StructureType.Battery]: '#00ff88',
    [StructureType.InsulationPlate]: '#888888',
    [StructureType.Turbine]: '#aa00ff',
    [StructureType.Substation]: '#ffff00',
};
// Structure symbols for simple rendering
const STRUCTURE_SYMBOLS = {
    [StructureType.Empty]: '',
    [StructureType.FuelRod]: 'F',
    [StructureType.Ventilator]: 'V',
    [StructureType.HeatExchanger]: 'X',
    [StructureType.Battery]: 'B',
    [StructureType.InsulationPlate]: 'I',
    [StructureType.Turbine]: 'T',
    [StructureType.Substation]: 'S',
};
export class HeatGameRenderer {
    constructor(game, canvas, config = {}) {
        this.selectedStructure = StructureType.FuelRod;
        this.cellClickHandler = null;
        // UI elements
        this.uiContainer = null;
        this.moneyDisplay = null;
        this.statsDisplay = null;
        this.buildMenu = null;
        this.game = game;
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
        this.setupCanvas();
        this.setupEventListeners();
        this.setupGameEventListeners();
    }
    setupCanvas() {
        const totalSize = GRID_SIZE * this.config.cellSize + this.config.gridPadding * 2;
        this.canvas.width = totalSize;
        this.canvas.height = totalSize;
        this.canvas.style.cursor = 'pointer';
    }
    setupEventListeners() {
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleCanvasRightClick.bind(this));
        this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
    }
    setupGameEventListeners() {
        this.game.addEventListener((event) => {
            if (event.type === 'meltdown') {
                this.showMeltdownAnimation();
            }
        });
    }
    getCellFromPosition(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = clientX - rect.left - this.config.gridPadding;
        const canvasY = clientY - rect.top - this.config.gridPadding;
        const cellX = Math.floor(canvasX / this.config.cellSize);
        const cellY = Math.floor(canvasY / this.config.cellSize);
        if (cellX >= 0 && cellX < GRID_SIZE && cellY >= 0 && cellY < GRID_SIZE) {
            return { x: cellX, y: cellY };
        }
        return null;
    }
    handleCanvasClick(event) {
        const cell = this.getCellFromPosition(event.clientX, event.clientY);
        if (cell && this.cellClickHandler) {
            this.cellClickHandler(cell.x, cell.y, 0);
        }
    }
    handleCanvasRightClick(event) {
        event.preventDefault();
        const cell = this.getCellFromPosition(event.clientX, event.clientY);
        if (cell && this.cellClickHandler) {
            this.cellClickHandler(cell.x, cell.y, 2);
        }
    }
    handleCanvasMouseMove(event) {
        const cell = this.getCellFromPosition(event.clientX, event.clientY);
        // Could be used for hover effects
        if (cell) {
            this.canvas.title = this.getCellTooltip(cell.x, cell.y);
        }
    }
    getCellTooltip(x, y) {
        const cell = this.game.getCell(x, y);
        if (!cell)
            return '';
        const stats = STRUCTURE_STATS[cell.structure];
        const lines = [
            `Position: (${x}, ${y})`,
            `Structure: ${cell.structure}`,
            `Heat: ${cell.heat.toFixed(1)} / ${stats.maxHeat}`,
        ];
        if (cell.power > 0) {
            lines.push(`Power: ${cell.power.toFixed(2)}`);
        }
        return lines.join('\n');
    }
    // Public API for setting click handler
    onCellClick(handler) {
        this.cellClickHandler = handler;
    }
    setSelectedStructure(structure) {
        this.selectedStructure = structure;
    }
    getSelectedStructure() {
        return this.selectedStructure;
    }
    // Main render method
    render() {
        this.clearCanvas();
        this.renderGrid();
        this.renderStructures();
        if (this.config.showHeatOverlay) {
            this.renderHeatOverlay();
        }
        this.renderUI();
    }
    clearCanvas() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    renderGrid() {
        if (!this.config.showGrid)
            return;
        const { cellSize, gridPadding } = this.config;
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1;
        // Vertical lines
        for (let x = 0; x <= GRID_SIZE; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(gridPadding + x * cellSize, gridPadding);
            this.ctx.lineTo(gridPadding + x * cellSize, gridPadding + GRID_SIZE * cellSize);
            this.ctx.stroke();
        }
        // Horizontal lines
        for (let y = 0; y <= GRID_SIZE; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(gridPadding, gridPadding + y * cellSize);
            this.ctx.lineTo(gridPadding + GRID_SIZE * cellSize, gridPadding + y * cellSize);
            this.ctx.stroke();
        }
    }
    renderStructures() {
        const { cellSize, gridPadding } = this.config;
        const grid = this.game.getGridSnapshot();
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = grid[y][x];
                if (cell.structure === StructureType.Empty)
                    continue;
                const drawX = gridPadding + x * cellSize;
                const drawY = gridPadding + y * cellSize;
                // Draw structure background
                this.ctx.fillStyle = STRUCTURE_COLORS[cell.structure];
                this.ctx.fillRect(drawX + 2, drawY + 2, cellSize - 4, cellSize - 4);
                // Draw structure symbol
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = `bold ${cellSize * 0.5}px monospace`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(STRUCTURE_SYMBOLS[cell.structure], drawX + cellSize / 2, drawY + cellSize / 2);
            }
        }
    }
    renderHeatOverlay() {
        const { cellSize, gridPadding } = this.config;
        const grid = this.game.getGridSnapshot();
        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const cell = grid[y][x];
                if (cell.heat <= 0)
                    continue;
                const stats = STRUCTURE_STATS[cell.structure];
                const heatRatio = Math.min(cell.heat / stats.maxHeat, 1);
                const drawX = gridPadding + x * cellSize;
                const drawY = gridPadding + y * cellSize;
                // Draw heat as a red overlay with alpha based on heat level
                this.ctx.fillStyle = `rgba(255, 0, 0, ${heatRatio * 0.5})`;
                this.ctx.fillRect(drawX, drawY, cellSize, cellSize);
                // Draw warning border if near max heat
                if (heatRatio > 0.8) {
                    this.ctx.strokeStyle = heatRatio > 0.95 ? '#ff0000' : '#ffaa00';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(drawX + 1, drawY + 1, cellSize - 2, cellSize - 2);
                }
            }
        }
    }
    renderUI() {
        // Render on-canvas UI elements (money display in corner)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        const money = this.game.getMoney();
        const meltdowns = this.game.getMeltdownCount();
        this.ctx.fillText(`Money: ${money.toFixed(0)}`, 5, 5);
        this.ctx.fillText(`Meltdowns: ${meltdowns}`, 5, 22);
    }
    // Create HTML UI elements
    createUI(container) {
        this.uiContainer = container;
        // Money display
        this.moneyDisplay = document.createElement('div');
        this.moneyDisplay.className = 'heat-game-money';
        container.appendChild(this.moneyDisplay);
        // Stats display
        this.statsDisplay = document.createElement('div');
        this.statsDisplay.className = 'heat-game-stats';
        container.appendChild(this.statsDisplay);
        // Build menu
        this.buildMenu = document.createElement('div');
        this.buildMenu.className = 'heat-game-build-menu';
        this.createBuildMenu();
        container.appendChild(this.buildMenu);
    }
    createBuildMenu() {
        if (!this.buildMenu)
            return;
        const buildableStructures = [
            StructureType.FuelRod,
            StructureType.Ventilator,
            StructureType.HeatExchanger,
            StructureType.Battery,
            StructureType.InsulationPlate,
            StructureType.Turbine,
            StructureType.Substation,
        ];
        for (const structure of buildableStructures) {
            const button = document.createElement('button');
            button.textContent = `${STRUCTURE_SYMBOLS[structure]} ${structure} ($${STRUCTURE_STATS[structure].cost})`;
            button.addEventListener('click', () => {
                this.setSelectedStructure(structure);
                this.updateBuildMenuSelection();
            });
            button.dataset.structure = structure;
            this.buildMenu.appendChild(button);
        }
    }
    updateBuildMenuSelection() {
        if (!this.buildMenu)
            return;
        const buttons = this.buildMenu.querySelectorAll('button');
        buttons.forEach(button => {
            const isSelected = button.dataset.structure === this.selectedStructure;
            button.classList.toggle('selected', isSelected);
        });
    }
    updateUI() {
        if (this.moneyDisplay) {
            this.moneyDisplay.textContent = `Money: $${this.game.getMoney().toFixed(0)}`;
        }
        if (this.statsDisplay) {
            this.statsDisplay.innerHTML = `
        <div>Total Power: ${this.game.getTotalPowerGenerated().toFixed(1)}</div>
        <div>Total Earned: $${this.game.getTotalMoneyEarned().toFixed(0)}</div>
        <div>Meltdowns: ${this.game.getMeltdownCount()}</div>
        <div>Ticks: ${this.game.getTickCount()}</div>
      `;
        }
    }
    showMeltdownAnimation() {
        // Flash the canvas red
        const originalFill = this.ctx.fillStyle;
        let flashes = 0;
        const flashInterval = setInterval(() => {
            if (flashes >= 6) {
                clearInterval(flashInterval);
                this.render();
                return;
            }
            if (flashes % 2 === 0) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            else {
                this.render();
            }
            flashes++;
        }, 100);
        this.ctx.fillStyle = originalFill;
    }
    // Configuration
    setConfig(config) {
        this.config = { ...this.config, ...config };
        this.setupCanvas();
    }
    getConfig() {
        return { ...this.config };
    }
}
