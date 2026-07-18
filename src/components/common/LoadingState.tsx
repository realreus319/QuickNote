export function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-sm text-text-secondary" role="status">
      <span className="relative flex size-8 items-center justify-center" aria-hidden="true">
        <span className="absolute size-8 animate-ping rounded-full bg-accent/15" />
        <span className="size-2.5 rounded-full bg-accent" />
      </span>
      <span>{label}</span>
    </div>
  )
}
