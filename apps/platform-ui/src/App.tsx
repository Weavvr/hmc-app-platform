import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import FeatureBrowser from './pages/FeatureBrowser';
import AppBuilder from './pages/AppBuilder';
import NLPInterface from './pages/NLPInterface';
import RequestQueue from './pages/RequestQueue';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/features" replace />} />
        <Route path="features" element={<FeatureBrowser />} />
        <Route path="builder" element={<AppBuilder />} />
        <Route path="assistant" element={<NLPInterface />} />
        <Route path="requests" element={<RequestQueue />} />
        <Route path="*" element={<Navigate to="/features" replace />} />
      </Route>
    </Routes>
  );
}
