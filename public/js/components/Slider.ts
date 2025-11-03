/**
 * Slider Component
 * A reusable range slider with label and value display
 */

export interface SliderOptions {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  showValue?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export class Slider {
  private container: HTMLElement;
  private options: SliderOptions;
  private input?: HTMLInputElement;
  private valueDisplay?: HTMLSpanElement;

  constructor(container: HTMLElement, options: SliderOptions) {
    this.container = container;
    this.options = {
      step: 1,
      unit: '',
      showValue: true,
      ...options,
    };

    this.render();
  }

  /**
   * Render the slider
   */
  private render(): void {
    this.container.innerHTML = '';
    this.container.className = `slider-container ${this.options.className || ''}`;

    // Label and value row
    const labelRow = document.createElement('div');
    labelRow.className = 'slider-label-row';

    const label = document.createElement('label');
    label.htmlFor = this.options.id;
    label.className = 'slider-label';
    label.textContent = this.options.label;

    labelRow.appendChild(label);

    if (this.options.showValue) {
      this.valueDisplay = document.createElement('span');
      this.valueDisplay.className = 'slider-value';
      this.updateValueDisplay(this.options.value);
      labelRow.appendChild(this.valueDisplay);
    }

    // Slider input
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.id = this.options.id;
    this.input.className = 'slider-input';
    this.input.min = this.options.min.toString();
    this.input.max = this.options.max.toString();
    this.input.step = this.options.step!.toString();
    this.input.value = this.options.value.toString();

    this.input.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.updateValueDisplay(value);
      if (this.options.onChange) {
        this.options.onChange(value);
      }
    });

    this.container.appendChild(labelRow);
    this.container.appendChild(this.input);
  }

  /**
   * Update value display
   */
  private updateValueDisplay(value: number): void {
    if (this.valueDisplay) {
      this.valueDisplay.textContent = `${value}${this.options.unit}`;
    }
  }

  /**
   * Get current value
   */
  public getValue(): number {
    return this.input ? parseFloat(this.input.value) : this.options.value;
  }

  /**
   * Set value
   */
  public setValue(value: number): void {
    if (this.input) {
      this.input.value = value.toString();
      this.updateValueDisplay(value);
    }
  }

  /**
   * Destroy the slider
   */
  public destroy(): void {
    this.container.innerHTML = '';
  }
}
