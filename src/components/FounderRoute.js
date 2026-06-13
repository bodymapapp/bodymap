// src/components/FounderRoute.js
//
// Stricter than ProtectedRoute. Only HK's account can access pages
// wrapped in this. Other authenticated therapists get redirected
// to their dashboard.
//
// HK's account email is bodymapdemo@gmail.com (the canonical founder
// account). If HK ever moves to a new email, update FOUNDER_EMAILS
// to include both during transition, then drop the old one.

import BMLogo from '../components/BMLogo';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// HK's canonical founder account is bodymapdemo@gmail.com, but that is also
// the live demo account, so we are moving founder access onto a private
// email. During the transition both are allowed; once HK confirms he can
// sign in as harshk.mba@gmail.com, drop bodymapdemo from this list so the
// demo account no longer carries founder powers. (bodymap01@gmail.com has
// no auth login, so it is intentionally not here.)
export const FOUNDER_EMAILS = [
  'bodymapdemo@gmail.com',
  'harshk.mba@gmail.com',
];

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
