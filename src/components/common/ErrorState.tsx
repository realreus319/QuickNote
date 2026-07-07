interface ErrorStateProps {
  title?: string
  description: string
}

export function ErrorState({
  title = '出现了一点问题',
  description,
}: ErrorStateProps) {
  return (
    <div className="rounded-[28px] border border-[rgba(204,95,76,0.18)] bg-white/90 px-5 py-4">
      <p className="text-sm font-semibold text-[color:var(--color-danger)]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
    </div>
  )
}
