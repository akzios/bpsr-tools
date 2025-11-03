/**
 * Summary Cards Component
 * Displays key statistics in a grid layout
 */

import { formatNumber } from '@shared/dataFormatter';
import type { SummaryStats } from '@app-types/skillAnalysis';

export interface SummaryCardsOptions {
  stats: SummaryStats;
}

export class SummaryCards {
  private container: HTMLElement;
  private stats: SummaryStats;

  constructor(container: HTMLElement, options: SummaryCardsOptions) {
    this.container = container;
    this.stats = options.stats;
    this.render();
  }

  private render(): void {
    this.container.className = 'summary-cards';
    this.container.innerHTML = '';

    const card1 = this.createCard([
      { label: 'Total DMG', value: formatNumber(this.stats.totalDamage) },
      { label: 'Crit', value: `${Math.round(this.stats.critRate * 100)}%` },
      { label: 'DPS', value: formatNumber(this.stats.dps) },
      { label: 'Lucky', value: `${Math.round(this.stats.luckyRate * 100)}%` },
      { label: 'Hits', value: formatNumber(this.stats.totalHits) },
      { label: 'Crit Hits', value: formatNumber(this.stats.totalCritHits) },
    ]);

    const card2 = this.createCard([
      { label: 'Normal DMG', value: formatNumber(this.stats.normalDamage) },
      { label: 'Lucky DMG', value: formatNumber(this.stats.luckyDamage) },
      { label: 'Crit DMG', value: formatNumber(this.stats.critDamage) },
      { label: 'Avg/Hit', value: formatNumber(this.stats.avgPerHit) },
      { label: 'Lucky Hits', value: formatNumber(this.stats.totalLuckyHits) },
      { label: 'Hits Taken', value: formatNumber(this.stats.hitsTaken) },
    ]);

    this.container.appendChild(card1);
    this.container.appendChild(card2);
  }

  private createCard(items: Array<{ label: string; value: string }>): HTMLElement {
    const card = document.createElement('div');
    card.className = 'summary-card';

    const grid = document.createElement('div');
    grid.className = 'summary-grid';

    items.forEach((item) => {
      const summaryItem = document.createElement('div');
      summaryItem.className = 'summary-item';

      const label = document.createElement('span');
      label.className = 'summary-label';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'summary-value';
      value.textContent = item.value;

      summaryItem.appendChild(label);
      summaryItem.appendChild(value);
      grid.appendChild(summaryItem);
    });

    card.appendChild(grid);
    return card;
  }

  public update(stats: SummaryStats): void {
    this.stats = stats;
    this.render();
  }

  public destroy(): void {
    this.container.innerHTML = '';
  }
}
