// @vitest-environment jsdom
/** If a screen crashes, people get an explanation and a way out, not a blank page. */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../src/components/ErrorBoundary'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Boom(): JSX.Element {
  throw new Error('kaboom')
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('the crash screen', () => {
  it('replaces a crashed screen with an explanation and a Start again button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}) // React logs the throw; keep output clean
    const host = document.createElement('div')
    document.body.appendChild(host)
    act(() => {
      createRoot(host).render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      )
    })
    expect(host.textContent).toMatch(/Something went wrong/)
    expect(host.querySelector('button')?.textContent).toBe('Start again')
    expect(host.textContent).toMatch(/kaboom/)
  })

  it('shows the app normally when nothing goes wrong', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    act(() => {
      createRoot(host).render(
        <ErrorBoundary>
          <p>all good</p>
        </ErrorBoundary>,
      )
    })
    expect(host.textContent).toBe('all good')
  })
})
