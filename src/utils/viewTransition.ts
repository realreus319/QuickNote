export function runWithViewTransition(action: () => void | Promise<void>) {
  const documentWithTransition = document as Document & {
    startViewTransition?: (callback: () => void | Promise<void>) => void
  }

  if (typeof documentWithTransition.startViewTransition === 'function') {
    documentWithTransition.startViewTransition(() => action())
    return
  }

  void action()
}
