export class AutomationHelper {
  private intervalId: NodeJS.Timeout | null = null;
  private callback: (() => void) | null = null;

  public start(intervalSeconds: number, callback: () => void): void {
    if (this.intervalId) {
      this.stop();
    }
    this.callback = callback;
    this.intervalId = setInterval(this.callback, intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.callback = null;
    }
  }

  public updateInterval(newIntervalSeconds: number, callback?: () => void): void {
    if (callback) {
        this.callback = callback;
    }
    if (this.isRunning() && this.callback) {
      this.stop();
      this.start(newIntervalSeconds, this.callback);
    }
  }

  public isRunning(): boolean {
    return this.intervalId !== null;
  }
}
