import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ArbitratorDetail } from './pages/ArbitratorDetail';
import { Arbitrators } from './pages/Arbitrators';
import { CaseDetail } from './pages/CaseDetail';
import { Cases } from './pages/Cases';
import { Dashboard } from './pages/Dashboard';
import { DocumentRegister } from './pages/DocumentRegister';
import { Hearings } from './pages/Hearings';
import { Login } from './pages/Login';
import { NewCase } from './pages/NewCase';
import { Notifications } from './pages/Notifications';
import { Organizations } from './pages/Organizations';
import { Parties } from './pages/Parties';
import { Projects } from './pages/Projects';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';

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
              <Route path="/documents" element={<DocumentRegister />} />
              <Route path="/hearings" element={<Hearings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route element={<ProtectedRoute allowedRoles={['admin', 'registrar', 'staff']} />}>
                <Route path="/arbitrators" element={<Arbitrators />} />
                <Route path="/arbitrators/:arbitratorId" element={<ArbitratorDetail />} />
                <Route path="/parties" element={<Parties />} />
                <Route path="/organizations" element={<Organizations />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<Users />} />
                <Route path="/cases/new" element={<NewCase />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
