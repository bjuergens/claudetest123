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
  CellPerformance,
  TickHeatBalance,
  UpgradeType,
  SecretUpgradeType,
} from './HeatGame.js';
import {
  STRUCTURE_BASE_STATS,
  getStructureCost,
  UPGRADE_DEFINITIONS,
  SECRET_UPGRADE_DEFINITIONS,
} from './BalanceConfig.js';

/**
 * HSV to RGB conversion
 * h: 0-360, s: 0-1, v: 0-1
 * Returns rgb string like 'rgb(r, g, b)'
 */
function hsvToRgb(h: number, s: number, v: number): string {
  h = h % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return `rgb(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)})`;
}

/**
 * Structure type to hue mapping
 * Each structure type gets a distinct hue
 */
const STRUCTURE_HUES: Record<StructureType, number> = {
  [StructureType.Empty]: 0,       // N/A
  [StructureType.FuelRod]: 25,    // Orange
  [StructureType.Ventilator]: 200, // Cyan
  [StructureType.HeatExchanger]: 40, // Gold
  [StructureType.Insulator]: 0,   // Gray (low saturation)
  [StructureType.Turbine]: 280,   // Purple
  [StructureType.Substation]: 60, // Yellow
  [StructureType.VoidCell]: 230,  // Dark blue
};

/**
 * Get HSV-based color for a structure based on type and tier
 */
function getStructureHsvColor(structure: StructureType, tier: Tier): string {
  if (structure === StructureType.Empty) {
    return '#2a2a2a';
  }

  const hue = STRUCTURE_HUES[structure];
  // Saturation increases with tier: T1=0.5, T2=0.6, T3=0.7, T4=0.8
  const saturation = structure === StructureType.Insulator ? 0.1 : 0.5 + (tier - 1) * 0.1;
  // Value is constant at 0.7 for good visibility
  const value = 0.7;

  return hsvToRgb(hue, saturation, value);
}

/**
 * Sigmoid-like function for heat exchange visualization
 * Uses tanh to map values to -1 to 1 range with good sensitivity near 0
 * Scale factor determines sensitivity (higher = more sensitive to small values)
 */
function heatExchangeSigmoid(value: number, scale: number = 0.05): number {
  return Math.tanh(value * scale);
}

export interface RenderConfig {
  cellSize: number;
  gridPadding: number;
  showHeatOverlay: boolean;
  showGrid: boolean;
}

export interface UIOptions {
  onResetSave?: () => void;
  onPauseToggle?: (paused: boolean) => void;
  isPaused?: () => boolean;
  buildVersion?: string;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  cellSize: 32,
  gridPadding: 10,
  showHeatOverlay: true,
  showGrid: true,
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

  // Per-structure tier selection
  private structureTiers: Map<StructureType, Tier> = new Map();

  // UI elements
  private uiContainer: HTMLElement | null = null;
  private moneyDisplay: HTMLElement | null = null;
  private manualClickButton: HTMLButtonElement | null = null;
  private statsDisplay: HTMLElement | null = null;
  private buildMenu: HTMLElement | null = null;
  private upgradeMenu: HTMLElement | null = null;
  private secretMenu: HTMLElement | null = null;
  private optionsMenu: HTMLElement | null = null;
  private uiOptions: UIOptions = {};

  // Build button references for updating affordability
  private buildButtons: Map<StructureType, HTMLButtonElement> = new Map();
  // Cache for build button state to avoid unnecessary DOM updates
  private buildButtonCache: Map<StructureType, { tier: Tier; cost: number; canAfford: boolean; effectiveStat: string }> = new Map();

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

    // Bar dimensions
    const barWidth = Math.max(3, cellSize * 0.12);  // Right temperature bar width
    const barHeight = Math.max(2, cellSize * 0.08); // Top/bottom bar height
    const barPadding = 2;

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = grid[y][x];
        if (cell.structure === StructureType.Empty) continue;

        const drawX = gridPadding + x * cellSize;
        const drawY = gridPadding + y * cellSize;

        // Draw structure background with HSV color based on type and tier
        this.ctx.fillStyle = getStructureHsvColor(cell.structure, cell.tier);
        this.ctx.fillRect(drawX + 2, drawY + 2, cellSize - 4, cellSize - 4);

        // Get cell performance data
        const perf = this.game.getCellPerformance(x, y);

        // Draw top bar (lifetime for fuel, performance for turbine/substation)
        this.renderTopBar(cell, perf, drawX, drawY, cellSize, barHeight, barPadding);

        // Draw right temperature bar (thermometer)
        this.renderTempBar(cell, drawX, drawY, cellSize, barWidth, barPadding);

        // Draw bottom heat exchange bar
        this.renderHeatExchangeBar(perf, drawX, drawY, cellSize, barHeight, barPadding);

        // Draw tier indicator for T2+
        if (cell.tier > Tier.T1) {
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = `${cellSize * 0.22}px monospace`;
          this.ctx.textAlign = 'left';
          this.ctx.textBaseline = 'top';
          this.ctx.fillText(`T${cell.tier}`, drawX + 4, drawY + barHeight + barPadding + 2);
        }

        // Draw structure symbol (slightly offset up to make room for bottom bar)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${cellSize * 0.4}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(
          STRUCTURE_SYMBOLS[cell.structure],
          drawX + cellSize / 2 - barWidth / 2,
          drawY + cellSize / 2
        );

        // Draw depleted indicator for fuel rods
        if (cell.structure === StructureType.FuelRod && cell.lifetime <= 0) {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          this.ctx.fillRect(drawX + 2, drawY + 2, cellSize - 4, cellSize - 4);
          this.ctx.fillStyle = '#666666';
          this.ctx.font = `bold ${cellSize * 0.4}px monospace`;
          this.ctx.fillText('⌛', drawX + cellSize / 2, drawY + cellSize / 2);
        }
      }
    }
  }

  /**
   * Render top bar showing lifetime (fuel) or performance (turbine/substation)
   */
  private renderTopBar(
    cell: Cell,
    perf: CellPerformance | null,
    drawX: number,
    drawY: number,
    cellSize: number,
    barHeight: number,
    barPadding: number
  ): void {
    const barX = drawX + barPadding + 2;
    const barY = drawY + barPadding + 2;
    const barWidth = cellSize - barPadding * 2 - 4;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    let fillRatio = 0;
    let fillColor = '#00ff00';

    if (cell.structure === StructureType.FuelRod && cell.lifetime > 0 && perf) {
      // Fuel rod: show lifetime remaining
      const maxLifetime = perf.initialLifetime > 0 ? perf.initialLifetime : 1;
      fillRatio = cell.lifetime / maxLifetime;
      // Color gradient from green (full) to red (depleted)
      fillColor = fillRatio > 0.5 ? '#00ff00' : fillRatio > 0.25 ? '#ffff00' : '#ff6600';
    } else if (cell.structure === StructureType.Turbine && perf) {
      // Turbine: show power generation performance
      const baseStats = STRUCTURE_BASE_STATS[StructureType.Turbine];
      const maxHeatConsumption = baseStats.maxHeatConsumption * Math.pow(10, cell.tier - 1);
      const maxPower = maxHeatConsumption * baseStats.powerGeneration;
      fillRatio = maxPower > 0 ? perf.powerGenerated / maxPower : 0;
      fillColor = '#aa00ff'; // Purple for turbine
    } else if (cell.structure === StructureType.Substation && perf) {
      // Substation: show power sold vs max sale rate
      const maxSaleRate = this.game.getEffectivePowerSaleRate(cell.x, cell.y);
      fillRatio = maxSaleRate > 0 ? perf.powerSold / maxSaleRate : 0;
      fillColor = '#ffff00'; // Yellow for substation
    }

    // Fill bar
    if (fillRatio > 0) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(barX, barY, barWidth * Math.min(fillRatio, 1), barHeight);
    }
  }

  /**
   * Render right temperature bar (thermometer style)
   */
  private renderTempBar(
    cell: Cell,
    drawX: number,
    drawY: number,
    cellSize: number,
    barWidth: number,
    barPadding: number
  ): void {
    const barX = drawX + cellSize - barPadding - barWidth - 2;
    const barY = drawY + barPadding + 2;
    const barHeight = cellSize - barPadding * 2 - 4;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Get effective melt temperature
    const meltTemp = this.game.getEffectiveMeltTemp(cell.structure);
    const tempRatio = meltTemp === Infinity ? 0 : Math.min(cell.heat / meltTemp, 1);

    if (tempRatio > 0) {
      // Temperature fills from bottom to top
      const fillHeight = barHeight * tempRatio;
      const fillY = barY + barHeight - fillHeight;

      // Color gradient from blue (cold) to red (hot)
      let tempColor: string;
      if (tempRatio < 0.3) {
        tempColor = '#0088ff'; // Blue
      } else if (tempRatio < 0.5) {
        tempColor = '#00ff88'; // Cyan-green
      } else if (tempRatio < 0.7) {
        tempColor = '#ffff00'; // Yellow
      } else if (tempRatio < 0.9) {
        tempColor = '#ff8800'; // Orange
      } else {
        tempColor = '#ff0000'; // Red
      }

      this.ctx.fillStyle = tempColor;
      this.ctx.fillRect(barX, fillY, barWidth, fillHeight);
    }
  }

  /**
   * Render bottom heat exchange bar with tanh scaling
   */
  private renderHeatExchangeBar(
    perf: CellPerformance | null,
    drawX: number,
    drawY: number,
    cellSize: number,
    barHeight: number,
    barPadding: number
  ): void {
    const barX = drawX + barPadding + 2;
    const barY = drawY + cellSize - barPadding - barHeight - 2;
    const barWidth = cellSize - barPadding * 2 - 4;

    // Background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    if (!perf) return;

    // Apply tanh scaling to heat exchange
    const scaledExchange = heatExchangeSigmoid(perf.heatExchange, 0.05);
    const centerX = barX + barWidth / 2;

    if (scaledExchange > 0.01) {
      // Heat gained (positive) - draw from center to right in orange/red
      const fillWidth = (barWidth / 2) * scaledExchange;
      this.ctx.fillStyle = scaledExchange > 0.5 ? '#ff4400' : '#ff8800';
      this.ctx.fillRect(centerX, barY, fillWidth, barHeight);
    } else if (scaledExchange < -0.01) {
      // Heat lost (negative) - draw from center to left in blue
      const fillWidth = (barWidth / 2) * Math.abs(scaledExchange);
      this.ctx.fillStyle = scaledExchange < -0.5 ? '#0044ff' : '#0088ff';
      this.ctx.fillRect(centerX - fillWidth, barY, fillWidth, barHeight);
    }

    // Draw center line marker
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.fillRect(centerX - 0.5, barY, 1, barHeight);
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
  createUI(container: HTMLElement, options: UIOptions = {}): void {
    this.uiContainer = container;
    this.uiOptions = options;

    // Money display
    this.moneyDisplay = document.createElement('div');
    this.moneyDisplay.className = 'heat-game-money';
    container.appendChild(this.moneyDisplay);

    // Manual click button
    this.manualClickButton = document.createElement('button');
    this.manualClickButton.className = 'manual-click-btn';
    this.manualClickButton.textContent = `Generate €${this.game.getMoneyPerClick()}`;
    this.manualClickButton.addEventListener('click', () => {
      this.game.manualGenerate();
      this.updateManualClickButton();
    });
    container.appendChild(this.manualClickButton);

    // Stats display
    this.statsDisplay = document.createElement('div');
    this.statsDisplay.className = 'heat-game-stats';
    container.appendChild(this.statsDisplay);

    // Build menu
    this.buildMenu = document.createElement('div');
    this.buildMenu.className = 'heat-game-build-menu';
    this.createBuildMenu();
    container.appendChild(this.buildMenu);

    // Upgrade menu
    this.upgradeMenu = document.createElement('div');
    this.upgradeMenu.className = 'heat-game-upgrade-menu';
    this.createUpgradeMenu();
    container.appendChild(this.upgradeMenu);

    // Secret upgrades menu
    this.secretMenu = document.createElement('div');
    this.secretMenu.className = 'heat-game-secret-menu';
    this.createSecretMenu();
    container.appendChild(this.secretMenu);

    // Options menu
    this.optionsMenu = document.createElement('div');
    this.optionsMenu.className = 'heat-game-options-menu';
    this.createOptionsMenu();
    container.appendChild(this.optionsMenu);
  }

  private createBuildMenu(): void {
    if (!this.buildMenu) return;

    // Add title
    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Build Structures';
    this.buildMenu.appendChild(title);

    const buildableStructures = [
      StructureType.FuelRod,
      StructureType.Ventilator,
      StructureType.HeatExchanger,
      StructureType.Insulator,
      StructureType.Turbine,
      StructureType.Substation,
    ];

    // Initialize tier for each structure
    for (const structure of buildableStructures) {
      this.structureTiers.set(structure, Tier.T1);
    }

    for (const structure of buildableStructures) {
      const stats = STRUCTURE_BASE_STATS[structure];
      const wrapper = document.createElement('div');
      wrapper.className = 'build-item';

      // Minus button (decrease tier)
      const minusBtn = document.createElement('button');
      minusBtn.className = 'tier-btn tier-minus';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTier = this.structureTiers.get(structure) || Tier.T1;
        if (currentTier > Tier.T1) {
          this.structureTiers.set(structure, currentTier - 1);
          if (this.selectedStructure === structure) {
            this.selectedTier = currentTier - 1;
          }
          this.updateBuildButton(structure);
        }
      });

      // Buy button
      const tier = this.structureTiers.get(structure) || Tier.T1;
      const cost = getStructureCost(structure, tier);
      const effectiveStat = this.getEffectiveStatDisplay(structure, tier);
      const buyBtn = document.createElement('button');
      buyBtn.className = 'build-btn';
      buyBtn.innerHTML = `<span class="struct-symbol">${STRUCTURE_SYMBOLS[structure]}</span> <span class="struct-name">${stats.name}</span> <span class="struct-tier">T${tier}</span> <span class="struct-stat">${effectiveStat}</span> <span class="struct-cost">€${cost}</span>`;
      buyBtn.dataset.structure = structure;
      buyBtn.addEventListener('click', () => {
        this.selectedTier = this.structureTiers.get(structure) || Tier.T1;
        this.setSelectedStructure(structure);
        this.updateBuildMenuSelection();
      });
      this.buildButtons.set(structure, buyBtn);

      // Plus button (increase tier)
      const plusBtn = document.createElement('button');
      plusBtn.className = 'tier-btn tier-plus';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTier = this.structureTiers.get(structure) || Tier.T1;
        if (currentTier < Tier.T4) {
          this.structureTiers.set(structure, currentTier + 1);
          if (this.selectedStructure === structure) {
            this.selectedTier = currentTier + 1;
          }
          this.updateBuildButton(structure);
        }
      });

      wrapper.appendChild(minusBtn);
      wrapper.appendChild(buyBtn);
      wrapper.appendChild(plusBtn);
      this.buildMenu.appendChild(wrapper);
    }
  }

  private getEffectiveStatDisplay(structure: StructureType, tier: Tier): string {
    switch (structure) {
      case StructureType.FuelRod: {
        const heat = this.game.getEffectiveFuelHeatGenerationForTier(tier);
        return `${heat} heat/tick`;
      }
      case StructureType.Turbine: {
        const power = this.game.getEffectiveTurbinePowerForTier(tier);
        return `${power.toFixed(1)} power/tick`;
      }
      case StructureType.Substation: {
        const saleRate = this.game.getEffectivePowerSaleRateForTier(tier);
        return `€${saleRate.toFixed(1)}/tick`;
      }
      case StructureType.Ventilator: {
        const dissipation = this.game.getEffectiveVentilatorDissipationForTier(tier);
        return `-${dissipation} heat/tick`;
      }
      case StructureType.HeatExchanger: {
        const conductivity = this.game.getEffectiveHeatExchangerConductivity();
        return `${(conductivity * 100).toFixed(0)}% conductivity`;
      }
      case StructureType.Insulator: {
        const meltTemp = this.game.getEffectiveMeltTemp(structure);
        return `${meltTemp}°C melt`;
      }
      default:
        return '';
    }
  }

  private updateBuildButton(structure: StructureType): void {
    const button = this.buildButtons.get(structure);
    if (!button) return;

    const stats = STRUCTURE_BASE_STATS[structure];
    const tier = this.structureTiers.get(structure) || Tier.T1;
    const cost = getStructureCost(structure, tier);
    const canAfford = this.game.getMoney() >= cost;
    const effectiveStat = this.getEffectiveStatDisplay(structure, tier);

    // Check if anything changed since last render to avoid DOM thrashing
    const cached = this.buildButtonCache.get(structure);
    if (cached && cached.tier === tier && cached.cost === cost && cached.canAfford === canAfford && cached.effectiveStat === effectiveStat) {
      return; // Nothing changed, skip DOM update
    }

    // Update cache
    this.buildButtonCache.set(structure, { tier, cost, canAfford, effectiveStat });

    button.innerHTML = `<span class="struct-symbol">${STRUCTURE_SYMBOLS[structure]}</span> <span class="struct-name">${stats.name}</span> <span class="struct-tier">T${tier}</span> <span class="struct-stat">${effectiveStat}</span> <span class="struct-cost">€${cost}</span>`;
    button.disabled = !canAfford;
    button.classList.toggle('disabled', !canAfford);
  }

  private createUpgradeMenu(): void {
    if (!this.upgradeMenu) return;

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Upgrades';
    this.upgradeMenu.appendChild(title);

    const upgradeList = document.createElement('div');
    upgradeList.className = 'upgrade-list';
    upgradeList.id = 'upgrade-list';
    this.upgradeMenu.appendChild(upgradeList);

    // Use event delegation - single listener on parent
    upgradeList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.upgrade-btn') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;

      const upgradeType = btn.dataset.upgrade as UpgradeType;
      if (upgradeType && this.game.canPurchaseUpgrade(upgradeType)) {
        this.game.purchaseUpgrade(upgradeType);
      }
    });
  }

  private createSecretMenu(): void {
    if (!this.secretMenu) return;

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Secret Upgrades';
    this.secretMenu.appendChild(title);

    const secretList = document.createElement('div');
    secretList.className = 'secret-list';
    secretList.id = 'secret-list';
    this.secretMenu.appendChild(secretList);

    // Use event delegation - single listener on parent
    secretList.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Handle purchase button
      const secretBtn = target.closest('.secret-btn') as HTMLButtonElement | null;
      if (secretBtn && !secretBtn.disabled) {
        const secretType = secretBtn.dataset.secret as SecretUpgradeType;
        if (secretType && this.game.canPurchaseSecret(secretType)) {
          this.game.purchaseSecret(secretType);
        }
        return;
      }

      // Handle toggle button
      const toggleBtn = target.closest('.toggle-btn') as HTMLButtonElement | null;
      if (toggleBtn) {
        const secretType = toggleBtn.dataset.secret as SecretUpgradeType;
        if (secretType) {
          const isEnabled = this.game.isSecretEnabled(secretType);
          this.game.toggleSecret(secretType, !isEnabled);
        }
      }
    });
  }

  private pauseButton: HTMLButtonElement | null = null;

  private createOptionsMenu(): void {
    if (!this.optionsMenu) return;

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'Options';
    this.optionsMenu.appendChild(title);

    const optionsList = document.createElement('div');
    optionsList.className = 'options-list';

    // Pause/Resume button
    if (this.uiOptions.onPauseToggle && this.uiOptions.isPaused) {
      const pauseItem = document.createElement('div');
      pauseItem.className = 'options-item';

      this.pauseButton = document.createElement('button');
      this.pauseButton.className = 'options-btn pause-btn';
      this.pauseButton.textContent = this.uiOptions.isPaused() ? 'Resume Game' : 'Pause Game';
      this.pauseButton.addEventListener('click', () => {
        if (this.uiOptions.onPauseToggle && this.uiOptions.isPaused) {
          const newPaused = !this.uiOptions.isPaused();
          this.uiOptions.onPauseToggle(newPaused);
          this.updatePauseButton();
        }
      });

      pauseItem.appendChild(this.pauseButton);
      optionsList.appendChild(pauseItem);
    }

    // Reset save button
    if (this.uiOptions.onResetSave) {
      const resetItem = document.createElement('div');
      resetItem.className = 'options-item';

      const resetBtn = document.createElement('button');
      resetBtn.className = 'options-btn reset-btn';
      resetBtn.textContent = 'Reset Save';
      resetBtn.addEventListener('click', () => {
        if (this.uiOptions.onResetSave) {
          this.uiOptions.onResetSave();
        }
      });

      resetItem.appendChild(resetBtn);
      optionsList.appendChild(resetItem);
    }

    // Version display
    if (this.uiOptions.buildVersion) {
      const versionItem = document.createElement('div');
      versionItem.className = 'options-item version-item';
      versionItem.innerHTML = `<span class="version-label">Version:</span> <span class="version-value">${this.uiOptions.buildVersion}</span>`;
      optionsList.appendChild(versionItem);
    }

    this.optionsMenu.appendChild(optionsList);
  }

  private updatePauseButton(): void {
    if (this.pauseButton && this.uiOptions.isPaused) {
      const isPaused = this.uiOptions.isPaused();
      this.pauseButton.textContent = isPaused ? 'Resume Game' : 'Pause Game';
      this.pauseButton.classList.toggle('paused', isPaused);
    }
  }

  private updateBuildMenuSelection(): void {
    if (!this.buildMenu) return;

    const buttons = this.buildMenu.querySelectorAll('.build-btn');
    buttons.forEach(button => {
      const isSelected = (button as HTMLElement).dataset.structure === this.selectedStructure;
      button.classList.toggle('selected', isSelected);
    });
  }

  private updateBuildMenuAffordability(): void {
    for (const [structure] of this.buildButtons) {
      this.updateBuildButton(structure);
    }
  }

  updateUI(): void {
    if (this.moneyDisplay) {
      this.moneyDisplay.textContent = `Money: €${this.game.getMoney().toFixed(0)}`;
    }

    this.updateManualClickButton();

    if (this.statsDisplay) {
      const stats = this.game.getStats();
      const heatBalance = this.game.getLastTickHeatBalance();

      let heatBalanceHtml = '';
      if (heatBalance) {
        heatBalanceHtml = `
          <div class="heat-balance-section">
            <div class="heat-balance-title">Heat Balance</div>
            <div>Generated: +${heatBalance.heatGenerated.toFixed(1)}</div>
            <div>Ventilated: -${heatBalance.heatVentilated.toFixed(1)}</div>
            <div>To Power: -${heatBalance.heatConvertedToPower.toFixed(1)}</div>
            <div>To Env: -${heatBalance.heatLostToEnvironment.toFixed(1)}</div>
            <div>Net Change: ${heatBalance.heatDeltaInGrid >= 0 ? '+' : ''}${heatBalance.heatDeltaInGrid.toFixed(1)}</div>
            <div>Power Sold: ${heatBalance.powerSold.toFixed(2)}</div>
          </div>
        `;
      }

      this.statsDisplay.innerHTML = `
        <div>Total Power: ${this.game.getTotalPowerGenerated().toFixed(1)}</div>
        <div>Total Earned: €${this.game.getTotalMoneyEarned().toFixed(0)}</div>
        <div>Meltdowns: ${stats.meltdownCount}</div>
        <div>Ticks: ${stats.tickCount}</div>
        <div>Clicks: ${stats.manualClicks}</div>
        ${heatBalanceHtml}
      `;
    }

    // Update build menu affordability
    this.updateBuildMenuAffordability();

    // Update upgrade menus
    this.updateUpgradeMenu();
    this.updateSecretMenu();
  }

  private updateManualClickButton(): void {
    if (this.manualClickButton) {
      this.manualClickButton.textContent = `Generate €${this.game.getMoneyPerClick()}`;
    }
  }

  private getUpgradeEffectDisplay(type: UpgradeType, level: number): { current: string; next: string; description: string } {
    const def = UPGRADE_DEFINITIONS[type];
    const isMaxed = def.maxLevel > 0 && level >= def.maxLevel;

    switch (type) {
      case UpgradeType.FuelHeatOutput: {
        // Fuel heat output: base + (level * improvement)
        const baseHeat = STRUCTURE_BASE_STATS[StructureType.FuelRod].heatGeneration;
        const currentBonus = level * def.improvementPerLevel;
        const nextBonus = (level + 1) * def.improvementPerLevel;
        return {
          description: 'Fuel rod heat output',
          current: `+${currentBonus} heat`,
          next: isMaxed ? 'MAX' : `+${nextBonus} heat`,
        };
      }
      case UpgradeType.FuelLifetime: {
        const currentBonus = level * def.improvementPerLevel;
        const nextBonus = (level + 1) * def.improvementPerLevel;
        return {
          description: 'Fuel rod lifetime bonus',
          current: `+${currentBonus} ticks`,
          next: isMaxed ? 'MAX' : `+${nextBonus} ticks`,
        };
      }
      case UpgradeType.TurbineConductivity: {
        const baseCond = STRUCTURE_BASE_STATS[StructureType.Turbine].conductivity;
        const current = (baseCond + level * def.improvementPerLevel) * 100;
        const next = (baseCond + (level + 1) * def.improvementPerLevel) * 100;
        return {
          description: 'Turbine heat absorption',
          current: `${current.toFixed(0)}%`,
          next: isMaxed ? 'MAX' : `${next.toFixed(0)}%`,
        };
      }
      case UpgradeType.InsulatorConductivity: {
        const baseCond = STRUCTURE_BASE_STATS[StructureType.Insulator].conductivity;
        const current = baseCond * Math.pow(0.5, level) * 100;
        const next = baseCond * Math.pow(0.5, level + 1) * 100;
        return {
          description: 'Insulator heat leak',
          current: `${current.toFixed(2)}%`,
          next: isMaxed ? 'MAX' : `${next.toFixed(2)}%`,
        };
      }
      case UpgradeType.SubstationSaleRate: {
        const base = STRUCTURE_BASE_STATS[StructureType.Substation].powerSaleRate;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Substation power sold/tick',
          current: `+${level * def.improvementPerLevel}`,
          next: isMaxed ? 'MAX' : `+${(level + 1) * def.improvementPerLevel}`,
        };
      }
      case UpgradeType.VentilatorDissipation: {
        const currentBonus = level * def.improvementPerLevel;
        const nextBonus = (level + 1) * def.improvementPerLevel;
        return {
          description: 'Ventilator cooling bonus',
          current: `+${currentBonus} heat`,
          next: isMaxed ? 'MAX' : `+${nextBonus} heat`,
        };
      }
      case UpgradeType.TickSpeed: {
        const current = Math.pow(def.improvementPerLevel, level) * 100;
        const next = Math.pow(def.improvementPerLevel, level + 1) * 100;
        return {
          description: 'Tick speed',
          current: `${current.toFixed(0)}%`,
          next: isMaxed ? 'MAX' : `${next.toFixed(0)}%`,
        };
      }
      case UpgradeType.ManualClickPower: {
        const base = 1; // BASE_MONEY_PER_CLICK
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Money per click',
          current: `€${current}`,
          next: isMaxed ? 'MAX' : `€${next}`,
        };
      }
      case UpgradeType.MeltTempFuelRod: {
        const base = STRUCTURE_BASE_STATS[StructureType.FuelRod].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Fuel rod melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      case UpgradeType.MeltTempVentilator: {
        const base = STRUCTURE_BASE_STATS[StructureType.Ventilator].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Ventilator melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      case UpgradeType.MeltTempHeatExchanger: {
        const base = STRUCTURE_BASE_STATS[StructureType.HeatExchanger].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Heat exchanger melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      case UpgradeType.MeltTempInsulator: {
        const base = STRUCTURE_BASE_STATS[StructureType.Insulator].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Insulator melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      case UpgradeType.MeltTempTurbine: {
        const base = STRUCTURE_BASE_STATS[StructureType.Turbine].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Turbine melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      case UpgradeType.MeltTempSubstation: {
        const base = STRUCTURE_BASE_STATS[StructureType.Substation].meltTemp;
        const current = base + level * def.improvementPerLevel;
        const next = base + (level + 1) * def.improvementPerLevel;
        return {
          description: 'Substation melt temp',
          current: `${current}°C`,
          next: isMaxed ? 'MAX' : `${next}°C`,
        };
      }
      default:
        return { description: '', current: '', next: '' };
    }
  }

  private updateUpgradeMenu(): void {
    const upgradeList = document.getElementById('upgrade-list');
    if (!upgradeList) return;

    const money = this.game.getMoney();
    let html = '';

    for (const type of Object.values(UpgradeType)) {
      const def = UPGRADE_DEFINITIONS[type];
      const level = this.game.getUpgradeLevel(type);
      const cost = this.game.getUpgradeCost(type);
      const canAfford = money >= cost;
      const isMaxed = def.maxLevel > 0 && level >= def.maxLevel;
      const effect = this.getUpgradeEffectDisplay(type, level);

      html += `
        <div class="upgrade-item">
          <div class="upgrade-info">
            <span class="upgrade-name">${def.name}</span>
            <span class="upgrade-level">Lv.${level}${def.maxLevel > 0 ? '/' + def.maxLevel : ''}</span>
          </div>
          <div class="upgrade-effect">
            <span class="effect-desc">${effect.description}:</span>
            <span class="effect-values">${effect.current} → ${effect.next}</span>
          </div>
          <button class="upgrade-btn" data-upgrade="${type}" ${isMaxed || !canAfford ? 'disabled' : ''}>
            ${isMaxed ? 'MAX' : `€${cost}`}
          </button>
        </div>
      `;
    }

    upgradeList.innerHTML = html;
  }

  private updateSecretMenu(): void {
    const secretList = document.getElementById('secret-list');
    if (!secretList) return;

    const money = this.game.getMoney();
    let html = '';
    let hasVisibleSecrets = false;

    for (const type of Object.values(SecretUpgradeType)) {
      const def = SECRET_UPGRADE_DEFINITIONS[type];
      const isUnlocked = this.game.isSecretUnlocked(type);
      const isPurchased = this.game.isSecretPurchased(type);
      const isEnabled = this.game.isSecretEnabled(type);

      if (!isUnlocked && !isPurchased) continue;

      hasVisibleSecrets = true;
      const cost = this.game.getSecretCost(type);
      const canAfford = money >= cost;

      html += `
        <div class="secret-item ${isPurchased ? 'purchased' : ''}">
          <div class="secret-info">
            <span class="secret-name">${def.name}</span>
            <span class="secret-desc">${def.description}</span>
          </div>
          <div class="secret-actions">
            ${isPurchased
              ? (def.isToggle
                ? `<button class="toggle-btn ${isEnabled ? 'enabled' : ''}" data-secret="${type}">${isEnabled ? 'ON' : 'OFF'}</button>`
                : '<span class="owned">Owned</span>')
              : `<button class="secret-btn" data-secret="${type}" ${!canAfford ? 'disabled' : ''}>€${cost}</button>`
            }
          </div>
        </div>
      `;
    }

    if (!hasVisibleSecrets) {
      html = '<div class="no-secrets">No secrets discovered yet...</div>';
    }

    secretList.innerHTML = html;
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
