import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ResearchPage from './pages/ResearchPage';
import TradingDashboard from './pages/TradingDashboard';
import Reflection from './pages/Reflection';
import Stats from './pages/Stats';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ResearchPage />} />
        <Route path="/trade" element={<TradingDashboard />} />
        <Route path="/reflection" element={<Reflection />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
