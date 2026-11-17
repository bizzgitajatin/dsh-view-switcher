/**
 * Client half of dsh-view-switcher.
 *
 * Emitted as ONE classic script (no imports, no exports) and loaded by the
 * DSH web client module loader: `window.__ModuleLoader__.load({ id, factory })`.
 * The factory returns a Cordis plugin whose `apply` registers a frame-wide
 * overlay entry in the `shell.overlay` slot.
 */

interface ModuleRegistration {
  id: string
  factory(require: (id: string) => unknown): unknown
}

interface LoaderWindow {
  __ModuleLoader__?: { load(registration: ModuleRegistration): void }
}

interface ReactLike {
  Fragment: unknown
  createElement(type: unknown, props?: unknown, ...children: unknown[]): unknown
  useState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void]
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void
}

interface ClientSlots {
  inject(slot: string, contribute: () => void | (() => void)): void
  register(options: Record<string, unknown>, component: unknown): () => void
}

interface ClientContext {
  effect(effect: () => void | (() => void)): void
  slots: ClientSlots
}

type ViewMode = 'auto' | 'mobile' | 'tablet' | 'desktop' | 'fullhd'

const MODES: readonly ViewMode[] = ['auto', 'mobile', 'tablet', 'desktop', 'fullhd']
const WIDTH: Record<ViewMode, number | null> = {
  auto: null,
  mobile: 375,
  tablet: 768,
  desktop: 1280,
  fullhd: 1920,
}
const ROOT_ATTR = 'data-dsh-view-mode'
const OWN_ATTR = 'data-dsh-vs-ui'
const STYLE_ID = 'dsh-view-switcher-styles'

const STYLES = [
  'html[data-dsh-view-mode] #root {',
  '  width: var(--dsh-vs-width) !important;',
  '  max-width: var(--dsh-vs-width) !important;',
  '  margin-inline: auto !important;',
  '  transition: width 0.2s ease, max-width 0.2s ease;',
  '}',
  `[${ROOT_ATTR}="mobile"] { --dsh-vs-width: 375px; }`,
  `[${ROOT_ATTR}="tablet"] { --dsh-vs-width: 768px; }`,
  `[${ROOT_ATTR}="desktop"] { --dsh-vs-width: 1280px; }`,
  `[${ROOT_ATTR}="fullhd"] { --dsh-vs-width: 1920px; }`,
  '.dsh-vs-toolbar {',
  '  position: fixed; top: 10px; right: 10px; z-index: 2147483000;',
  '  display: flex; align-items: center; gap: 4px; padding: 4px;',
  '  flex-wrap: wrap; justify-content: flex-end; max-width: calc(100vw - 20px);',
  '  background: rgba(18, 18, 18, 0.88); border: 1px solid rgba(255, 255, 255, 0.14);',
  '  border-radius: 8px; pointer-events: auto;',
  '  font: 12px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;',
  '  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);',
  '}',
  '.dsh-vs-btn {',
  '  padding: 5px 9px; border: 0; border-radius: 5px; cursor: pointer;',
  '  background: rgba(255, 255, 255, 0.12); color: #eaeaea;',
  '  font: inherit; letter-spacing: 0.4px; transition: background 0.15s ease;',
  '}',
  '.dsh-vs-btn:hover { background: rgba(255, 255, 255, 0.26); }',
  '.dsh-vs-btn--active { background: #1d4ed8; color: #fff; }',
  '.dsh-vs-btn--inspect { background: rgba(220, 38, 38, 0.55); }',
  '.dsh-vs-btn--inspect.dsh-vs-btn--active { background: #dc2626; }',
  '@media (max-width: 520px) {',
  '  .dsh-vs-toolbar { gap: 3px; padding: 3px; }',
  '  .dsh-vs-btn { padding: 5px 6px; letter-spacing: 0.1px; }',
  '}',
  '.dsh-vs-highlight {',
  '  position: fixed; z-index: 2147482998; pointer-events: none;',
  '  border: 2px solid #3b82f6; border-radius: 2px; box-sizing: border-box;',
  '  background: rgba(59, 130, 246, 0.12);',
  '}',
  '.dsh-vs-tooltip {',
  '  position: fixed; z-index: 2147482999; pointer-events: none;',
  '  max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
  '  padding: 3px 7px; border-radius: 4px;',
  '  background: rgba(18, 18, 18, 0.94); color: #fff;',
  '  font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;',
  '}',
  '.dsh-vs-toast {',
  '  margin-left: 4px; padding: 3px 7px; border-radius: 4px;',
  '  background: #14532d; color: #dcfce7; font: inherit;',
  '}',
].join('\n')

interface HoverState {
  selector: string
  left: number
  top: number
  width: number
  height: number
  tipLeft: number
  tipTop: number
}

function cssEscape(value: string): string {
  const scope = globalThis as { CSS?: { escape?: (input: string) => string } }
  const escape = scope.CSS?.escape
  if (typeof escape === 'function') return escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)
}

/** Build a short, readable selector: id → data-testid → classes → nth-of-type path. */
function selectorFor(element: Element): string {
  if (element.id) return `#${cssEscape(element.id)}`

  const parts: string[] = []
  let node: Element | null = element
  for (let depth = 0; node !== null && depth < 4; depth += 1) {
    if (node.id) {
      parts.unshift(`#${cssEscape(node.id)}`)
      break
    }
    const testId = node.getAttribute('data-testid')
    if (testId !== null && testId !== '') {
      parts.unshift(`[data-testid="${cssEscape(testId)}"]`)
      break
    }
    let part = node.tagName.toLowerCase()
    const classes = Array.from(node.classList)
      .filter((name) => !name.startsWith('dsh-vs-'))
      .slice(0, 2)
    if (classes.length > 0) part += classes.map((name) => `.${cssEscape(name)}`).join('')
    const parent: Element | null = node.parentElement
    if (parent !== null) {
      const siblings = Array.from(parent.children).filter((child) => child.tagName === node?.tagName)
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join(' > ')
}

function isOwnUi(element: Element | null): boolean {
  return element !== null && element.closest(`[${OWN_ATTR}]`) !== null
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } catch {
    /* clipboard unavailable */
  }
  textarea.remove()
}

function copyText(text: string): Promise<void> {
  const clipboard = navigator.clipboard as { writeText?: (value: string) => Promise<void> } | undefined
  if (clipboard?.writeText === undefined) {
    fallbackCopy(text)
    return Promise.resolve()
  }
  return clipboard.writeText(text).catch(() => {
    fallbackCopy(text)
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** The built-in browser pane: an `<iframe>` on the web UI, a `<webview>` on desktop. */
const FRAME_SELECTOR = '[data-sidebar-browser-frame]'

/**
 * DSH marks both the web (iframe) and desktop (webview) browser panes with
 * `data-sidebar-browser-frame`. Returns the visible one, or null when no pane
 * is open.
 */
function findBrowserFrame(): HTMLElement | null {
  const frames = Array.from(document.querySelectorAll<HTMLElement>(FRAME_SELECTOR))
  let fallback: HTMLElement | null = null
  for (const frame of frames) {
    const rect = frame.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return frame
    fallback ??= frame
  }
  return fallback
}

/** Width the pane can actually show, in CSS pixels. */
function paneAvailableWidth(frame: HTMLElement): number {
  const parent = frame.parentElement
  const parentWidth = parent === null ? 0 : parent.clientWidth
  return parentWidth > 0 ? parentWidth : window.innerWidth
}

/**
 * Resize the pane frame itself; AUTO hands the width back to the layout.
 * A mode wider than the pane keeps its CSS width — so the page's own media
 * queries see the target viewport — and is scaled down to fit the pane.
 */
function resizeFrame(frame: HTMLElement, mode: ViewMode): void {
  const width = WIDTH[mode]
  const webview = isWebviewFrame(frame) ? frame : null
  if (width === null) {
    frame.style.removeProperty('width')
    frame.style.removeProperty('max-width')
    frame.style.removeProperty('margin-inline')
    frame.style.removeProperty('flex')
    frame.style.removeProperty('zoom')
    if (webview !== null) webview.setZoomFactor?.(1)
    return
  }
  frame.style.removeProperty('max-width')
  // The pane frame is a flex item (`flex:auto` + `width:100%` in DSH's own CSS),
  // so a bare width is stretched back to full size. Stop it growing.
  frame.style.flex = '0 0 auto'
  frame.style.marginInline = 'auto'
  const available = paneAvailableWidth(frame)
  if (width <= available) {
    frame.style.width = `${width}px`
    frame.style.removeProperty('zoom')
    if (webview !== null) webview.setZoomFactor?.(1)
    return
  }
  const scale = available / width
  if (webview !== null && typeof webview.setZoomFactor === 'function') {
    // Electron panes zoom the guest, which also widens its CSS viewport.
    frame.style.width = `${available}px`
    frame.style.removeProperty('zoom')
    webview.setZoomFactor(scale)
    return
  }
  // Web iframes: keep the target width and scale the frame box to fit.
  frame.style.width = `${width}px`
  frame.style.zoom = String(scale)
}

type WebviewElement = HTMLElement & {
  executeJavaScript?(code: string): Promise<unknown>
  setZoomFactor?(factor: number): void
}

/** Electron `<webview>` panes can be scripted by the host; web iframes cannot. */
function isWebviewFrame(frame: HTMLElement): frame is WebviewElement {
  return frame.dataset.sidebarBrowserFrame === 'webview' || frame.tagName.toLowerCase() === 'webview'
}

/**
 * Runs INSIDE the browser page. Draws its own outline/tooltip (the host cannot
 * read the guest DOM) and stores the picked selector on `window.__dshVsPicked`,
 * which the host polls through `webview.executeJavaScript`.
 */
const GUEST_INSPECTOR = String.raw`(function () {
  if (window.__dshVsGuest === true) return 'already'
  window.__dshVsGuest = true
  window.__dshVsPicked = null
  var ESCAPE = /([^a-zA-Z0-9_-])/g
  var outline = document.createElement('div')
  outline.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;' +
    'outline:2px solid #3b82f6;outline-offset:-2px;border-radius:2px;display:none'
  var tip = document.createElement('div')
  tip.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;background:#0f172a;' +
    'color:#e2e8f0;border:1px solid #3b82f6;border-radius:4px;padding:3px 7px;' +
    'font:12px/1.4 Menlo,Consolas,monospace;white-space:nowrap;max-width:70vw;' +
    'overflow:hidden;text-overflow:ellipsis;display:none'
  document.documentElement.appendChild(outline)
  document.documentElement.appendChild(tip)
  function selectorFor(element) {
    if (element.id) return '#' + element.id.replace(ESCAPE, '\\$1')
    var parts = []
    var node = element
    for (var depth = 0; depth < 4 && node && node.nodeType === 1; depth += 1) {
      var part = node.tagName.toLowerCase()
      if (node.classList.length > 0 && node.classList.length <= 2) {
        for (var i = 0; i < node.classList.length; i += 1) {
          part += '.' + node.classList[i].replace(ESCAPE, '\\$1')
        }
      }
      var parent = node.parentElement
      if (parent) {
        var same = 0
        for (var j = 0; j < parent.children.length; j += 1) {
          if (parent.children[j].tagName === node.tagName) same += 1
        }
        if (same > 1) {
          part += ':nth-of-type(' + (Array.prototype.indexOf.call(parent.children, node) + 1) + ')'
        }
      }
      parts.unshift(part)
      node = parent
    }
    return parts.join(' > ')
  }
  function move(event) {
    var element = event.target
    if (!element || element === outline || element === tip) return
    if (element === document.documentElement || element === document.body) return
    var rect = element.getBoundingClientRect()
    outline.style.display = 'block'
    outline.style.left = rect.left + 'px'
    outline.style.top = rect.top + 'px'
    outline.style.width = rect.width + 'px'
    outline.style.height = rect.height + 'px'
    tip.textContent = selectorFor(element)
    tip.style.display = 'block'
    tip.style.left = Math.min(event.clientX + 12, window.innerWidth - 40) + 'px'
    tip.style.top = Math.min(event.clientY + 14, window.innerHeight - 28) + 'px'
  }
  function click(event) {
    if (event.target === outline || event.target === tip) return
    event.preventDefault()
    event.stopPropagation()
    window.__dshVsPicked = selectorFor(event.target)
  }
  function key(event) {
    if (event.key === 'Escape') stop()
  }
  function stop() {
    document.removeEventListener('mousemove', move, true)
    document.removeEventListener('click', click, true)
    document.removeEventListener('keydown', key, true)
    outline.remove()
    tip.remove()
    window.__dshVsGuest = false
    window.__dshVsGuestStop = null
  }
  window.__dshVsGuestStop = stop
  document.addEventListener('mousemove', move, true)
  document.addEventListener('click', click, true)
  document.addEventListener('keydown', key, true)
  return 'installed'
})()`

const GUEST_PICKED = `(function () {
  var value = window.__dshVsPicked
  window.__dshVsPicked = null
  return value === null || value === undefined ? '' : String(value)
})()`

const GUEST_STOP = `(function () {
  if (typeof window.__dshVsGuestStop === 'function') window.__dshVsGuestStop()
  return true
})()`

function createOverlay(React: ReactLike): unknown {
  return function ViewSwitcherOverlay(): unknown {
    const [mode, setMode] = React.useState<ViewMode>('auto')
    const [inspect, setInspect] = React.useState(false)
    const [hover, setHover] = React.useState<HoverState | null>(null)
    const [toast, setToast] = React.useState('')
    const [frame, setFrame] = React.useState<HTMLElement | null>(null)
    const [anchor, setAnchor] = React.useState<{ top: number; right: number } | null>(null)
    let appliedMode: ViewMode = 'auto'

    React.useEffect(() => {
      const update = (): void => {
        const next = findBrowserFrame()
        setFrame(next)
        if (next === null) {
          setAnchor((previous) => (previous === null ? previous : null))
          return
        }
        const rect = next.getBoundingClientRect()
        const top = Math.round(rect.top)
        const right = Math.round(window.innerWidth - rect.right)
        setAnchor((previous) =>
          previous !== null && previous.top === top && previous.right === right ? previous : { top, right },
        )
      }

      update()
      const onResize = (): void => {
        update()
        const current = findBrowserFrame()
        if (current !== null) resizeFrame(current, appliedMode)
      }
      const observer = new MutationObserver(update)
      observer.observe(document.body, { childList: true, subtree: true })
      window.addEventListener('resize', onResize)
      const timer = window.setInterval(update, 750)
      return () => {
        window.removeEventListener('resize', onResize)
        observer.disconnect()
        window.clearInterval(timer)
      }
    }, [])

    React.useEffect(() => {
      if (frame === null || !document.body.contains(frame)) {
        document.documentElement.setAttribute(ROOT_ATTR, mode)
        return
      }
      document.documentElement.removeAttribute(ROOT_ATTR)
      appliedMode = mode
      resizeFrame(frame, mode)
      return () => {
        appliedMode = 'auto'
        resizeFrame(frame, 'auto')
      }
    }, [mode, frame])

    React.useEffect(() => {
      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'F1') {
          event.preventDefault()
          setInspect((previous) => !previous)
          return
        }
        if (event.key === 'Escape') setInspect(false)
      }
      document.addEventListener('keydown', onKeyDown, true)
      return () => {
        document.removeEventListener('keydown', onKeyDown, true)
      }
    }, [])

    React.useEffect(() => {
      if (!inspect) {
        setHover(null)
        return
      }

      // With a browser pane open the inspector belongs to the page inside it
      // (guest script); highlighting the DSH chrome around the pane only
      // confuses. Without a pane, it inspects the DSH UI as before.
      if (frame !== null) {
        setHover(null)
        return
      }

      const previousCursor = document.body.style.cursor
      document.body.style.cursor = 'crosshair'

      const onMove = (event: MouseEvent): void => {
        const target = event.target instanceof Element ? event.target : null
        if (target === null || isOwnUi(target) || target === document.documentElement) return
        if (target.closest(FRAME_SELECTOR) !== null) return
        const rect = target.getBoundingClientRect()
        const tooltipWidth = Math.min(selectorFor(target).length * 7 + 14, window.innerWidth * 0.6)
        setHover({
          selector: selectorFor(target),
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          tipLeft: clamp(event.clientX + 12, 4, window.innerWidth - tooltipWidth - 4),
          tipTop: clamp(event.clientY + 14, 4, window.innerHeight - 28),
        })
      }

      const onClick = (event: MouseEvent): void => {
        const target = event.target instanceof Element ? event.target : null
        if (target === null || isOwnUi(target)) return
        if (target.closest(FRAME_SELECTOR) !== null) return
        event.preventDefault()
        event.stopPropagation()
        const selector = selectorFor(target)
        void copyText(selector).then(() => {
          setToast(`copied ${selector}`)
          window.setTimeout(() => setToast(''), 1600)
        })
      }

      document.addEventListener('mousemove', onMove, true)
      document.addEventListener('click', onClick, true)
      return () => {
        document.removeEventListener('mousemove', onMove, true)
        document.removeEventListener('click', onClick, true)
        document.body.style.cursor = previousCursor
      }
    }, [inspect, frame])

    // Inside the browser pane the page is cross-origin, so the host cannot walk
    // its DOM. Electron webviews accept scripted inspection; web iframes are
    // reported as unreachable instead of silently inspecting the frame element.
    React.useEffect(() => {
      if (!inspect || frame === null) return

      if (isWebviewFrame(frame)) {
        const webview = frame
        const run = (code: string): Promise<unknown> =>
          webview.executeJavaScript === undefined
            ? Promise.resolve(null)
            : webview.executeJavaScript(code).catch(() => null)

        void run(GUEST_INSPECTOR)
        const timer = window.setInterval(() => {
          void run(GUEST_PICKED).then((value) => {
            if (typeof value !== 'string' || value === '') return
            void copyText(value).then(() => {
              setToast(`copied ${value}`)
              window.setTimeout(() => setToast(''), 1600)
            })
          })
        }, 250)
        return () => {
          window.clearInterval(timer)
          void run(GUEST_STOP)
        }
      }

      let sameOrigin = true
      try {
        sameOrigin = (frame as HTMLIFrameElement).contentDocument !== null
      } catch {
        sameOrigin = false
      }
      if (!sameOrigin) {
        setToast('Panel browser lintas-origin: inspektur hanya menjangkau UI DSH')
        const timer = window.setTimeout(() => setToast(''), 2600)
        return () => window.clearTimeout(timer)
      }
      return
    }, [inspect, frame])

    // On the desktop shell the toolbar only exists over a browser pane; without
    // one it would sit on top of the window buttons.
    if (frame === null && isDesktopShell()) return null

    const buttons = MODES.map((candidate) =>
      React.createElement(
        'button',
        {
          key: candidate,
          type: 'button',
          className: candidate === mode ? 'dsh-vs-btn dsh-vs-btn--active' : 'dsh-vs-btn',
          title: WIDTH[candidate] === null ? 'Natural width' : `${WIDTH[candidate]}px`,
          onClick: () => setMode(candidate),
        },
        candidate.toUpperCase(),
      ),
    )

    buttons.push(
      React.createElement(
        'button',
        {
          key: 'inspect',
          type: 'button',
          className: inspect ? 'dsh-vs-btn dsh-vs-btn--inspect dsh-vs-btn--active' : 'dsh-vs-btn dsh-vs-btn--inspect',
          title: 'Element inspector (F1)',
          onClick: () => setInspect((previous) => !previous),
        },
        'INSPECT',
      ),
    )

    const children: unknown[] = [
      React.createElement(
        'div',
        {
          key: 'toolbar',
          className: 'dsh-vs-toolbar',
          role: 'toolbar',
          'aria-label': 'View mode switcher',
          style: anchor === null ? undefined : { top: anchor.top + 8, right: Math.max(anchor.right + 8, 4) },
          [OWN_ATTR]: '',
        },
        ...buttons,
        toast === ''
          ? null
          : React.createElement('span', { key: 'toast', className: 'dsh-vs-toast', [OWN_ATTR]: '' }, toast),
      ),
    ]

    if (inspect && hover !== null) {
      children.push(
        React.createElement('div', {
          key: 'highlight',
          className: 'dsh-vs-highlight',
          [OWN_ATTR]: '',
          style: { left: hover.left, top: hover.top, width: hover.width, height: hover.height },
        }),
        React.createElement(
          'div',
          {
            key: 'tooltip',
            className: 'dsh-vs-tooltip',
            [OWN_ATTR]: '',
            style: { left: hover.tipLeft, top: hover.tipTop },
          },
          hover.selector,
        ),
      )
    }

    return React.createElement(React.Fragment, null, ...children)
  }
}

/**
 * The DSH desktop (Electron) shell owns its window chrome: the OS decides the
 * window size, so a frame-wide toolbar there only collides with the
 * minimize/maximize/close buttons. On desktop the switcher therefore attaches
 * to the built-in browser pane instead of the window. A page that deliberately
 * embeds the client (the demo page) can opt back in through
 * `window.__DSH_VS_FORCE__`.
 */
function isDesktopShell(): boolean {
  const globals = window as unknown as {
    dsh?: unknown
    dshPlatform?: unknown
    dshDesktop?: unknown
    dshDesktopBoot?: unknown
    __DSH_VS_FORCE__?: unknown
  }
  if (globals.__DSH_VS_FORCE__ === true) return false
  if (globals.dsh || globals.dshPlatform || globals.dshDesktop || globals.dshDesktopBoot) return true
  if (location.protocol === 'dsh-app:') return true
  return /Electron\//.test(navigator.userAgent)
}

function apply(ctx: ClientContext, React: ReactLike): void {
  if (isDesktopShell()) {
    console.info('[dsh-view-switcher] DSH desktop shell: the switcher attaches to the built-in browser pane.')
  }

  ctx.effect(() => {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLES
    document.head.appendChild(style)
    document.documentElement.setAttribute(ROOT_ATTR, 'auto')
    return () => {
      style.remove()
      document.documentElement.removeAttribute(ROOT_ATTR)
    }
  })

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'dsh-view-switcher', order: 1000 }, createOverlay(React)),
  )
}

const loader = (window as unknown as LoaderWindow).__ModuleLoader__
loader?.load({
  id: 'dsh-view-switcher',
  factory(require) {
    const React = require('react') as ReactLike
    return {
      inject: ['slots'],
      apply: (ctx: ClientContext) => apply(ctx, React),
    }
  },
})
