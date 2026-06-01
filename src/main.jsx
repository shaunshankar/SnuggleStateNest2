import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2340',
              color: '#ffffff',
              border: '1px solid rgba(201,168,76,0.25)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem'
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
