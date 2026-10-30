import { useEffect, useState } from "react"

import { Brand } from "../components/Brand"
import { Icon } from "../components/Icon"
import { useAuth } from "../auth/AuthProvider"
import { useLocale } from "../i18n/LocaleProvider"

/**
 * The only screen reachable while signed out. Everything else needs a profile,
 * and a profile needs an identity, so this gate comes before the create screen.
 */
export function SignInScreen() {
  const { t } = useLocale()
  const { signIn, config, configError } = useAuth()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)

    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])

  const start = () => {
    if (pending || !online) {
      return
    }

    setFailed(false)
    setPending(true)

    void signIn().catch((error: unknown) => {
      console.error("[auth] Sign-in could not start", error)
      setFailed(true)
      setPending(false)
    })
  }

  return (
    <main className="creation signin">
      <header className="creation-top">
        <Brand />
        <span className="creation-tagline">{t("common.appName")}</span>
      </header>

      <section className="creation-card signin-card">
        <div className="creation-copy">
          <span className="eyebrow">{t("boot.subtitle")}</span>
          <h1>{t("auth.title")}</h1>
          <p className="creation-lead">{t("auth.lead")}</p>

          {configError !== null ? (
            <p className="form-error" role="alert">
              {t("errors.config")} <code>{configError.key}</code>
            </p>
          ) : null}

          {!online ? (
            <p className="form-error" role="alert">
              {t("auth.offline")}
            </p>
          ) : null}

          {failed ? (
            <p className="form-error" role="alert">
              {t("auth.error")}
            </p>
          ) : null}

          <button
            type="button"
            className="button primary wide"
            onClick={start}
            disabled={pending || !online || config === null}
          >
            {pending ? t("auth.signingIn") : t("auth.signIn")}{" "}
            <Icon name="arrow" />
          </button>

          <p className="field-hint signin-privacy">
            <Icon name="shield" size={15} /> {t("auth.privacy")}
          </p>
        </div>
      </section>
    </main>
  )
}
