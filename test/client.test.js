import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

const tick = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms))

const require = createRequire(import.meta.url)
const React = require('react')
const { createRoot } = require('react-dom/client')

const dom = new JSDOM(
  '<!doctype html><html><head></head><body>' +
    '<div id="root"><div id="app"><button id="deep-btn">deep</button></div></div>' +
    '</body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' },
)
const { window } = dom
const { document } = window

globalThis.window = window
globalThis.document = document
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
globalThis.MouseEvent = window.MouseEvent
globalThis.KeyboardEvent = window.KeyboardEvent

let registration = null
window.__ModuleLoader__ = {
  load(value) {
    registration = value
  },
}

let copied = null
Object.defineProperty(window.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (text) => {
      copied = text
    },
  },
})

test('client plugin registers, renders, switches modes, inspects and cleans up', async (t) => {
  vm.runInContext(
    readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'),
    dom.getInternalVMContext(),
  )

  await t.test('registers a factory under the package id', () => {
    assert.equal(registration?.id, 'dsh-view-switcher', 'client registers its factory id')
  })

  const required = []
  const plugin = registration.factory((id) => {
    required.push(id)
    if (id === 'react') return React
    throw new Error(`unexpected require: ${id}`)
  })

  await t.test('injects the slots service and only requires react', () => {
    assert.equal(plugin.inject.join(','), 'slots', 'client plugin injects the slots service')
    assert.equal(required.join(','), 'react', 'only the react module is required')
  })

  const cleanups = []
  let entry = null
  const ctx = {
    effect(effect) {
      cleanups.push(effect())
    },
    slots: {
      inject(name, contribute) {
        assert.equal(name, 'shell.overlay', 'registers into the frame-wide overlay slot')
        contribute()
      },
      register(options, component) {
        entry = { options, component }
        return () => {}
      },
    },
  }

  plugin.apply(ctx)

  await t.test('mounts into the overlay slot and styles the root', () => {
    assert.ok(document.getElementById('dsh-view-switcher-styles') !== null, 'style element injected')
    assert.equal(document.documentElement.getAttribute('data-dsh-view-mode'), 'auto', 'default mode is auto')
    assert.equal(entry?.options.name, 'shell.overlay')
    assert.equal(entry?.options.id, 'dsh-view-switcher')
    assert.equal(typeof entry.component, 'function')
  })

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(React.createElement(entry.component))
  await tick(80)

  const button = (label) => [...container.querySelectorAll('.dsh-vs-btn')].find((node) => node.textContent === label)
  const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

  await t.test('renders the toolbar buttons', () => {
    const labels = [...container.querySelectorAll('.dsh-vs-btn')].map((node) => node.textContent)
    assert.deepEqual(labels, ['AUTO', 'MOBILE', 'TABLET', 'DESKTOP', 'FULLHD', 'INSPECT'], 'toolbar buttons render')
  })

  await t.test('switches view mode from the toolbar', async () => {
    click(button('MOBILE'))
    await tick()
    assert.equal(
      document.documentElement.getAttribute('data-dsh-view-mode'),
      'mobile',
      'MOBILE switches the root attribute',
    )
    assert.ok(button('MOBILE').className.includes('dsh-vs-btn--active'))

    click(button('FULLHD'))
    await tick()
    assert.equal(document.documentElement.getAttribute('data-dsh-view-mode'), 'fullhd')
  })

  await t.test('inspects an element with F1 and copies its selector', async () => {
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true }))
    await tick()
    assert.ok(button('INSPECT').className.includes('dsh-vs-btn--active'), 'F1 enables the inspector')

    const deep = document.getElementById('deep-btn')
    deep.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 40 }))
    await tick()
    const tooltip = container.querySelector('.dsh-vs-tooltip')
    assert.ok(tooltip !== null, 'inspector shows a tooltip')
    assert.equal(tooltip.textContent, '#deep-btn', 'tooltip carries the target selector')
    assert.ok(container.querySelector('.dsh-vs-highlight') !== null, 'inspector draws a highlight')

    click(deep)
    await tick()
    assert.equal(copied, '#deep-btn', 'clicking copies the selector')
    assert.ok(container.querySelector('.dsh-vs-toast') !== null, 'toast confirms the copy')

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    assert.equal(container.querySelector('.dsh-vs-tooltip'), null, 'Escape leaves inspect mode')
  })

  await t.test('cleanup removes styles and the root attribute', async () => {
    root.unmount()
    await tick()
    for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup()
    assert.equal(document.getElementById('dsh-view-switcher-styles'), null, 'cleanup removes the style element')
    assert.equal(document.documentElement.getAttribute('data-dsh-view-mode'), null, 'cleanup clears the root attribute')
  })
})

test('stays dormant inside the DSH desktop shell', async (t) => {
  const shellDom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  })
  shellDom.window.dshPlatform = { platform: 'win32' }
  let shellRegistration = null
  shellDom.window.__ModuleLoader__ = {
    load(value) {
      shellRegistration = value
    },
  }
  vm.runInContext(
    readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8'),
    shellDom.getInternalVMContext(),
  )

  const plugin = shellRegistration.factory(() => React)
  let effects = 0
  let injects = 0
  const disposers = []
  const ctx = {
    effect(effect) {
      effects += 1
      const cleanup = effect()
      if (typeof cleanup === 'function') disposers.push(cleanup)
    },
    slots: {
      inject() {
        injects += 1
      },
      register() {
        throw new Error('the desktop shell must not register the overlay')
      },
    },
  }

  plugin.apply(ctx)

  await t.test('does not touch the DOM or the overlay slot', () => {
    assert.equal(effects, 0, 'no effect is registered in the desktop shell')
    assert.equal(injects, 0, 'no overlay is contributed in the desktop shell')
    assert.equal(shellDom.window.document.getElementById('dsh-view-switcher-styles'), null)
  })

  await t.test('__DSH_VS_FORCE__ opts a page back in', () => {
    shellDom.window.__DSH_VS_FORCE__ = true
    plugin.apply(ctx)
    assert.equal(effects, 1, 'the forced page registers its effect')
    assert.equal(injects, 1, 'the forced page contributes the overlay')
    assert.ok(shellDom.window.document.getElementById('dsh-view-switcher-styles') !== null)
    for (const dispose of disposers) dispose()
  })
})
