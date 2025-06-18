import { app, BrowserWindow } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { AutomationHelper } from "./AutomationHelper"

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private automationHelper: AutomationHelper;
  private isAutomationActive: boolean = false;
  private automationIntervalSeconds: number = 60; // Default interval

  // View management
  private view: "queue" | "solutions" = "queue"

  private problemInfo: {
    problem_statement: string
    input_format: Record<string, any>
    output_format: Record<string, any>
    constraints: Array<Record<string, any>>
    test_cases: Array<Record<string, any>>
  } | null = null // Allow null

  private hasDebugged: boolean = false

  // Processing events
  public readonly PROCESSING_EVENTS = {
    //global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",

    //states for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",

    //states for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    // Initialize WindowHelper with this
    this.windowHelper = new WindowHelper(this)

    // Initialize ScreenshotHelper
    this.screenshotHelper = new ScreenshotHelper(this.view)

    // Initialize ProcessingHelper
    this.processingHelper = new ProcessingHelper(this)

    // Initialize ShortcutsHelper
    this.shortcutsHelper = new ShortcutsHelper(this)

    // Initialize AutomationHelper
    this.automationHelper = new AutomationHelper();
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  // Getters and Setters
  public getMainWindow(): BrowserWindow | null {
    return this.windowHelper.getMainWindow()
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean {
    return this.windowHelper.isVisible()
  }

  public getScreenshotHelper(): ScreenshotHelper {
    return this.screenshotHelper
  }

  public getProblemInfo(): any {
    return this.problemInfo
  }

  public setProblemInfo(problemInfo: any): void {
    this.problemInfo = problemInfo
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotHelper.getScreenshotQueue()
  }

  public getExtraScreenshotQueue(): string[] {
    return this.screenshotHelper.getExtraScreenshotQueue()
  }

  // Window management methods
  public createWindow(): void {
    this.windowHelper.createWindow()
  }

  public hideMainWindow(): void {
    this.windowHelper.hideMainWindow()
  }

  public showMainWindow(): void {
    this.windowHelper.showMainWindow()
  }

  public toggleMainWindow(): void {
    console.log(
      "Screenshots: ",
      this.screenshotHelper.getScreenshotQueue().length,
      "Extra screenshots: ",
      this.screenshotHelper.getExtraScreenshotQueue().length
    )
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()

    // Clear problem info
    this.problemInfo = null

    // Reset view to initial state
    this.setView("queue")
  }

  // Screenshot management methods
  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")

    const screenshotPath = await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )

    return screenshotPath
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  // New methods to move the window
  public moveWindowLeft(): void {
    this.windowHelper.moveWindowLeft()
  }

  public moveWindowRight(): void {
    this.windowHelper.moveWindowRight()
  }
  public moveWindowDown(): void {
    this.windowHelper.moveWindowDown()
  }
  public moveWindowUp(): void {
    this.windowHelper.moveWindowUp()
  }

  public setHasDebugged(value: boolean): void {
    this.hasDebugged = value
  }

  public getHasDebugged(): boolean {
    return this.hasDebugged
  }

  // Automation methods
  public getAutomationStatus(): { isActive: boolean; interval: number } {
    return {
      isActive: this.isAutomationActive,
      interval: this.automationIntervalSeconds,
    };
  }

  public setAutomationActive(isActive: boolean): void {
    this.isAutomationActive = isActive;
    if (isActive) {
      this.automationHelper.start(
        this.automationIntervalSeconds,
        this.runAutomatedTask.bind(this)
      );
    } else {
      this.automationHelper.stop();
    }
  }

  public setAutomationInterval(seconds: number): void {
    this.automationIntervalSeconds = seconds;
    if (this.isAutomationActive) {
      this.automationHelper.updateInterval(
        seconds,
        this.runAutomatedTask.bind(this)
      );
    }
  }

  private async runAutomatedTask(): Promise<void> {
    if (!this.isAutomationActive) {
      return;
    }
    console.log("Automation: Starting automated task...");
    const previousView = this.getView(); // Store current view

    try {
      // Set view to 'queue' to ensure screenshot goes to the correct queue
      // and processing follows the new problem path.
      this.setView('queue');

      await this.takeScreenshot();
      console.log("Automation: Screenshot taken.");

      await this.processingHelper.processScreenshots();
      console.log("Automation: Screenshots processed.");

      // Note: ProcessingHelper.processScreenshots (queue path) sets view to 'solutions'.
      // No explicit view restoration to previousView is done here,
      // as seeing the solution is often the desired outcome.
    } catch (error) {
      console.error("Automation: Error during automated task:", error);
      // If an error occurred, it might be useful to restore the original view
      // if the process didn't complete and change it.
      // However, if processScreenshots() started and failed, view might already be 'solutions'.
      // For now, we'll keep it simple and not restore, to avoid complex state juggling.
      // this.setView(previousView); // Optional: consider implications
    } finally {
      console.log("Automation: Automated task finished.");
      // If not restoring view in catch, and an error occurred before view change,
      // view will remain 'queue'. If it occurred after, it might be 'solutions'.
      // If it's critical to always return to previousView on error, then restore here or in catch.
      // For now, let's assume the primary goal is that the processing attempt happens correctly.
      // If an error occurs, the console log is the main feedback.
    }
  }
}

// Application initialization
async function initializeApp() {
  const appState = AppState.getInstance()

  // Initialize IPC handlers before window creation
  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    console.log("App is ready")
    appState.createWindow()
    // Register global shortcuts using ShortcutsHelper
    appState.shortcutsHelper.registerGlobalShortcuts()
  })

  app.on("activate", () => {
    console.log("App activated")
    if (appState.getMainWindow() === null) {
      appState.createWindow()
    }
  })

  // Quit when all windows are closed, except on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit()
    }
  })

  app.dock?.hide() // Hide dock icon (optional)
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

// Start the application
initializeApp().catch(console.error)
