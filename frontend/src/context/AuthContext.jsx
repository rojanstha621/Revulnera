// src/context/AuthContext.jsx
import React, { createContext, useState } from "react";
import jwt_decode from "jwt-decode";

const AuthContextInternal = createContext(null);

const AuthProviderInternal = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("access");
    return token
      ? { access: token, user: jwt_decode(token) }
      : { access: null, user: null };
  });

  const login = ({ access, refresh }) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    setAuth({ access, user: jwt_decode(access) });
  };

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setAuth({ access: null, user: null });
  };

  const isAuthenticated = !!auth.access;

  return (
    <AuthContextInternal.Provider
      value={{ auth, login, logout, isAuthenticated }}
    >
      {children}
    </AuthContextInternal.Provider>
  );
};

export const AuthContext = AuthContextInternal;
export const AuthProvider = AuthProviderInternal;
