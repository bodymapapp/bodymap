// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import WhyBodyMap from './pages/WhyBodyMap';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientIntake from './pages/ClientIntake';
import ThankYou from './pages/ThankYou';
import Feedback from './pages/Feedback';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/why-bodymap" element={<WhyBodyMap />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard view="clients" /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Dashboard view="settings" /></ProtectedRoute>} />
          <Route path="/dashboard/clients/:clientId" element={<ProtectedRoute><Dashboard view="sessions" /></ProtectedRoute>} />
          <Route path="/dashboard/clients/:clientId/sessions/:sessionId" element={<ProtectedRoute><Dashboard view="session-detail" /></ProtectedRoute>} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/:customUrl/feedback/:sessionId" element={<Feedback />} />
          <Route path="/:customUrl" element={<ClientIntake />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
