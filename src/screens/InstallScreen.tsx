import { Brand } from "../components/Brand"
import { InstallPrompt } from "../components/InstallPrompt"
import type { Profile } from "../domain/types"
import { useRouter } from "../router/RouterContext"

/**
 * The first-run stop after character creation (PRD screens table, row 2).
 * Continuing goes to the topic picker on a first run and Home afterwards;
 * nothing here can block either.
 */
export function InstallScreen({ profile }: { profile: Profile }) {
  const { navigate } = useRouter()

  return (
    <main className="setup-page">
      <Brand />
      <InstallPrompt
        variant="screen"
        onContinue={() =>
          navigate(
            profile.currentTopicId === null
              ? { id: "topics" }
              : { id: "home" },
          )
        }
      />
    </main>
  )
}
