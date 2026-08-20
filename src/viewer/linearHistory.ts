/** A bounded browser-style history whose moves can be committed after async work succeeds. */
export class LinearHistory<T> {
  private entries: T[] = [];
  private cursor = -1;

  constructor(
    private readonly capacity: number,
    private readonly equals: (left: T, right: T) => boolean = Object.is,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("History capacity must be a positive integer.");
    }
  }

  get canGoBack(): boolean {
    return this.cursor > 0;
  }

  get canGoForward(): boolean {
    return this.cursor >= 0 && this.cursor < this.entries.length - 1;
  }

  push(entry: T): void {
    const current = this.entries[this.cursor];
    if (current !== undefined && this.equals(current, entry)) {
      return;
    }
    this.entries.splice(this.cursor + 1);
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
    this.cursor = this.entries.length - 1;
  }

  peekBack(): T | undefined {
    return this.canGoBack ? this.entries[this.cursor - 1] : undefined;
  }

  peekForward(): T | undefined {
    return this.canGoForward ? this.entries[this.cursor + 1] : undefined;
  }

  commitBack(): void {
    if (this.canGoBack) {
      this.cursor--;
    }
  }

  commitForward(): void {
    if (this.canGoForward) {
      this.cursor++;
    }
  }

  clear(): void {
    this.entries = [];
    this.cursor = -1;
  }
}
