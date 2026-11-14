/**
 * The last line of defence: if any screen crashes, show a short explanation and
 * a way to start again, instead of leaving a blank page.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the browser console for anyone debugging; nothing is sent anywhere.
    console.error('Spotify Mapped crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="loading" role="alert">
        <div style={{ maxWidth: 440, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 650, marginBottom: 8 }}>Something went wrong</div>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 18px' }}>
            The analysis hit an error it could not recover from. Nothing was saved or sent
            anywhere, so starting again is safe. You will need to choose your file again.
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              window.location.href = window.location.pathname
            }}
          >
            Start again
          </button>
          <details style={{ marginTop: 18, textAlign: 'left', color: 'var(--text-muted)', fontSize: 12.5 }}>
            <summary style={{ cursor: 'pointer' }}>Technical details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    )
  }
}
