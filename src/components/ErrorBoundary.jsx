import { Component } from 'react'

/**
 * Catches render-time errors so a single broken component shows a recoverable
 * message instead of unmounting the whole page into a blank white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Kept in the console so the problem is still diagnosable in production,
    // where the fallback hides the stack from the visitor.
    console.error('Erro inesperado na interface:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="error-boundary" role="alert">
        <h2>Algo deu errado</h2>
        <p>
          Não conseguimos carregar esta parte do site. Recarregue a página — se
          o problema continuar, entre em contato conosco por telefone.
        </p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Recarregar página
        </button>
      </div>
    )
  }
}
