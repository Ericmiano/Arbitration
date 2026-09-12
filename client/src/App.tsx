import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Arbitrators } from './pages/Arbitrators';
import { CaseDetail } from './pages/CaseDetail';
import { Cases } from './pages/Cases';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Organizations } from './pages/Organizations';
import { Parties } from './pages/Parties';
import { Projects } from './pages/Projects';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/cases/:caseId" element={<CaseDetail />} />
              <Route element={<ProtectedRoute allowedRoles={['admin', 'registrar', 'staff']} />}>
                <Route path="/arbitrators" element={<Arbitrators />} />
                <Route path="/parties" element={<Parties />} />
                <Route path="/organizations" element={<Organizations />} />
                <Route path="/projects" element={<Projects />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
