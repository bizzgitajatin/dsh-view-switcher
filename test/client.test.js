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

test('desktop shell attaches the switcher to the built-in browser pane', async (t) => {
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
  const disposers = []
  let entry = null
  const ctx = {
    effect(effect) {
      const cleanup = effect()
      if (typeof cleanup === 'function') disposers.push(cleanup)
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
  const doc = shellDom.window.document
  const container = doc.createElement('div')
  doc.body.appendChild(container)
  const root = createRoot(container)

  await t.test('stays hidden while no browser pane is open', async () => {
    root.render(React.createElement(entry.component))
    await tick(120)
    assert.equal(container.querySelector('.dsh-vs-toolbar'), null, 'no toolbar without a browser pane')
  })

  await t.test('renders its toolbar over the browser frame and resizes it', async () => {
    const frame = doc.createElement('iframe')
    frame.setAttribute('data-sidebar-browser-frame', 'webview')
    doc.body.appendChild(frame)
    await tick(180)

    const labels = [...container.querySelectorAll('.dsh-vs-btn')].map((node) => node.textContent)
    assert.deepEqual(labels, ['AUTO', 'MOBILE', 'TABLET', 'DESKTOP', 'FULLHD', 'INSPECT'], 'toolbar follows the pane')
    assert.equal(container.querySelector('.dsh-vs-toolbar').style.top, '8px', 'toolbar anchors to the frame')

    const button = (label) => [...container.querySelectorAll('.dsh-vs-btn')].find((node) => node.textContent === label)
    const click = (node) => node.dispatchEvent(new shellDom.window.MouseEvent('click', { bubbles: true, cancelable: true }))

    click(button('MOBILE'))
    await tick(80)
    assert.equal(frame.style.width, '375px', 'MOBILE resizes the pane frame')
    assert.equal(doc.documentElement.getAttribute('data-dsh-view-mode'), null, 'the page root is left alone')

    click(button('TABLET'))
    await tick(80)
    assert.equal(frame.style.width, '768px', 'TABLET resizes the pane frame')

    click(button('AUTO'))
    await tick(80)
    assert.equal(frame.style.width, '', 'AUTO hands the width back to the layout')
  })

  await t.test('inspects inside the pane through executeJavaScript', async () => {
    const frame = doc.querySelector('[data-sidebar-browser-frame]')
    const calls = []
    let picked = ''
    frame.executeJavaScript = async (code) => {
      calls.push(code)
      return code.includes('__dshVsPicked') ? picked : 'ok'
    }

    doc.dispatchEvent(new shellDom.window.KeyboardEvent('keydown', { key: 'F1', bubbles: true, cancelable: true }))
    await tick(150)
    assert.ok(
      calls.some((code) => code.includes('__dshVsGuest === true')),
      'the guest inspector is installed inside the webview',
    )

    picked = 'button.primary'
    await tick(400)
    const toast = container.querySelector('.dsh-vs-toast')
    assert.ok(toast !== null, 'the guest selection is reported back')
    assert.match(toast.textContent, /copied button\.primary/, 'the guest selector is copied')

    doc.dispatchEvent(new shellDom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick(120)
    assert.ok(
      calls.some((code) => code.includes('__dshVsGuestStop')),
      'leaving inspect mode stops the guest inspector',
    )
    frame.remove()
  })

  await t.test('cleanup releases the overlay', async () => {
    root.unmount()
    await tick(60)
    for (const dispose of disposers) dispose()
    assert.equal(doc.getElementById('dsh-view-switcher-styles'), null, 'cleanup removes the style element')
  })
})
