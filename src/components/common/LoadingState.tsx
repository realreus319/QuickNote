export function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-text-secondary">
      {label}
    </div>
  )
}
