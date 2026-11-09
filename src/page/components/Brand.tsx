import { Icon } from "./Icon"

/**
 * The product mark: the same lock-up in the sidebar, on the setup pages, and
 * in the boot state. The word "Wizard" carries the accent colour.
 */
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <Icon name="sparkle" size={22} />
      </span>
      <b className="brand-name">
        Words<em>Wizard</em>
      </b>
    </div>
  )
}
