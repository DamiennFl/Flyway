import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import App from './App.jsx'

const ONE_DAY = 24 * 60 * 60 * 1000

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_DAY,
      gcTime: ONE_DAY,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
