import { routeHref } from "../router"
import { Archived } from "../screens/Archived"
import { PackForm } from "../screens/PackForm"
import { PacksList } from "../screens/PacksList"
import { TopicForm } from "../screens/TopicForm"
import { TopicsList } from "../screens/TopicsList"
import type { ScreenProps } from "../screens/types"
import { Words } from "../screens/Words"

/**
 * Chooses the screen for the current hash route. The key is the route href,
 * so moving from one editor to another remounts the form with fresh values
 * instead of carrying the previous record's state.
 */
export function ScreenContent(props: ScreenProps) {
  return <div key={routeHref(props.route)}>{screenFor(props)}</div>
}

function screenFor(props: ScreenProps) {
  switch (props.route.screen) {
    case "topics":
      return <TopicsList {...props} />
    case "topicNew":
    case "topic":
      return <TopicForm {...props} />
    case "packs":
      return <PacksList {...props} />
    case "packNew":
    case "pack":
      return <PackForm {...props} />
    case "words":
      return <Words {...props} />
    case "archived":
      return <Archived {...props} />
  }
}
