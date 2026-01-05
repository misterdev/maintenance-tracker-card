import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { IEntity, IHass, IDatetimeState } from '../types';
import { calculateDatetimeState, formatDateShort, resetDate } from './datetime';

@customElement('datetime-row')
export class DatetimeRow extends LitElement {
  @property({ type: Object }) entity!: IEntity;
  @property({ type: Object }) hass!: IHass;
  @property({ type: Boolean }) debug = false;

  @state() private dialogOpen = false;
  @state() private selectedDate = '';
  @state() private showAdvanced = false;

  get state(): IDatetimeState {
    return calculateDatetimeState(this.hass, this.entity);
  }

  get icon(): string {
    // Use custom icon if provided, otherwise fall back to entity's icon or default
    return this.entity.icon ||
           this.hass?.states?.[this.entity?.id]?.attributes?.icon ||
           'mdi:calendar';
  }

  get name(): string {
    return this.entity.friendly_name ||
           this.hass?.states?.[this.entity?.id]?.attributes?.friendly_name ||
           'Unknown';
  }

  get barWidth(): number {
    const frequencyDays = this.entity.frequency_days && this.entity.frequency_days > 0
      ? this.entity.frequency_days
      : 7;
    const progress = (this.state.daysSinceLastEvent / frequencyDays) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  get barColor(): string {
    return this.state.isOverdue ? "#df4c1e" : "#0da035";
  }

  get statusText(): string {
    const daysSince = this.state.daysSinceLastEvent;
    const daysUntil = this.state.daysUntilNextEvent;

    // Validate date before formatting
    const nextDate = this.state.nextEventDate && !isNaN(this.state.nextEventDate.getTime())
      ? formatDateShort(this.state.nextEventDate)
      : 'Unknown';

    const sinceText = daysSince === 0 ? 'today' :
                      daysSince === 1 ? '1 day ago' :
                      `${daysSince} days ago`;

    if (this.state.isOverdue) {
      const overdueDays = Math.abs(daysUntil);
      const overdueText = overdueDays === 1 ? '1 day' : `${overdueDays} days`;
      return `${sinceText} • Overdue by ${overdueText}`;
    } else {
      const untilText = daysUntil === 0 ? 'today' :
                        daysUntil === 1 ? 'tomorrow' :
                        `in ${daysUntil} days`;
      return `${sinceText} • Due ${nextDate} (${untilText})`;
    }
  }

  private handleClick(event: Event): void {
    // Format current last event date as YYYY-MM-DD
    const lastDate = this.state.lastEventDate;
    const year = lastDate.getFullYear();
    const month = String(lastDate.getMonth() + 1).padStart(2, '0');
    const day = String(lastDate.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;

    this.dialogOpen = true;
  }

  private closeDialog(): void {
    this.dialogOpen = false;
    this.showAdvanced = false;
  }

  private toggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  private handleDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate = input.value;
  }

  private submitDate(): void {
    if (!this.selectedDate) return;

    // Parse date string as local time (YYYY-MM-DD format from input type="date")
    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);

    // Skip confirmation since user already confirmed in our dialog
    resetDate(this.entity, selectedDateObj, this.hass, true);
    this.dialogOpen = false;
  }

  private markAsDone(): void {
    // Set date to today
    const today = new Date();
    resetDate(this.entity, today, this.hass, true);
    this.dialogOpen = false;
  }

  render() {
    return html`
      <div
        class="row"
        @click=${this.handleClick}>
        <ha-icon
          class="icon"
          .icon=${this.icon}
          style="color: ${this.barColor}"
          title="click to edit date">
        </ha-icon>

        <div class="content">
          <div class="header">
            <span class="name">${this.name}</span>
            <span class="status">${this.statusText}</span>
          </div>

          <div class="bar-container">
            <div
              class="bar"
              style="width: ${this.barWidth}%; background: ${this.barColor}">
            </div>
          </div>

          ${this.debug ? html`
            <div class="debug">
              Last: ${this.state.lastEventDate.toISOString().split('T')[0]} |
              Next: ${this.state.nextEventDate.toISOString().split('T')[0]} |
              Progress: ${this.barWidth.toFixed(0)}%
            </div>
          ` : ''}
        </div>
      </div>

      ${this.dialogOpen ? html`
        <div class="dialog-backdrop" @click=${this.closeDialog}>
          <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
            <div class="dialog-header">
              <div class="dialog-title">
                <ha-icon .icon=${this.icon} class="dialog-icon"></ha-icon>
                <div>
                  <div class="dialog-entity-name">${this.name}</div>
                  <div class="dialog-subtitle">Last completed: ${formatDateShort(this.state.lastEventDate)}</div>
                </div>
              </div>
              <button class="quick-done-button" @click=${this.markAsDone} title="Mark as done today">
                <ha-icon icon="mdi:check-circle"></ha-icon>
                <span>Done</span>
              </button>
            </div>

            <div class="dialog-body">
              <button class="advanced-toggle" @click=${this.toggleAdvanced}>
                <ha-icon icon="mdi:${this.showAdvanced ? 'chevron-up' : 'chevron-down'}"></ha-icon>
                <span>Advanced: Select custom date</span>
              </button>

              ${this.showAdvanced ? html`
                <div class="advanced-content">
                  <label class="date-label">Select completion date:</label>
                  <input
                    type="date"
                    class="date-input"
                    .value=${this.selectedDate}
                    @input=${this.handleDateChange}
                  />
                  <button class="primary-button full-width" @click=${this.submitDate}>
                    Save Custom Date
                  </button>
                </div>
              ` : ''}
            </div>

            ${!this.showAdvanced ? html`
              <div class="dialog-actions">
                <button class="secondary-button" @click=${this.closeDialog}>Cancel</button>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  static styles = css`
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .row:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }

    .icon {
      flex-shrink: 0;
      --mdc-icon-size: 20px;
    }

    .content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .header {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 6px;
      min-width: 0;
    }

    .name {
      font-weight: 500;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status {
      font-size: 11px;
      color: var(--secondary-text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-container {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .bar {
      height: 100%;
      transition: width 0.3s ease;
      border-radius: 2px;
    }

    .debug {
      font-size: 10px;
      color: gray;
      margin-top: 4px;
      font-style: italic;
    }

    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog {
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      min-width: 320px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      animation: slideUp 0.2s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 20px 16px 20px;
      border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
    }

    .dialog-title {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      flex: 1;
    }

    .dialog-icon {
      flex-shrink: 0;
      --mdc-icon-size: 24px;
      color: var(--primary-color, #0da035);
    }

    .dialog-entity-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--primary-text-color);
      margin-bottom: 4px;
    }

    .dialog-subtitle {
      font-size: 13px;
      color: var(--secondary-text-color);
    }

    .quick-done-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: none;
      border-radius: 8px;
      background: var(--primary-color, #0da035);
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .quick-done-button:hover {
      background: var(--primary-color-dark, #0b8a2d);
      transform: scale(1.02);
    }

    .quick-done-button ha-icon {
      --mdc-icon-size: 18px;
    }

    .dialog-body {
      padding: 8px 20px 12px 20px;
    }

    .advanced-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 8px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--secondary-text-color);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .advanced-toggle:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--primary-text-color);
    }

    .advanced-toggle ha-icon {
      --mdc-icon-size: 16px;
    }

    .advanced-content {
      margin-top: 12px;
      animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .date-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--secondary-text-color);
      margin-bottom: 8px;
    }

    .date-input {
      width: 100%;
      padding: 12px;
      font-size: 15px;
      border: 2px solid var(--divider-color, #ccc);
      border-radius: 8px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      transition: border-color 0.2s;
      box-sizing: border-box;
      margin-bottom: 12px;
    }

    .date-input:focus {
      outline: none;
      border-color: var(--primary-color, #0da035);
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
      padding: 8px 20px 16px 20px;
      justify-content: flex-end;
    }

    .primary-button,
    .secondary-button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .secondary-button {
      background: transparent;
      color: var(--primary-text-color);
    }

    .secondary-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .primary-button {
      background: var(--primary-color, #0da035);
      color: white;
    }

    .primary-button:hover {
      background: var(--primary-color-dark, #0b8a2d);
      transform: scale(1.02);
    }

    .full-width {
      width: 100%;
    }
  `;
}
