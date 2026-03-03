import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Disponibilidade from './pages/Disponibilidade';
import Escalas from './pages/Escalas';
import Checklists from './pages/Checklists';
import Roteiro from './pages/Roteiro';
import Academia from './pages/Academia';
import Ranking from './pages/Ranking';
import Impacto from './pages/Impacto';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="perfil" element={<Profile />} />
          <Route path="disponibilidade" element={<Disponibilidade />} />
          <Route path="escalas" element={<Escalas />} />
          <Route path="checklists" element={<Checklists />} />
          <Route path="roteiro" element={<Roteiro />} />
          <Route path="academia" element={<Academia />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="impacto" element={<Impacto />} />
          <Route path="admin" element={<AdminPanel />} />
          <Route path="*" element={<div className="p-8 text-center text-muted-foreground">Em breve...</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
