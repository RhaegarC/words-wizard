import type { MessageKey } from "../i18n/messages"

/**
 * PRD §8.5. Five install situations, not four: Chromium can offer the native
 * prompt or not, and the manual menu path is different copy.
 */
export type InstallContext =
  | "installed"
  | "ios-browser"
  | "chromium-installable"
  | "chromium-manual"
  | "browser"

/** Everything `detectInstallContext` needs, so it stays pure and testable. */
export interface InstallEnvironment {
  /** `display-mode: standalone` or iOS `navigator.standalone`. */
  standalone: boolean
  ios: boolean
  chromium: boolean
  /** A captured `beforeinstallprompt` is waiting to be called. */
  promptAvailable: boolean
}

export function detectInstallContext(
  environment: InstallEnvironment,
): InstallContext {
  if (environment.standalone) {
    return "installed"
  }

  if (environment.ios) {
    return "ios-browser"
  }

  if (environment.chromium) {
    return environment.promptAvailable
      ? "chromium-installable"
      : "chromium-manual"
  }

  return "browser"
}

const STEPS: Record<InstallContext, readonly MessageKey[]> = {
  installed: [],
  "ios-browser": ["install.step.share", "install.step.addToHome"],
  "chromium-installable": ["install.step.installButton"],
  "chromium-manual": [
    "install.step.menu",
    "install.step.apps",
    "install.step.install",
  ],
  browser: ["install.step.unsupported"],
}

/** The ordered, platform-specific instructions; empty once installed. */
export function installStepsFor(
  context: InstallContext,
): readonly MessageKey[] {
  return STEPS[context]
}

/**
 * The prompt is a strong onboarding card, never a gate. It is hidden once the
 * Home Screen app is detected, after this session's dismissal, and before a
 * profile exists (first run has nothing to install for yet).
 */
export function shouldShowInstallPrompt(input: {
  installed: boolean
  dismissed: boolean
  hasProfile: boolean
}): boolean {
  return input.hasProfile && !input.installed && !input.dismissed
}
