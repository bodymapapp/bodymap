// src/App.js
import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import posthog from 'posthog-js';
import ScrollToTop from './components/ScrollToTop';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Features from './pages/Features';
import FeaturesV2 from './pages/FeaturesV2';
import Pricing from './pages/Pricing';
// Contact page replaced by /help (May 7, 2026 per HK direction).
// Redirect handles old links and SEO.
import Privacy from './pages/Privacy';
import Security from './pages/Security';
import Terms from './pages/Terms';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IntakeEditor from './pages/IntakeEditor';
import PracticeAgreementPrint from './pages/PracticeAgreementPrint';
import AgreementSign from './pages/AgreementSign';
import CalConnect from './pages/CalConnect';
import StripeConnect from './pages/StripeConnect';
import StripeConnectStandard from './pages/StripeConnectStandard';
import FounderHub from './pages/FounderHub';
import Help from './pages/Help';
import FounderRoute from './components/FounderRoute';
import TestModeBanner from './components/TestModeBanner';
import PaymentMethodComparisonMockup from './components/mockups/PaymentMethodComparisonMockup';
import PaymentEvolutionMockup from './components/mockups/PaymentEvolutionMockup';
import ScheduleDashboard from './components/ScheduleDashboard';
import BillingDashboard from './components/BillingDashboard';
import AIDashboard from './components/AIDashboard';
import ClientIntake from './pages/ClientIntake';
import Demo from './pages/Demo';
import WhyBodyMap from './pages/WhyBodyMap';
import Campaigns from './pages/Campaigns';
import Comparison from './pages/Comparison';
import ComparisonPrintable from './pages/ComparisonPrintable';
import BookingPage from './pages/BookingPage';
import DepositSuccess from './pages/DepositSuccess';
import ThankYou from './pages/ThankYou';
import Feedback from './pages/Feedback';
import CareSummary from './pages/CareSummary';
import AdminFunnel from './pages/AdminFunnel';
import PreSessionBrief from './pages/PreSessionBrief';
import PostSessionBrief from './pages/PostSessionBrief';
import PostSessionSummary from './pages/PostSessionSummary';
import IntakeBrief from './pages/IntakeBrief';
import FounderSeedDemo from './pages/FounderSeedDemo';
import StripeDebug from './pages/StripeDebug';
import GiftCardPrint from './pages/GiftCardPrint';
import Unsubscribe from './pages/Unsubscribe';
import Onboarding from './pages/Onboarding';
import FounderDashboard from './components/FounderDashboard';
import EmailReview from './components/EmailReview';
import VerifyPhone from './pages/VerifyPhone';

posthog.init('phc_qmIcERdaYLksKAU1Sa4wYht7ngmk5wP5JKyCHrWiw1H', { api_host: 'https://us.i.posthog.com' });

function App() {
  return (
    <AuthProvider>
      <Router>
      <ScrollToTop />
      <TestModeBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<FeaturesV2 />} />
          <Route path="/features-v2" element={<FeaturesV2 />} />
          <Route path="/features-old" element={<Features />} />
          {/* Internal design mockup, not linked from public nav. Lives at
              /mockups/payment-methods so HK can preview the three
              alternative payment-method UIs (ACH, Zelle/FedNow, Apple Pay)
              before deciding to build any of them. Show to therapists
              asking 'can I use my bank instead' for a real visual answer. */}
          <Route path="/mockups/payment-methods" element={<PaymentMethodComparisonMockup />} />
          <Route path="/mockups/payment-evolution" element={<PaymentEvolutionMockup />} />
          {/* Founder Hub — HK only. Single pane of glass for everything
              MyBodyMap. FounderRoute gates the access to HK's email
              specifically; other authenticated therapists are redirected
              to /dashboard. */}
          <Route path="/founder" element={<FounderRoute><FounderHub /></FounderRoute>} />
          <Route path="/founder/seed-demo" element={<FounderRoute><FounderSeedDemo /></FounderRoute>} />
          <Route path="/founder/stripe-debug" element={<FounderRoute><StripeDebug /></FounderRoute>} />
          <Route path="/help" element={<Help />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/comparison/printable" element={<ComparisonPrintable />} />
          <Route path="/atlas" element={<Navigate to="/" replace />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Navigate to="/help#contact-and-enterprise" replace />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/security" element={<Security />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-phone" element={<ProtectedRoute><VerifyPhone /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard view="clients" /></ProtectedRoute>} />
          <Route path="/admin/funnel" element={<ProtectedRoute><AdminFunnel /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Dashboard view="settings" /></ProtectedRoute>} />
          <Route path="/dashboard/intake/edit" element={<ProtectedRoute><IntakeEditor /></ProtectedRoute>} />
          <Route path="/dashboard/practice-agreement/print" element={<ProtectedRoute><PracticeAgreementPrint /></ProtectedRoute>} />
          <Route path="/agreement-sign/:token" element={<AgreementSign />} />
          <Route path="/s/:code" element={<AgreementSign />} />
          <Route path="/dashboard/gifts" element={<ProtectedRoute><Dashboard view="gifts" /></ProtectedRoute>} />
          <Route path="/dashboard/outreach" element={<ProtectedRoute><Dashboard view="outreach" /></ProtectedRoute>} />
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
          <Route path="/brief/intake/:sessionId" element={<IntakeBrief />} />
          <Route path="/recap/:sessionId" element={<PostSessionSummary />} />
          <Route path="/gift-card/print/:id" element={<GiftCardPrint />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard/cal-connect" element={<ProtectedRoute><CalConnect /></ProtectedRoute>} />
          <Route path="/dashboard/stripe-connect" element={<ProtectedRoute><StripeConnect /></ProtectedRoute>} />
          <Route path="/dashboard/stripe-connect-standard" element={<ProtectedRoute><StripeConnectStandard /></ProtectedRoute>} />
          <Route path="/book/:slug" element={<BookingPage />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/why-bodymap" element={<WhyBodyMap />} />
          <Route path="/deposit-success" element={<DepositSuccess />} />
          <Route path="/admin" element={<ProtectedRoute><FounderDashboard /></ProtectedRoute>} />
          <Route path="/admin/emails" element={<ProtectedRoute><EmailReview /></ProtectedRoute>} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/:customUrl" element={<ClientIntake />} />
        </Routes>
        <Analytics />
      </Router>
    </AuthProvider>
  );
}

export default App;
