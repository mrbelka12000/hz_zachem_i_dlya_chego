import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { Welcome } from './pages/Welcome'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="*" element={<Welcome />} />
      </Routes>
    </BrowserRouter>
  )
}
