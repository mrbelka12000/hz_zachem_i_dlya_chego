import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { TransactionsList } from './pages/Transactions/List'
import { NewTransaction } from './pages/Transactions/New'
import { EditTransaction } from './pages/Transactions/Edit'
import { CreateTransfer } from './pages/Transactions/Transfer'

function Protected({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/transactions"
            element={
              <Protected>
                <TransactionsList />
              </Protected>
            }
          />
          <Route
            path="/transactions/new"
            element={
              <Protected>
                <NewTransaction />
              </Protected>
            }
          />
          <Route
            path="/transactions/transfer"
            element={
              <Protected>
                <CreateTransfer />
              </Protected>
            }
          />
          <Route
            path="/transactions/:id/edit"
            element={
              <Protected>
                <EditTransaction />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
