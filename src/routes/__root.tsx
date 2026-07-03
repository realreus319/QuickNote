import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/app/AppShell'

function RootLayout() {
  return (
    <TooltipProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
