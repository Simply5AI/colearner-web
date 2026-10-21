'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, ErrorState } from './primitives'

interface Props { children: ReactNode; onError?: (error: Error, info: ErrorInfo) => void }
interface State { failed: boolean }

export class FoundationErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { this.props.onError?.(error, info) }
  reset = () => this.setState({ failed: false })
  render() { return this.state.failed ? <ErrorState title="This view could not load" description="Try loading it again." action={<Button onClick={this.reset}>Try again</Button>} /> : this.props.children }
}
