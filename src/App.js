// src/App.js
import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import posthog from 'posthog-js';
import ScrollToTop from './components/ScrollToTop';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import WhyBodyMap from './pages/WhyBodyMap';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CalConnect from './pages/CalConnect';
import StripeConnect from './pages/StripeConnect';
import ScheduleDashboard from './components/ScheduleDashboard';
import BillingDashboard from './components/BillingDashboard';
import AIDashboard from './components/AIDashboard';
import ClientIntake from './pages/ClientIntake';
import BookingPage from './pages/BookingPage';
import DepositSuccess from './pages/DepositSuccess';
import ThankYou from './pages/ThankYou';
import Feedback from './pages/Feedback';
import CareSummary from './pages/CareSummary';
import PreSessionBrief from './pages/PreSessionBrief';
import PostSessionBrief from './pages/PostSessionBrief';
import Onboarding from './pages/Onboarding';

posthog.init('phc_qmIcERdaYLksKAU1Sa4wYht7ngmk5wP5JKyCHrWiw1H', { api_host: 'https://us.i.posthog.com' });

function App() {
  return (
    <AuthProvider>
      <Router>
      <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/why-bodymap" element={<WhyBodyMap />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard view="clients" /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Dashboard view="settings" /></ProtectedRoute>} />
          <Route path="/dashboard/gifts" element={<ProtectedRoute><Dashboard view="gifts" /></ProtectedRoute>} />
          <Route path="/dashboard/schedule" element={<ProtectedRoute><Dashboard view="schedule" /></ProtectedRoute>} />
          <Route path="/dashboard/billing" element={<ProtectedRoute><Dashboard view="billing" /></ProtectedRoute>} />
          <Route path="/dashboard/ai" element={<ProtectedRoute><Dashboard view="ai" /></ProtectedRoute>} />
          <Route path="/dashboard/clients/:clientId" element={<ProtectedRoute><Dashboard view="sessions" /></ProtectedRoute>} />
          <Route path="/dashboard/clients/:clientId/sessions/:sessionId" element={<ProtectedRoute><Dashboard view="session-detail" /></ProtectedRoute>} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/:customUrl/feedback/:sessionId" element={<Feedback />} />
          <Route path="/summary/:code" element={<CareSummary />} />
          <Route path="/brief/pre/:sessionId" element={<PreSessionBrief />} />
          <Route path="/brief/post/:sessionId" element={<PostSessionBrief />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard/cal-connect" element={<ProtectedRoute><CalConnect /></ProtectedRoute>} />
          <Route path="/dashboard/stripe-connect" element={<ProtectedRoute><StripeConnect /></ProtectedRoute>} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/deposit-success" element={<DepositSuccess />} />
          <Route path="/:customUrl" element={<ClientIntake />} />
        </Routes>
        <Analytics />
</Router>
    </AuthProvider>
  );
}

export default App;
