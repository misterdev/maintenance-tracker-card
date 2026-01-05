export class DraggableEntity {
  friendly_name?: string;
  id: string = "";
  frequency_days: string = "";
  icon?: string;

  constructor(public key: number) {
    this.key = key;
    this.friendly_name = "";
    this.icon = "";
  }
}
