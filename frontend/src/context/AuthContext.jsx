import React, { createContext, useState, useEffect } from "react";
import jwt_decode from "jwt-decode";

// create context
const AuthContextInternal = createContext(null);

// provider component
const AuthProviderInternal = ({ children }) => {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("access");
    return token
      ? { access: token, user: jwt_decode(token) }
      : { access: null, user: null };
  });

  useEffect(() => {}, []);

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

  return (
    <AuthContextInternal.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContextInternal.Provider>
  );
};

export const AuthContext = AuthContextInternal;
export const AuthProvider = AuthProviderInternal;
