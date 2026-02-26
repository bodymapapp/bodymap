// src/components/ProtectedRoute.js
import React, { useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const hadUser = useRef(false);
  
  // Once we see a user, remember it forever in this session
  if (user) hadUser.current = true;

  // Only show loading on first load, not on re-renders
  if (loading && !hadUser.current) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🌿</div>
          <div style={{ fontSize: "18px", color: "#6B7280" }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Only redirect if we never had a user
  if (!user && !hadUser.current) return <Navigate to="/login" replace />;
  
  return children;
}
