import type { ProgressProvider } from "@shared/provider"

import type { ApiProgressProvider } from "./ApiProgressProvider"

/**
 * The app's one progress provider. Boot configures it with the signed-in
 * identity; screens keep importing a stable object and never see how it was
 * assembled.
 */

let configured: ApiProgressProvider | null = null

export function configureProgressProvider(
  provider: ApiProgressProvider | null,
): void {
  configured = provider
}

export function activeProgressProvider(): ApiProgressProvider {
  if (configured === null) {
    throw new Error("The progress provider is not configured")
  }

  return configured
}

function requireProvider(): ApiProgressProvider {
  return activeProgressProvider()
}

export const progressProvider: ProgressProvider = {
  getProfile: () => requireProvider().getProfile(),
  createProfile: (profile) => requireProvider().createProfile(profile),
  updateProfile: (id, patch) => requireProvider().updateProfile(id, patch),
  getProgress: (profileId, wordId) =>
    requireProvider().getProgress(profileId, wordId),
  getAllProgress: (profileId) => requireProvider().getAllProgress(profileId),
  getIntroductions: (profileId) =>
    requireProvider().getIntroductions(profileId),
  commitSession: (payload) => requireProvider().commitSession(payload),
  incrementMetric: (profileId, name, delta) =>
    requireProvider().incrementMetric(profileId, name, delta),
  getMetrics: (profileId) => requireProvider().getMetrics(profileId),
  applyCare: (action) => requireProvider().applyCare(action),
  getDevice: (key) => requireProvider().getDevice(key),
  setDevice: (key, value) => requireProvider().setDevice(key, value),
}
