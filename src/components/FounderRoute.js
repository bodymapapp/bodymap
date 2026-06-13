// src/components/FounderRoute.js
//
// Stricter than ProtectedRoute. Only the founder account can access pages
// wrapped in this. Other authenticated therapists get redirected to their
// dashboard. The allowlist lives in src/lib/founderAllowlist.js so it cannot
// drift across files.

import BMLogo from '../components/BMLogo';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FOUNDER_EMAILS } from '../lib/founderAllowlist';

export default function FounderRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center" }}>
          <BMLogo size={44} variant="dark" showWordmark={true} />
          <div style={{ fontSize: "18px", color: "#6B7280" }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Verify the authenticated user is in the founder allowlist
  const email = user.email?.toLowerCase().trim();
  if (!email || !FOUNDER_EMAILS.includes(email)) {
    // Authenticated, but not founder. Send to regular dashboard.
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
