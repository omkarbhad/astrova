import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './components/landing/HomePage';
import ChartPage from './pages/ChartPage';
import AdminPage from './pages/AdminPage';

// Auth: Firebase Google sign-in (popup) directly on Astrova
// /login redirects to /chart

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Navigate to="/chart" replace />} />
        <Route path="/chart" element={<ChartPage />} />
        <Route path="/match" element={<ChartPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
