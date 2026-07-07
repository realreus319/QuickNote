import { Outlet, createFileRoute } from '@tanstack/react-router'

function NotesLayout() {
  return <Outlet />
}

export const Route = createFileRoute('/notes')({
  component: NotesLayout,
})
