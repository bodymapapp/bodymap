// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Marketing pages
import Home from './pages/Home';
import Pricing from './pages/Pricing';
import WhyBodyMap from './pages/WhyBodyMap';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

// Auth pages
import Signup from './pages/Signup';
import Login from './pages/Login';

// Protected pages
import Dashboard from './pages/Dashboard';
import TestDashboard from './pages/TestDashboard';

// Client intake pages
import ClientIntake from './pages/ClientIntake';
import ThankYou from './pages/ThankYou';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Marketing pages */}
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/why-bodymap" element={<WhyBodyMap />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Auth pages */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />

          {/* Protected pages (require login) */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          {/* Test route - NO AUTH REQUIRED */}
          <Route path="/test" element={<TestDashboard />} />

          {/* Client intake (public) */}
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/:customUrl" element={<ClientIntake />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;