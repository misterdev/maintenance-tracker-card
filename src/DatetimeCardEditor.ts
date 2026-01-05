import { LitElement, html, css  } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { IAutocompleteItem, IConfig, IEntity, IHass } from './types';
import { DraggableEntity } from './draggable-entity';
import './DatetimeCardAutocomplete';

type InputEvent = Event & {
  target: HTMLInputElement;
};

@customElement('maintenance-tracker-card-editor')
export class DatetimeCardEditor extends LitElement {
  @property({ type: Object }) config!: IConfig;
  @property({ type: Object }) hass!: IHass;

  @state() private layout: "horizontal" | "vertical" = "horizontal";
  @state() private draggableEntities: DraggableEntity[] = [];
  @state() private image = '';
  @state() private key = 1;
  @state() private imagePosition: "start" | "end" = "start";
  @state() private upcomingDays = 0;
  @state() private title = '';
  @state() private showNextDate = true;

  private hasInitialized = false;

  // Home Assistant interface method
  setConfig(config: IConfig): void {
    // Ensure config has required type field
    if (!config) {
      config = {
        type: "custom:maintenance-tracker-card",
        entities: [],
      };
    }

    this.config = config;

    // Only initialize from config once, on first load
    if (!this.hasInitialized) {
      this.initializeFromConfig();
      this.hasInitialized = true;
    }
  }

  // Prevent editor from being used in code mode
  static get properties() {
    return {
      hass: {},
      config: {},
    };
  }

  get autocompleteItems(): IAutocompleteItem[] {
    return Object.keys(this.hass?.states || {})
      .filter((entity_id) => entity_id.startsWith("input_datetime"))
      .map((entity_id) => this.toAutocompleteItem(entity_id));
  }

  get iconAutocompleteItems(): IAutocompleteItem[] {
    // Common MDI icons for maintenance tasks
    const commonIcons = [
      { value: 'mdi:coffee', name: 'Coffee' },
      { value: 'mdi:sprout', name: 'Sprout (Plant)' },
      { value: 'mdi:watering-can', name: 'Watering Can' },
      { value: 'mdi:flower', name: 'Flower' },
      { value: 'mdi:leaf', name: 'Leaf' },
      { value: 'mdi:tree', name: 'Tree' },
      { value: 'mdi:scissors-cutting', name: 'Scissors' },
      { value: 'mdi:car', name: 'Car' },
      { value: 'mdi:car-wash', name: 'Car Wash' },
      { value: 'mdi:oil', name: 'Oil Change' },
      { value: 'mdi:wrench', name: 'Wrench (Maintenance)' },
      { value: 'mdi:tools', name: 'Tools' },
      { value: 'mdi:home', name: 'Home' },
      { value: 'mdi:home-circle', name: 'Home Circle' },
      { value: 'mdi:calendar', name: 'Calendar' },
      { value: 'mdi:calendar-check', name: 'Calendar Check' },
      { value: 'mdi:pill', name: 'Pill (Medicine)' },
      { value: 'mdi:medical-bag', name: 'Medical Bag' },
      { value: 'mdi:water', name: 'Water' },
      { value: 'mdi:filter', name: 'Filter' },
      { value: 'mdi:air-filter', name: 'Air Filter' },
      { value: 'mdi:vacuum', name: 'Vacuum' },
      { value: 'mdi:broom', name: 'Broom' },
      { value: 'mdi:washing-machine', name: 'Washing Machine' },
      { value: 'mdi:lightbulb', name: 'Light Bulb' },
      { value: 'mdi:battery', name: 'Battery' },
      { value: 'mdi:trash-can', name: 'Trash Can' },
      { value: 'mdi:recycle', name: 'Recycle' },
      { value: 'mdi:dog', name: 'Dog (Pet Care)' },
      { value: 'mdi:cat', name: 'Cat (Pet Care)' },
      { value: 'mdi:paw', name: 'Paw (Pet)' },
      { value: 'mdi:fire-extinguisher', name: 'Fire Extinguisher' },
      { value: 'mdi:hvac', name: 'HVAC' },
      { value: 'mdi:fan', name: 'Fan' },
      { value: 'mdi:fridge', name: 'Fridge' },
      { value: 'mdi:dishwasher', name: 'Dishwasher' },
      { value: 'mdi:stove', name: 'Stove' },
    ];

    return commonIcons.map(icon => ({
      primaryText: icon.name,
      secondaryText: icon.value,
      value: icon.value
    }));
  }

  private initializeFromConfig(): void {
    this.layout = this.config.layout || "horizontal";
    this.draggableEntities = this.config.entities?.map((e) => this.toDraggableEntity(e)) || [
      { id: "", key: this.newKey(), frequency_days: "" },
    ];
    this.image = this.config.image || "";
    this.imagePosition = this.config.image_position || "start";
    this.upcomingDays = this.config.upcoming_days || 0;
    this.title = this.config.title || "";
    this.showNextDate = this.config.show_next_date ?? true;
  }

  private addDraggableEntity(): void {
    this.draggableEntities = [...this.draggableEntities, new DraggableEntity(this.newKey())];
  }

  private deleteDraggableEntity(k: number): void {
    this.draggableEntities = this.draggableEntities.filter(({ key }) => key !== k);
    this.dispatchConfigChanged();
  }

  private dispatchConfigChanged(): void {
    const type = "custom:maintenance-tracker-card";
    const entities = this.draggableEntities.map((e) => this.toEntity(e));
    const config: IConfig = {
      entities,
      layout: this.layout,
      image_position: this.imagePosition,
      image: this.image,
      upcoming_days: this.upcomingDays,
      title: this.title,
      show_next_date: this.showNextDate,
      type,
    };

    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }),
    );
  }

  private newKey(): number {
    return ++this.key;
  }

  private toAutocompleteItem(entity_id: string): IAutocompleteItem {
    const primaryText = this.hass.states[entity_id].attributes.friendly_name;
    const secondaryText = entity_id;
    return { primaryText, secondaryText, value: entity_id };
  }

  private toDraggableEntity({ friendly_name, id, frequency_days, icon, icon_color }: IEntity): DraggableEntity {
    // Convert total days to years, months, days
    const totalDays = frequency_days > 0 ? frequency_days : 0;
    const years = Math.floor(totalDays / 365);
    const remainingAfterYears = totalDays % 365;
    const months = Math.floor(remainingAfterYears / 30);
    const days = remainingAfterYears % 30;

    return {
      friendly_name,
      id,
      key: this.newKey(),
      frequency_years: years > 0 ? years.toString() : "",
      frequency_months: months > 0 ? months.toString() : "",
      frequency_days: days > 0 ? days.toString() : "",
      icon: icon || "",
      icon_color: icon_color || "",
    };
  }

  private toEntity({ friendly_name, id, frequency_years, frequency_months, frequency_days, icon, icon_color }: DraggableEntity): IEntity {
    // Convert years, months, days to total days
    const years = parseInt(frequency_years) || 0;
    const months = parseInt(frequency_months) || 0;
    const days = parseInt(frequency_days) || 0;
    const totalDays = (years * 365) + (months * 30) + days;

    return {
      friendly_name,
      id,
      frequency_days: totalDays > 0 ? totalDays : 7,
      icon: icon || undefined,
      icon_color: icon_color || undefined,
    };
  }

  private updateLayout(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.layout = select.value as "horizontal" | "vertical";
    this.dispatchConfigChanged();
  }

  private updateId(id: string, entity: DraggableEntity): void {
    this.draggableEntities = this.draggableEntities.map((e) =>
      e === entity ? { ...e, id: id } : e,
    );
    this.dispatchConfigChanged();
  }

  private updateImagePosition(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.imagePosition = select.value as "start" | "end";
    this.dispatchConfigChanged();
  }

  private updateFriendlyName(event: InputEvent, entity: DraggableEntity): void {
    const friendly_name = event.target.value;
    this.draggableEntities = this.draggableEntities.map((e) =>
      e === entity ? { ...e, friendly_name } : e,
    );
    this.dispatchConfigChanged();
  }

  private updateIcon(icon: string, entity: DraggableEntity): void {
    this.draggableEntities = this.draggableEntities.map((e) =>
      e === entity ? { ...e, icon } : e,
    );
    this.dispatchConfigChanged();
  }

  private updateIconColor(event: InputEvent, entity: DraggableEntity): void {
    const icon_color = event.target.value;
    this.draggableEntities = this.draggableEntities.map((e) =>
      e === entity ? { ...e, icon_color } : e,
    );
    this.dispatchConfigChanged();
  }

  private updateImage(event: InputEvent): void {
    this.image = event.target.value;
    this.dispatchConfigChanged();
  }

  private async handleImageUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      this.image = e.target?.result as string;
      this.dispatchConfigChanged();
    };
    reader.readAsDataURL(file);
  }

  private clearImage(): void {
    this.image = '';
    this.dispatchConfigChanged();
  }

  private updateFrequencyYears(event: InputEvent, entity: DraggableEntity): void {
    const value = Number(event.target.value);

    if (!Number.isInteger(value) || value < 0) {
      event.target.value = entity.frequency_years;
      return;
    }

    event.target.value = value.toString();
    entity.frequency_years = value.toString();
    this.dispatchConfigChanged();
  }

  private updateFrequencyMonths(event: InputEvent, entity: DraggableEntity): void {
    const value = Number(event.target.value);

    if (!Number.isInteger(value) || value < 0) {
      event.target.value = entity.frequency_months;
      return;
    }

    event.target.value = value.toString();
    entity.frequency_months = value.toString();
    this.dispatchConfigChanged();
  }

  private updateFrequencyDays(event: InputEvent, entity: DraggableEntity): void {
    const value = Number(event.target.value);

    if (!Number.isInteger(value) || value < 0) {
      event.target.value = entity.frequency_days;
      return;
    }

    event.target.value = value.toString();
    entity.frequency_days = value.toString();
    this.dispatchConfigChanged();
  }

  private updateUpcomingDaysEnabled(event: InputEvent): void {
    this.upcomingDays = event.target.checked ? 2 : 0;
    this.dispatchConfigChanged();
  }

  private updateUpcomingDaysValue(event: InputEvent): void {
    const value = Number(event.target.value);
    if (Number.isInteger(value) && value >= 1) {
      this.upcomingDays = value;
      this.dispatchConfigChanged();
    }
  }

  private updateTitle(event: InputEvent): void {
    this.title = event.target.value;
    this.dispatchConfigChanged();
  }

  private updateShowNextDate(event: InputEvent): void {
    this.showNextDate = event.target.checked;
    this.dispatchConfigChanged();
  }

  render() {
    return html`
      <div class="title-section">
        <ha-textfield
          data-testid="title"
          label="Title (optional)"
          .value=${this.title}
          @input=${this.updateTitle}>
        </ha-textfield>
      </div>

      <div class="image-section">
        <label class="section-label">Image</label>

        ${this.image ? html`
          <div class="image-preview">
            <img src="${this.image}" alt="Preview" />
            <button class="clear-image-button" @click=${this.clearImage} title="Remove image">
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
        ` : ''}

        <div class="image-inputs">
          <ha-textfield
            data-testid="image-url"
            label="Image URL"
            .value=${this.image}
            @input=${this.updateImage}>
          </ha-textfield>

          <div class="upload-divider">
            <span>or</span>
          </div>

          <label class="file-upload-label">
            <input
              type="file"
              accept="image/*"
              @change=${this.handleImageUpload}
              class="file-input"
            />
            <span class="file-upload-button">
              <ha-icon icon="mdi:upload"></ha-icon>
              Upload Image
            </span>
          </label>
        </div>
      </div>

      <h3>Settings</h3>

      <section class="options">
        <div class="option-row">
          <label for="layout-select">Layout</label>
          <select
            id="layout-select"
            class="select"
            .value=${this.layout}
            @change=${this.updateLayout}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>

        <div class="option-row">
          <label for="image-position-select">Image Position</label>
          <select
            id="image-position-select"
            class="select"
            .value=${this.imagePosition}
            @change=${this.updateImagePosition}>
            <option value="start">${this.layout === "vertical" ? "Top" : "Left"}</option>
            <option value="end">${this.layout === "vertical" ? "Bottom" : "Right"}</option>
          </select>
        </div>

        <div class="option-row">
          <ha-switch
            id="upcoming-tasks-switch"
            aria-label="Show upcoming tasks"
            ?checked=${this.upcomingDays > 0}
            @change=${this.updateUpcomingDaysEnabled}>
          </ha-switch>
          <label for="upcoming-tasks-switch">Show upcoming tasks</label>
        </div>

        ${this.upcomingDays > 0 ? html`
          <div class="option-row indented">
            <ha-textfield
              data-testid="upcoming-days"
              label="Show tasks due within (days)"
              type="number"
              min="1"
              .value=${this.upcomingDays.toString()}
              @input=${this.updateUpcomingDaysValue}>
            </ha-textfield>
          </div>
        ` : ''}

        <div class="option-row">
          <ha-switch
            id="show-next-date-switch"
            aria-label="Show next date in status"
            ?checked=${this.showNextDate}
            @change=${this.updateShowNextDate}>
          </ha-switch>
          <label for="show-next-date-switch">Show next date in status</label>
        </div>
      </section>

      <h3>Entities (required)</h3>

      <section data-testid="entities" class="entities">
        ${repeat(
          this.draggableEntities,
          (entity) => entity.key,
          (entity, index) => html`
            <div role="listitem" class="entity">
              <div class="entity-header">
                <div class="entity-title">Entity ${index + 1}</div>
                ${this.draggableEntities.length > 1 ? html`
                  <ha-icon-button
                    class="delete-button"
                    data-testid="delete-${index}"
                    role="menuitem"
                    tabindex="0"
                    @click=${() => this.deleteDraggableEntity(entity.key)}>
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                ` : ''}
              </div>

              <div class="entity-content">
                <maintenance-tracker-card-autocomplete
                  data-testid="maintenance-tracker-card-autocomplete-${index}"
                  label="Entity"
                  .items=${this.autocompleteItems}
                  .value=${entity.id}
                  .updateId=${(id: string) => this.updateId(id, entity)}>
                </maintenance-tracker-card-autocomplete>

                <ha-textfield
                  data-testid="friendly-name-${index}"
                  label="Label (optional)"
                  .value=${entity.friendly_name || ""}
                  @input=${(event: Event) => this.updateFriendlyName(event as InputEvent, entity)}>
                </ha-textfield>

                <div class="icon-row">
                  <maintenance-tracker-card-autocomplete
                    data-testid="icon-autocomplete-${index}"
                    label="Icon (optional)"
                    .items=${this.iconAutocompleteItems}
                    .value=${entity.icon || ""}
                    .updateId=${(icon: string) => this.updateIcon(icon, entity)}>
                  </maintenance-tracker-card-autocomplete>

                  <ha-textfield
                    data-testid="icon-color-${index}"
                    class="icon-color-input"
                    label="Color (optional)"
                    placeholder="#FF5722"
                    .value=${entity.icon_color || ""}
                    @input=${(event: Event) => this.updateIconColor(event as InputEvent, entity)}>
                  </ha-textfield>
                </div>

                <div class="frequency-section">
                  <label class="frequency-label">Frequency</label>
                  <div class="frequency-inputs">
                    <ha-textfield
                      data-testid="frequency-years-${index}"
                      class="frequency-input"
                      label="Years"
                      type="number"
                      min="0"
                      .value=${entity.frequency_years}
                      @input=${(event: Event) => this.updateFrequencyYears(event as InputEvent, entity)}>
                    </ha-textfield>
                    <ha-textfield
                      data-testid="frequency-months-${index}"
                      class="frequency-input"
                      label="Months"
                      type="number"
                      min="0"
                      .value=${entity.frequency_months}
                      @input=${(event: Event) => this.updateFrequencyMonths(event as InputEvent, entity)}>
                    </ha-textfield>
                    <ha-textfield
                      data-testid="frequency-days-${index}"
                      class="frequency-input"
                      label="Days"
                      type="number"
                      min="0"
                      .value=${entity.frequency_days}
                      @input=${(event: Event) => this.updateFrequencyDays(event as InputEvent, entity)}>
                    </ha-textfield>
                  </div>
                </div>
              </div>
            </div>
          `
        )}
      </section>

      <div class="plus">
        <ha-icon-button
          data-testid="plus"
          class="plus"
          role="button"
          tabindex="0"
          @click=${this.addDraggableEntity}>
          <ha-icon icon="mdi:plus"></ha-icon>
        </ha-icon-button>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 24px 0 12px 0;
      color: var(--primary-text-color);
    }

    ha-textfield {
      margin-top: 3px;
      margin-bottom: 5px;
    }

    .title-section {
      margin-bottom: 8px;
    }

    .title-section ha-textfield {
      width: 100%;
    }

    ha-switch {
      margin-left: 30px;
    }

    .entity {
      margin-bottom: 16px;
      padding: 0;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--ha-card-border-radius, 12px);
      transition: box-shadow 180ms ease-in-out;
      overflow: hidden;
    }

    .entity:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .entity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--secondary-background-color, rgba(127, 127, 127, 0.1));
      border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
    }

    .entity-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--primary-text-color);
    }

    .delete-button {
      --mdc-icon-button-size: 36px;
      --mdc-icon-size: 20px;
    }

    .entity-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .icon-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .icon-row maintenance-tracker-card-autocomplete {
      flex: 1;
      min-width: 0;
    }

    .icon-color-input {
      width: 140px;
      flex-shrink: 0;
    }

    .frequency-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .frequency-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .frequency-inputs {
      display: flex;
      gap: 8px;
    }

    .frequency-input {
      flex: 1;
      max-width: 120px;
    }

    .plus {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .entities {
      margin-top: 8px;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 16px 0;
      padding: 16px;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--ha-card-border-radius, 12px);
    }

    .option-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .option-row label {
      flex: 0 0 140px;
    }

    .option-row.indented {
      margin-left: 40px;
    }

    .option-row.indented ha-textfield {
      flex: 1;
    }

    .select {
      flex: 1;
      padding: 10px 12px;
      border-radius: var(--ha-card-border-radius, 12px);
      border: 2px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      font-size: 14px;
      transition: border-color 180ms ease-in-out;
      cursor: pointer;
    }

    .select:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .image-section {
      margin: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.1));
      border-radius: var(--ha-card-border-radius, 12px);
    }

    .section-label {
      font-size: 16px;
      font-weight: 600;
      color: var(--primary-text-color);
      margin-bottom: 4px;
    }

    .image-preview {
      position: relative;
      width: 200px;
      height: 200px;
      border-radius: var(--ha-card-border-radius, 12px);
      overflow: hidden;
      border: 2px solid var(--divider-color, #ccc);
    }

    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .clear-image-button {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 180ms ease-in-out;
    }

    .clear-image-button:hover {
      background: rgba(0, 0, 0, 0.9);
      transform: scale(1.1);
    }

    .clear-image-button ha-icon {
      --mdc-icon-size: 20px;
    }

    .image-inputs {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .upload-divider {
      text-align: center;
      color: var(--secondary-text-color);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .file-input {
      display: none;
    }

    .file-upload-label {
      cursor: pointer;
    }

    .file-upload-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border: 2px dashed var(--divider-color, #ccc);
      border-radius: var(--ha-card-border-radius, 12px);
      background: transparent;
      color: var(--primary-text-color);
      font-size: 14px;
      font-weight: 500;
      transition: all 180ms ease-in-out;
    }

    .file-upload-button:hover {
      border-color: var(--primary-color);
      background: rgba(var(--rgb-primary-color, 13, 160, 53), 0.04);
    }

    .file-upload-button ha-icon {
      --mdc-icon-size: 20px;
    }
  `;
}
