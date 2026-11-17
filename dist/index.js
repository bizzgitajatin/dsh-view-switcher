export const name = 'dsh-view-switcher';
/**
 * Host half of the plugin.
 *
 * The DSH host process has no DOM, so this half is deliberately inert: the
 * toolbar, the viewport switch and the element inspector all live in the
 * browser half (`src/client.ts`, declared through `dsh.client` in
 * package.json and served as `./client`).
 */
export function apply(_ctx) {
    // Intentionally empty; all behaviour is in the client half.
}
