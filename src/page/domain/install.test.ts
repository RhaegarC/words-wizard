import { describe, expect, it } from "vitest"

import {
  detectInstallContext,
  installStepsFor,
  shouldShowInstallPrompt,
  type InstallEnvironment,
} from "./install"

const ENVIRONMENT: InstallEnvironment = {
  standalone: false,
  ios: false,
  chromium: false,
  promptAvailable: false,
}

describe("detectInstallContext", () => {
  it("treats a standalone iOS app as installed", () => {
    expect(
      detectInstallContext({ ...ENVIRONMENT, standalone: true, ios: true }),
    ).toBe("installed")
  })

  it("treats a standalone browser app as installed", () => {
    expect(
      detectInstallContext({ ...ENVIRONMENT, standalone: true, chromium: true }),
    ).toBe("installed")
  })

  it("recognises Safari on iOS as a browser tab", () => {
    expect(detectInstallContext({ ...ENVIRONMENT, ios: true })).toBe(
      "ios-browser",
    )
  })

  it("recognises Chromium once it offers its install prompt", () => {
    expect(
      detectInstallContext({
        ...ENVIRONMENT,
        chromium: true,
        promptAvailable: true,
      }),
    ).toBe("chromium-installable")
  })

  it("recognises Chromium without its install prompt", () => {
    expect(detectInstallContext({ ...ENVIRONMENT, chromium: true })).toBe(
      "chromium-manual",
    )
  })

  it("falls back to a plain browser tab", () => {
    expect(detectInstallContext(ENVIRONMENT)).toBe("browser")
  })
})

describe("installStepsFor", () => {
  it("gives the Safari home-screen steps in order", () => {
    expect(installStepsFor("ios-browser")).toEqual([
      "install.step.share",
      "install.step.addToHome",
    ])
  })

  it("gives the native Chromium prompt a single step", () => {
    expect(installStepsFor("chromium-installable")).toEqual([
      "install.step.installButton",
    ])
  })

  it("gives manual Chromium installs the menu path in order", () => {
    expect(installStepsFor("chromium-manual")).toEqual([
      "install.step.menu",
      "install.step.apps",
      "install.step.install",
    ])
  })

  it("points a plain browser tab at a browser that can install", () => {
    expect(installStepsFor("browser")).toEqual(["install.step.unsupported"])
  })

  it("shows no steps once installed", () => {
    expect(installStepsFor("installed")).toEqual([])
  })
})

describe("shouldShowInstallPrompt", () => {
  it("shows the prompt after character creation", () => {
    expect(
      shouldShowInstallPrompt({
        installed: false,
        dismissed: false,
        hasProfile: true,
      }),
    ).toBe(true)
  })

  it("hides the prompt once installed", () => {
    expect(
      shouldShowInstallPrompt({
        installed: true,
        dismissed: false,
        hasProfile: true,
      }),
    ).toBe(false)
  })

  it("hides the prompt after this session's dismissal", () => {
    expect(
      shouldShowInstallPrompt({
        installed: false,
        dismissed: true,
        hasProfile: true,
      }),
    ).toBe(false)
  })

  it("hides the prompt before a profile exists", () => {
    expect(
      shouldShowInstallPrompt({
        installed: false,
        dismissed: false,
        hasProfile: false,
      }),
    ).toBe(false)
  })
})
