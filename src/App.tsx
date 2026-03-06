import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './components/landing/HomePage';
import ChartPage from './pages/ChartPage';
import AdminPage from './pages/AdminPage';

// Auth is now centralized at auth.magnova.ai
// AuthGuard on protected routes redirects there automatically

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chart" element={<ChartPage />} />
        <Route path="/match" element={<ChartPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
