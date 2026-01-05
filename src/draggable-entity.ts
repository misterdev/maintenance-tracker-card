export class DraggableEntity {
  friendly_name?: string;
  id: string = "";
  frequency_years: string = "";
  frequency_months: string = "";
  frequency_days: string = "";
  icon?: string;
  icon_color?: string;

  constructor(public key: number) {
    this.key = key;
    this.friendly_name = "";
    this.icon = "";
    this.icon_color = "";
  }
}
