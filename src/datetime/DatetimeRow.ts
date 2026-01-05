import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { IEntity, IHass, IDatetimeState, IConfig } from '../types';
import { calculateDatetimeState, formatDateShort, resetDate } from './datetime';

@customElement('datetime-row')
export class DatetimeRow extends LitElement {
  @property({ type: Object }) entity!: IEntity;
  @property({ type: Object }) hass!: IHass;
  @property({ type: Boolean }) debug = false;
  @property({ type: Object }) config!: IConfig;

  @state() private dialogOpen = false;
  @state() private selectedDate = '';
  @state() private selectedOption: 'today' | 'yesterday' | 'custom' = 'today';
  @state() private showDatePicker = false;

  get state(): IDatetimeState {
    return calculateDatetimeState(this.hass, this.entity);
  }

  get icon(): string {
    // Use custom icon if provided, otherwise fall back to entity's icon or default
    return this.entity.icon ||
           this.hass?.states?.[this.entity?.id]?.attributes?.icon ||
           'mdi:calendar';
  }

  get iconColor(): string {
    // Use custom icon color if provided, otherwise default to current text color
    return this.entity.icon_color || 'var(--primary-text-color)';
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
    return this.state.isOverdue
      ? "rgb(var(--rgb-warning, 223, 76, 30))"
      : "rgb(var(--rgb-success, 13, 160, 53))";
  }

  get statusText(): string {
    const daysUntil = this.state.daysUntilNextEvent;

    // Check if we should show the next date (entity config overrides global config)
    const showNextDate = this.entity.show_next_date ?? this.config?.show_next_date ?? true;

    // Validate date before formatting
    const nextDate = this.state.nextEventDate && !isNaN(this.state.nextEventDate.getTime())
      ? formatDateShort(this.state.nextEventDate)
      : 'Unknown';

    if (this.state.isOverdue) {
      // For overdue, show the date without "Overdue by X days" (that's in the badge)
      return showNextDate ? `Due ${nextDate}` : 'Overdue';
    } else if (daysUntil === 0) {
      // Due today
      return showNextDate ? `Due ${nextDate}` : 'Due Today';
    } else {
      // Simple format: "Due in 5d" or "Due Apr 5 (in 5d)"
      const untilText = daysUntil === 1 ? '1d' : `${daysUntil}d`;

      if (showNextDate) {
        return `Due ${nextDate} (in ${untilText})`;
      } else {
        return `Due in ${untilText}`;
      }
    }
  }

  get badge(): { text: string; color: string } | null {
    const daysUntil = this.state.daysUntilNextEvent;

    if (this.state.isOverdue) {
      // Overdue - red badge with "ago"
      const overdueDays = Math.abs(daysUntil);
      return {
        text: overdueDays === 1 ? '1d ago' : `${overdueDays}d ago`,
        color: 'rgb(var(--rgb-warning, 223, 76, 30))'
      };
    } else if (daysUntil === 0) {
      // Due today - green badge
      return {
        text: 'due today',
        color: 'rgb(var(--rgb-success, 13, 160, 53))'
      };
    } else if (daysUntil === 1 || daysUntil === 2) {
      // Due in 1-2 days - yellow/orange badge
      return {
        text: daysUntil === 1 ? 'due in 1d' : 'due in 2d',
        color: 'rgb(var(--rgb-info, 255, 152, 0))'
      };
    }

    return null;
  }

  private handleClick(): void {
    // Set date to today by default
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    this.selectedOption = 'today';
    this.showDatePicker = false;

    this.dialogOpen = true;
  }

  private closeDialog(): void {
    this.dialogOpen = false;
    this.showDatePicker = false;
    this.selectedOption = 'today';
  }

  private setToday(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    this.selectedOption = 'today';
    this.showDatePicker = false;
  }

  private setYesterday(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    this.selectedOption = 'yesterday';
    this.showDatePicker = false;
  }

  private showCustomDate(): void {
    this.selectedOption = 'custom';
    this.showDatePicker = true;
  }

  private handleDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate = input.value;
  }

  private confirmDate(): void {
    if (!this.selectedDate) return;

    // Parse date string as local time (YYYY-MM-DD format from input type="date")
    const [year, month, day] = this.selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);

    // Skip confirmation since user already confirmed in our dialog
    resetDate(this.entity, selectedDateObj, this.hass, true);
    this.closeDialog();
  }

  render() {
    return html`
      <div
        class="row"
        @click=${this.handleClick}>
        <ha-icon
          class="icon"
          .icon=${this.icon}
          style="color: ${this.iconColor}"
          title="click to edit date">
        </ha-icon>

        <div class="content">
          <div class="name">${this.name}</div>
          <div class="status">${this.statusText}</div>

          ${this.debug ? html`
            <div class="debug">
              Last: ${this.state.lastEventDate.toISOString().split('T')[0]} |
              Next: ${this.state.nextEventDate.toISOString().split('T')[0]} |
              Progress: ${this.barWidth.toFixed(0)}%
            </div>
          ` : ''}
        </div>

        ${this.badge ? html`
          <span class="badge" style="background: ${this.badge.color}">${this.badge.text}</span>
        ` : ''}

        <ha-icon
          class="chevron"
          icon="mdi:chevron-right">
        </ha-icon>
      </div>

      ${this.dialogOpen ? html`
        <div class="dialog-backdrop" @click=${this.closeDialog}>
          <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
            <div class="dialog-header">
              <ha-icon .icon=${this.icon} class="dialog-icon" style="color: ${this.iconColor}"></ha-icon>
              <div class="dialog-title-text">
                <div class="dialog-entity-name">${this.name}</div>
                <div class="dialog-subtitle">Last completed: ${formatDateShort(this.state.lastEventDate)}</div>
              </div>
            </div>

            <div class="dialog-body">
              <label class="date-label">Completion date</label>

              <div class="quick-actions">
                <button
                  class="quick-action-button ${this.selectedOption === 'yesterday' ? 'selected' : ''}"
                  @click=${this.setYesterday}>
                  <ha-icon icon="mdi:calendar-minus"></ha-icon>
                  <span>Yesterday</span>
                </button>
                <button
                  class="quick-action-button ${this.selectedOption === 'today' ? 'selected' : ''}"
                  @click=${this.setToday}>
                  <ha-icon icon="mdi:calendar-today"></ha-icon>
                  <span>Today</span>
                </button>
              </div>

              <button class="custom-date-button ${this.selectedOption === 'custom' ? 'selected' : ''}" @click=${this.showCustomDate}>
                <ha-icon icon="mdi:calendar-edit"></ha-icon>
                <span>Custom date</span>
                <ha-icon icon="mdi:chevron-${this.showDatePicker ? 'up' : 'down'}" class="chevron-icon"></ha-icon>
              </button>

              ${this.showDatePicker ? html`
                <input
                  type="date"
                  class="date-input"
                  .value=${this.selectedDate}
                  @input=${this.handleDateChange}
                />
              ` : ''}
            </div>

            <div class="dialog-actions">
              <button class="secondary-button" @click=${this.closeDialog}>Cancel</button>
              <button class="primary-button" @click=${this.confirmDate}>Confirm</button>
            </div>
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
      padding: 12px;
      cursor: pointer;
      border-radius: var(--ha-card-border-radius, 12px);
      transition: background-color 180ms ease-in-out;
    }

    .row:hover {
      background-color: rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.04);
    }

    .icon {
      flex-shrink: 0;
      --mdc-icon-size: 24px;
    }

    .content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .name {
      font-weight: 500;
      font-size: 15px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .badge {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      color: white;
      font-size: 12px;
      font-weight: 600;
      border-radius: var(--ha-card-border-radius, 12px);
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1;
    }

    .status {
      font-size: 13px;
      color: var(--secondary-text-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chevron {
      flex-shrink: 0;
      --mdc-icon-size: 20px;
      color: var(--secondary-text-color);
      opacity: 0.5;
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
      animation: fadeIn 180ms ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .dialog {
      background: var(--card-background-color, #fff);
      border-radius: var(--ha-card-border-radius, 12px);
      min-width: 320px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      animation: slideUp 180ms ease-in-out;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .dialog-header {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 20px 20px 16px 20px;
    }

    .dialog-icon {
      flex-shrink: 0;
      --mdc-icon-size: 32px;
    }

    .dialog-title-text {
      flex: 1;
      min-width: 0;
    }

    .dialog-entity-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--primary-text-color);
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .dialog-subtitle {
      font-size: 13px;
      color: var(--secondary-text-color);
      line-height: 1.4;
    }

    .dialog-body {
      padding: 0 20px 16px 20px;
    }

    .date-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary-text-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .quick-action-button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px;
      border: 2px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--ha-card-border-radius, 12px);
      background: transparent;
      color: var(--primary-text-color);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 180ms ease-in-out;
    }

    .quick-action-button:hover {
      border-color: var(--primary-color);
      background: rgba(var(--rgb-primary-color, 13, 160, 53), 0.08);
    }

    .quick-action-button.selected {
      border-color: var(--primary-color);
      background: var(--primary-color);
      color: var(--text-primary-color, white);
    }

    .quick-action-button ha-icon {
      --mdc-icon-size: 20px;
    }

    .custom-date-button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border: 2px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--ha-card-border-radius, 12px);
      background: transparent;
      color: var(--primary-text-color);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 180ms ease-in-out;
      margin-bottom: 12px;
    }

    .custom-date-button:hover {
      border-color: var(--primary-color);
      background: rgba(var(--rgb-primary-color, 13, 160, 53), 0.08);
    }

    .custom-date-button.selected {
      border-color: var(--primary-color);
      background: var(--primary-color);
      color: var(--text-primary-color, white);
    }

    .custom-date-button ha-icon:first-child {
      --mdc-icon-size: 18px;
    }

    .custom-date-button .chevron-icon {
      --mdc-icon-size: 16px;
      margin-left: auto;
    }

    .custom-date-button span {
      flex: 1;
      text-align: left;
    }

    .date-input {
      width: 100%;
      padding: 12px;
      font-size: 15px;
      border: 2px solid var(--divider-color, #ccc);
      border-radius: var(--ha-card-border-radius, 12px);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      transition: border-color 180ms ease-in-out;
      box-sizing: border-box;
      margin-bottom: 0;
      animation: slideDown 180ms ease-in-out;
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

    .date-input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .dialog-actions {
      display: flex;
      gap: 8px;
      padding: 16px 20px 20px 20px;
      border-top: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
    }

    .primary-button,
    .secondary-button {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: var(--ha-card-border-radius, 12px);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 180ms ease-in-out;
    }

    .secondary-button {
      background: transparent;
      color: var(--secondary-text-color);
      border: 2px solid var(--divider-color, rgba(255, 255, 255, 0.1));
    }

    .secondary-button:hover {
      background: rgba(var(--rgb-primary-text-color, 255, 255, 255), 0.04);
      color: var(--primary-text-color);
    }

    .primary-button {
      background: var(--primary-color);
      color: var(--text-primary-color, white);
    }

    .primary-button:hover {
      opacity: 0.9;
    }
  `;
}
