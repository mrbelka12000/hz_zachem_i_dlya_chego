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
import { AccountsList } from './pages/Accounts/List'
import { NewAccount } from './pages/Accounts/New'
import { EditAccount } from './pages/Accounts/Edit'
import { CategoriesList } from './pages/Categories/List'
import { NewCategory } from './pages/Categories/New'
import { EditCategory } from './pages/Categories/Edit'
import { CsvImport } from './pages/Imports/CsvImport'

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
          <Route
            path="/accounts"
            element={
              <Protected>
                <AccountsList />
              </Protected>
            }
          />
          <Route
            path="/accounts/new"
            element={
              <Protected>
                <NewAccount />
              </Protected>
            }
          />
          <Route
            path="/accounts/:id/edit"
            element={
              <Protected>
                <EditAccount />
              </Protected>
            }
          />
          <Route
            path="/categories"
            element={
              <Protected>
                <CategoriesList />
              </Protected>
            }
          />
          <Route
            path="/categories/new"
            element={
              <Protected>
                <NewCategory />
              </Protected>
            }
          />
          <Route
            path="/categories/:id/edit"
            element={
              <Protected>
                <EditCategory />
              </Protected>
            }
          />
          <Route
            path="/imports"
            element={
              <Protected>
                <CsvImport />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
