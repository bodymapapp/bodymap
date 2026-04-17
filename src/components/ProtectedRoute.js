// src/components/ProtectedRoute.js
import BMLogo from '../components/BMLogo';
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
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
  return children;
}
