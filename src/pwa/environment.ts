import { isInstalled } from "../db/lifecycle"
import type { InstallEnvironment } from "../domain/install"

import { deferredInstallPrompt } from "./beforeInstallPrompt"

const IOS_PATTERN = /iPad|iPhone|iPod/
const CHROMIUM_PATTERN = /Chrome|Chromium|Edg\//

/**
 * The browser half of `detectInstallContext`: read once per render and again
 * when Chromium offers its prompt. iPadOS reports a MacIntel platform, so the
 * touch-point check catches an iPad that asks for the desktop site.
 */
export function readInstallEnvironment(): InstallEnvironment {
  const userAgent = navigator.userAgent
  const iPadAsMac =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1

  return {
    standalone: isInstalled(),
    ios: IOS_PATTERN.test(userAgent) || iPadAsMac,
    chromium: CHROMIUM_PATTERN.test(userAgent),
    promptAvailable: deferredInstallPrompt() !== null,
  }
}
