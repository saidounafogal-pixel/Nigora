import { Component, type ReactNode } from 'react'

/** En cas d'erreur inattendue, les numéros d'urgence restent toujours accessibles */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[NIGORA]', error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-6 text-center">
        <p className="text-2xl font-bold">Un problème est survenu</p>
        <p className="text-sm text-white/60">Vos données sont conservées sur le téléphone. En cas d’urgence, appelez directement :</p>
        <div className="grid grid-cols-3 gap-2">
          {[['15', 'SAMU'], ['17', 'Police'], ['18', 'Pompiers']].map(([n, l]) => (
            <a key={n} href={`tel:${n}`} className="rounded-3xl bg-red-600 py-4 font-black">
              <span className="block text-3xl">{n}</span>
              <span className="text-xs">{l}</span>
            </a>
          ))}
        </div>
        <button onClick={() => (location.href = '/')} className="rounded-full bg-white py-3 font-bold text-black">
          Recharger NIGORA
        </button>
      </div>
    )
  }
}
