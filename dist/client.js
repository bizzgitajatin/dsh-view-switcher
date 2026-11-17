"use strict";
/**
 * Client half of dsh-view-switcher.
 *
 * Emitted as ONE classic script (no imports, no exports) and loaded by the
 * DSH web client module loader: `window.__ModuleLoader__.load({ id, factory })`.
 * The factory returns a Cordis plugin whose `apply` registers a frame-wide
 * overlay entry in the `shell.overlay` slot.
 */
const MODES = ['auto', 'mobile', 'tablet', 'desktop', 'fullhd'];
const WIDTH = {
    auto: null,
    mobile: 375,
    tablet: 768,
    desktop: 1280,
    fullhd: 1920,
};
const ROOT_ATTR = 'data-dsh-view-mode';
const OWN_ATTR = 'data-dsh-vs-ui';
const STYLE_ID = 'dsh-view-switcher-styles';
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
].join('\n');
function cssEscape(value) {
    const scope = globalThis;
    const escape = scope.CSS?.escape;
    if (typeof escape === 'function')
        return escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
}
/** Build a short, readable selector: id → data-testid → classes → nth-of-type path. */
function selectorFor(element) {
    if (element.id)
        return `#${cssEscape(element.id)}`;
    const parts = [];
    let node = element;
    for (let depth = 0; node !== null && depth < 4; depth += 1) {
        if (node.id) {
            parts.unshift(`#${cssEscape(node.id)}`);
            break;
        }
        const testId = node.getAttribute('data-testid');
        if (testId !== null && testId !== '') {
            parts.unshift(`[data-testid="${cssEscape(testId)}"]`);
            break;
        }
        let part = node.tagName.toLowerCase();
        const classes = Array.from(node.classList)
            .filter((name) => !name.startsWith('dsh-vs-'))
            .slice(0, 2);
        if (classes.length > 0)
            part += classes.map((name) => `.${cssEscape(name)}`).join('');
        const parent = node.parentElement;
        if (parent !== null) {
            const siblings = Array.from(parent.children).filter((child) => child.tagName === node?.tagName);
            if (siblings.length > 1)
                part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = parent;
    }
    return parts.join(' > ');
}
function isOwnUi(element) {
    return element !== null && element.closest(`[${OWN_ATTR}]`) !== null;
}
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
    }
    catch {
        /* clipboard unavailable */
    }
    textarea.remove();
}
function copyText(text) {
    const clipboard = navigator.clipboard;
    if (clipboard?.writeText === undefined) {
        fallbackCopy(text);
        return Promise.resolve();
    }
    return clipboard.writeText(text).catch(() => {
        fallbackCopy(text);
    });
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function createOverlay(React) {
    return function ViewSwitcherOverlay() {
        const [mode, setMode] = React.useState('auto');
        const [inspect, setInspect] = React.useState(false);
        const [hover, setHover] = React.useState(null);
        const [toast, setToast] = React.useState('');
        React.useEffect(() => {
            document.documentElement.setAttribute(ROOT_ATTR, mode);
        }, [mode]);
        React.useEffect(() => {
            const onKeyDown = (event) => {
                if (event.key === 'F1') {
                    event.preventDefault();
                    setInspect((previous) => !previous);
                    return;
                }
                if (event.key === 'Escape')
                    setInspect(false);
            };
            document.addEventListener('keydown', onKeyDown, true);
            return () => {
                document.removeEventListener('keydown', onKeyDown, true);
            };
        }, []);
        React.useEffect(() => {
            if (!inspect) {
                setHover(null);
                return;
            }
            const previousCursor = document.body.style.cursor;
            document.body.style.cursor = 'crosshair';
            const onMove = (event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (target === null || isOwnUi(target) || target === document.documentElement)
                    return;
                const rect = target.getBoundingClientRect();
                const tooltipWidth = Math.min(selectorFor(target).length * 7 + 14, window.innerWidth * 0.6);
                setHover({
                    selector: selectorFor(target),
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    tipLeft: clamp(event.clientX + 12, 4, window.innerWidth - tooltipWidth - 4),
                    tipTop: clamp(event.clientY + 14, 4, window.innerHeight - 28),
                });
            };
            const onClick = (event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (target === null || isOwnUi(target))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const selector = selectorFor(target);
                void copyText(selector).then(() => {
                    setToast(`copied ${selector}`);
                    window.setTimeout(() => setToast(''), 1600);
                });
            };
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('click', onClick, true);
            return () => {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('click', onClick, true);
                document.body.style.cursor = previousCursor;
            };
        }, [inspect]);
        const buttons = MODES.map((candidate) => React.createElement('button', {
            key: candidate,
            type: 'button',
            className: candidate === mode ? 'dsh-vs-btn dsh-vs-btn--active' : 'dsh-vs-btn',
            title: WIDTH[candidate] === null ? 'Natural width' : `${WIDTH[candidate]}px`,
            onClick: () => setMode(candidate),
        }, candidate.toUpperCase()));
        buttons.push(React.createElement('button', {
            key: 'inspect',
            type: 'button',
            className: inspect ? 'dsh-vs-btn dsh-vs-btn--inspect dsh-vs-btn--active' : 'dsh-vs-btn dsh-vs-btn--inspect',
            title: 'Element inspector (F1)',
            onClick: () => setInspect((previous) => !previous),
        }, 'INSPECT'));
        const children = [
            React.createElement('div', {
                key: 'toolbar',
                className: 'dsh-vs-toolbar',
                role: 'toolbar',
                'aria-label': 'View mode switcher',
                [OWN_ATTR]: '',
            }, ...buttons, toast === ''
                ? null
                : React.createElement('span', { key: 'toast', className: 'dsh-vs-toast', [OWN_ATTR]: '' }, toast)),
        ];
        if (inspect && hover !== null) {
            children.push(React.createElement('div', {
                key: 'highlight',
                className: 'dsh-vs-highlight',
                [OWN_ATTR]: '',
                style: { left: hover.left, top: hover.top, width: hover.width, height: hover.height },
            }), React.createElement('div', {
                key: 'tooltip',
                className: 'dsh-vs-tooltip',
                [OWN_ATTR]: '',
                style: { left: hover.tipLeft, top: hover.tipTop },
            }, hover.selector));
        }
        return React.createElement(React.Fragment, null, ...children);
    };
}
/**
 * The DSH desktop (Electron) shell owns its window chrome: the OS decides the
 * window size, so a view-mode toolbar there only collides with the
 * minimize/maximize/close buttons. The switcher is a web-UI tool, so it stays
 * out of the desktop shell. A page that deliberately embeds the client (the
 * demo page) can opt back in through `window.__DSH_VS_FORCE__`.
 */
function isDesktopShell() {
    const globals = window;
    if (globals.__DSH_VS_FORCE__ === true)
        return false;
    if (globals.dsh || globals.dshPlatform || globals.dshDesktop || globals.dshDesktopBoot)
        return true;
    if (location.protocol === 'dsh-app:')
        return true;
    return /Electron\//.test(navigator.userAgent);
}
function apply(ctx, React) {
    if (isDesktopShell()) {
        console.info('[dsh-view-switcher] DSH desktop shell detected: the switcher only runs in the web UI.');
        return;
    }
    ctx.effect(() => {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = STYLES;
        document.head.appendChild(style);
        document.documentElement.setAttribute(ROOT_ATTR, 'auto');
        return () => {
            style.remove();
            document.documentElement.removeAttribute(ROOT_ATTR);
        };
    });
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-view-switcher', order: 1000 }, createOverlay(React)));
}
const loader = window.__ModuleLoader__;
loader?.load({
    id: 'dsh-view-switcher',
    factory(require) {
        const React = require('react');
        return {
            inject: ['slots'],
            apply: (ctx) => apply(ctx, React),
        };
    },
});
