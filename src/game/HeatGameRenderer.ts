/**
 * Heat Management Game - UI/Rendering
 */

import {
  HeatGame,
  Cell,
  StructureType,
  Tier,
  GRID_SIZE,
  GameEvent,
} from './HeatGame.js';
import { STRUCTURE_BASE_STATS, getStructureCost } from './BalanceConfig.js';

export interface RenderConfig {
  cellSize: number;
  gridPadding: number;
  showHeatOverlay: boolean;
  showGrid: boolean;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  cellSize: 32,
  gridPadding: 10,
  showHeatOverlay: true,
  showGrid: true,
};

// Color mapping for structures
const STRUCTURE_COLORS: Record<StructureType, string> = {
  [StructureType.Empty]: '#2a2a2a',
  [StructureType.FuelRod]: '#ff6b00',
  [StructureType.Ventilator]: '#00aaff',
  [StructureType.HeatExchanger]: '#ffaa00',
  [StructureType.Insulator]: '#888888',
  [StructureType.Turbine]: '#aa00ff',
  [StructureType.Substation]: '#ffff00',
  [StructureType.VoidCell]: '#000066',
};

// Structure symbols for simple rendering
const STRUCTURE_SYMBOLS: Record<StructureType, string> = {
  [StructureType.Empty]: '',
  [StructureType.FuelRod]: 'F',
  [StructureType.Ventilator]: 'V',
  [StructureType.HeatExchanger]: 'X',
  [StructureType.Insulator]: 'I',
  [StructureType.Turbine]: 'T',
  [StructureType.Substation]: 'S',
  [StructureType.VoidCell]: '⚫',
};

export type CellClickHandler = (x: number, y: number, button: number) => void;

export class HeatGameRenderer {
  private game: HeatGame;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private selectedStructure: StructureType = StructureType.FuelRod;
  private selectedTier: Tier = Tier.T1;
  private cellClickHandler: CellClickHandler | null = null;

  // UI elements
  private uiContainer: HTMLElement | null = null;
  private moneyDisplay: HTMLElement | null = null;
  private statsDisplay: HTMLElement | null = null;
  private buildMenu: HTMLElement | null = null;

  constructor(game: HeatGame, canvas: HTMLCanvasElement, config: Partial<RenderConfig> = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }

    this.game = game;
    this.canvas = canvas;
    this.ctx = ctx;
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };

    this.setupCanvas();
    this.setupEventListeners();
    this.setupGameEventListeners();
  }

  private setupCanvas(): void {
    const gridSize = this.game.getGridSize();
    const totalSize = gridSize * this.config.cellSize + this.config.gridPadding * 2;
    this.canvas.width = totalSize;
    this.canvas.height = totalSize;
    this.canvas.style.cursor = 'pointer';
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
    this.canvas.addEventListener('contextmenu', this.handleCanvasRightClick.bind(this));
    this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
  }

  private setupGameEventListeners(): void {
    this.game.addEventListener((event: GameEvent) => {
      if (event.type === 'meltdown') {
        this.showMeltdownAnimation();
      } else if (event.type === 'grid_expanded') {
        this.setupCanvas();
      }
    });
  }

  private getCellFromPosition(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left - this.config.gridPadding;
    const canvasY = clientY - rect.top - this.config.gridPadding;

    const gridSize = this.game.getGridSize();
    const cellX = Math.floor(canvasX / this.config.cellSize);
    const cellY = Math.floor(canvasY / this.config.cellSize);

    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
      return { x: cellX, y: cellY };
    }
    return null;
  }

  private handleCanvasClick(event: MouseEvent): void {
    const cell = this.getCellFromPosition(event.clientX, event.clientY);
    if (cell && this.cellClickHandler) {
      this.cellClickHandler(cell.x, cell.y, 0);
    }
  }

  private handleCanvasRightClick(event: MouseEvent): void {
    event.preventDefault();
    const cell = this.getCellFromPosition(event.clientX, event.clientY);
    if (cell && this.cellClickHandler) {
      this.cellClickHandler(cell.x, cell.y, 2);
    }
  }

  private handleCanvasMouseMove(event: MouseEvent): void {
    const cell = this.getCellFromPosition(event.clientX, event.clientY);
    // Could be used for hover effects
    if (cell) {
      this.canvas.title = this.getCellTooltip(cell.x, cell.y);
    }
  }

  private getCellTooltip(x: number, y: number): string {
    const cell = this.game.getCell(x, y);
    if (!cell) return '';

    const stats = STRUCTURE_BASE_STATS[cell.structure];
    const lines = [
      `Position: (${x}, ${y})`,
      `Structure: ${stats.name}`,
      `Tier: T${cell.tier}`,
      `Heat: ${cell.heat.toFixed(1)}°C / ${stats.meltTemp}°C`,
    ];

    if (cell.structure === StructureType.FuelRod) {
      lines.push(`Lifetime: ${cell.lifetime} ticks`);
      if (cell.isExotic) {
        lines.push('(Exotic)');
      }
    }

    if (cell.power > 0) {
      lines.push(`Power: ${cell.power.toFixed(2)}`);
    }

    return lines.join('\n');
  }

  // Public API for setting click handler
  onCellClick(handler: CellClickHandler): void {
    this.cellClickHandler = handler;
  }

  setSelectedStructure(structure: StructureType): void {
    this.selectedStructure = structure;
  }

  getSelectedStructure(): StructureType {
    return this.selectedStructure;
  }

  setSelectedTier(tier: Tier): void {
    this.selectedTier = tier;
  }

  getSelectedTier(): Tier {
    return this.selectedTier;
  }

  // Main render method
  render(): void {
    this.clearCanvas();
    this.renderGrid();
    this.renderStructures();

    if (this.config.showHeatOverlay) {
      this.renderHeatOverlay();
    }

    this.renderUI();
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderGrid(): void {
    if (!this.config.showGrid) return;

    const { cellSize, gridPadding } = this.config;
    const gridSize = this.game.getGridSize();

    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= gridSize; x++) {
      this.ctx.beginPath();
      this.ctx.moveTo(gridPadding + x * cellSize, gridPadding);
      this.ctx.lineTo(gridPadding + x * cellSize, gridPadding + gridSize * cellSize);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= gridSize; y++) {
      this.ctx.beginPath();
      this.ctx.moveTo(gridPadding, gridPadding + y * cellSize);
      this.ctx.lineTo(gridPadding + gridSize * cellSize, gridPadding + y * cellSize);
      this.ctx.stroke();
    }
  }

  private renderStructures(): void {
    const { cellSize, gridPadding } = this.config;
    const grid = this.game.getGridSnapshot();
    const gridSize = this.game.getGridSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.structure === StructureType.Empty) continue;

        const drawX = gridPadding + x * cellSize;
        const drawY = gridPadding + y * cellSize;

        // Draw structure background
        this.ctx.fillStyle = STRUCTURE_COLORS[cell.structure];
        this.ctx.fillRect(drawX + 2, drawY + 2, cellSize - 4, cellSize - 4);

        // Draw tier indicator for T2+
        if (cell.tier > Tier.T1) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `${cellSize * 0.25}px monospace`;
          this.ctx.textAlign = 'right';
          this.ctx.textBaseline = 'top';
          this.ctx.fillText(`T${cell.tier}`, drawX + cellSize - 4, drawY + 4);
        }

        // Draw structure symbol
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${cellSize * 0.5}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
          STRUCTURE_SYMBOLS[cell.structure],
          drawX + cellSize / 2,
          drawY + cellSize / 2
        );

        // Draw depleted indicator for fuel rods
        if (cell.structure === StructureType.FuelRod && cell.lifetime <= 0) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          this.ctx.fillRect(drawX + 2, drawY + 2, cellSize - 4, cellSize - 4);
          this.ctx.fillStyle = '#666666';
          this.ctx.fillText('⌛', drawX + cellSize / 2, drawY + cellSize / 2);
        }
      }
    }
  }

  private renderHeatOverlay(): void {
    const { cellSize, gridPadding } = this.config;
    const grid = this.game.getGridSnapshot();
    const gridSize = this.game.getGridSize();

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.heat <= 0) continue;

        const stats = STRUCTURE_BASE_STATS[cell.structure];
        const heatRatio = Math.min(cell.heat / stats.meltTemp, 1);

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

  private renderUI(): void {
    // Render on-canvas UI elements (money display in corner)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    const money = this.game.getMoney();
    const meltdowns = this.game.getMeltdownCount();

    this.ctx.fillText(`Money: €${money.toFixed(0)}`, 5, 5);
    this.ctx.fillText(`Meltdowns: ${meltdowns}`, 5, 22);
  }

  // Create HTML UI elements
  createUI(container: HTMLElement): void {
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

  private createBuildMenu(): void {
    if (!this.buildMenu) return;

    const buildableStructures = [
      StructureType.FuelRod,
      StructureType.Ventilator,
      StructureType.HeatExchanger,
      StructureType.Insulator,
      StructureType.Turbine,
      StructureType.Substation,
    ];

    for (const structure of buildableStructures) {
      const stats = STRUCTURE_BASE_STATS[structure];
      const cost = getStructureCost(structure, Tier.T1);
      const button = document.createElement('button');
      button.textContent = `${STRUCTURE_SYMBOLS[structure]} ${stats.name} (€${cost})`;
      button.addEventListener('click', () => {
        this.setSelectedStructure(structure);
        this.updateBuildMenuSelection();
      });
      button.dataset.structure = structure;
      this.buildMenu.appendChild(button);
    }
  }

  private updateBuildMenuSelection(): void {
    if (!this.buildMenu) return;

    const buttons = this.buildMenu.querySelectorAll('button');
    buttons.forEach(button => {
      const isSelected = button.dataset.structure === this.selectedStructure;
      button.classList.toggle('selected', isSelected);
    });
  }

  updateUI(): void {
    if (this.moneyDisplay) {
      this.moneyDisplay.textContent = `Money: €${this.game.getMoney().toFixed(0)}`;
    }

    if (this.statsDisplay) {
      const stats = this.game.getStats();
      this.statsDisplay.innerHTML = `
        <div>Total Power: ${this.game.getTotalPowerGenerated().toFixed(1)}</div>
        <div>Total Earned: €${this.game.getTotalMoneyEarned().toFixed(0)}</div>
        <div>Meltdowns: ${stats.meltdownCount}</div>
        <div>Ticks: ${stats.tickCount}</div>
        <div>Clicks: ${stats.manualClicks}</div>
      `;
    }
  }

  private showMeltdownAnimation(): void {
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
      } else {
        this.render();
      }

      flashes++;
    }, 100);
  }

  // Configuration
  setConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupCanvas();
  }

  getConfig(): RenderConfig {
    return { ...this.config };
  }
}
