import { useEffect, useState, useSyncExternalStore } from "react"

import { progressProvider } from "../db"
import { DEVICE_KEYS } from "../db/device"
import {
  detectInstallContext,
  installStepsFor,
  shouldShowInstallPrompt,
} from "../domain/install"
import { useLocale } from "../i18n/LocaleProvider"
import {
  promptForInstall,
  subscribeInstallPrompt,
} from "../pwa/beforeInstallPrompt"
import { readInstallEnvironment } from "../pwa/environment"
import { installSession } from "../pwa/installSession"
import { useRouter } from "../router/RouterContext"

/**
 * PRD §8.5. The card on Home is the repeated prompt; the screen is where the
 * platform steps and Chromium's native prompt live. Neither blocks Practice:
 * every route out of here continues into the app.
 */
export function InstallPrompt({
  variant,
  onContinue,
}: {
  variant: "card" | "screen"
  onContinue?: () => void
}) {
  const { t } = useLocale()
  const { navigate } = useRouter()
  const dismissed = useSyncExternalStore(
    installSession.subscribe,
    installSession.isDismissed,
    () => false,
  )
  const [environment, setEnvironment] = useState(readInstallEnvironment)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installFailed, setInstallFailed] = useState(false)

  useEffect(
    () => subscribeInstallPrompt(() => setEnvironment(readInstallEnvironment())),
    [],
  )

  useEffect(() => {
    let active = true

    void progressProvider
      .getDevice(DEVICE_KEYS.storagePersisted)
      .then((value) => {
        if (active) {
          setPersisted(value === true ? true : value === false ? false : null)
        }
      })
      .catch((reason: unknown) => {
        console.warn("[install] Could not read storage persistence", reason)
      })

    return () => {
      active = false
    }
  }, [])

  const context = detectInstallContext(environment)
  const installed = context === "installed"
  const steps = installStepsFor(context)

  // Home's card disappears once installed or dismissed this session. The
  // screen stays reachable from a link and still explains the situation.
  if (
    variant === "card" &&
    !shouldShowInstallPrompt({ installed, dismissed, hasProfile: true })
  ) {
    return null
  }

  const install = () => {
    if (installing) {
      return
    }

    setInstalling(true)
    setInstallFailed(false)

    void promptForInstall().then((outcome) => {
      setInstalling(false)

      if (outcome === "accepted") {
        setEnvironment((current) => ({ ...current, standalone: true }))
        void progressProvider
          .setDevice(DEVICE_KEYS.installed, true)
          .catch((reason: unknown) => {
            console.warn("[install] Could not record the installation", reason)
          })
        return
      }

      if (outcome === "unavailable") {
        setEnvironment(readInstallEnvironment())
        setInstallFailed(true)
      }
    })
  }

  const continueOn = () => {
    installSession.dismiss()
    onContinue?.()
  }

  return (
    <section
      className={`install-prompt install-prompt-${variant}`}
      aria-labelledby={`install-prompt-title-${variant}`}
    >
      <h2 id={`install-prompt-title-${variant}`} className="install-title">
        {installed ? t("install.installed") : t("install.title")}
      </h2>

      {installed ? null : (
        <>
          <p className="install-body">{t("install.body")}</p>
          <p className="install-why">
            {persisted === false ? t("install.whyDenied") : t("install.why")}
          </p>

          {variant === "screen" && steps.length > 0 ? (
            <>
              <h3 className="install-steps-title">{t("install.stepsTitle")}</h3>
              <ol className="install-steps">
                {steps.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ol>
            </>
          ) : null}
        </>
      )}

      {installFailed ? (
        <p role="alert" className="form-error">
          {t("install.error")}
        </p>
      ) : null}

      <div className="install-actions">
        {!installed && context === "chromium-installable" ? (
          <button
            type="button"
            className="primary-button"
            disabled={installing}
            onClick={install}
          >
            {installing ? t("install.installing") : t("install.install")}
          </button>
        ) : null}

        {variant === "screen" ? (
          <button
            type="button"
            className={
              installed || context === "chromium-installable"
                ? "secondary-button"
                : "primary-button"
            }
            onClick={continueOn}
          >
            {installed ? t("install.continue") : t("install.continueInBrowser")}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate({ id: "install" })}
          >
            {t("install.openSteps")}
          </button>
        )}

        {!installed && variant === "card" ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => installSession.dismiss()}
          >
            {t("install.notNow")}
          </button>
        ) : null}
      </div>
    </section>
  )
}
