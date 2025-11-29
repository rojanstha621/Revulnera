import React, {useContext} from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function ProtectedRoute({children}){
  const { auth } = useContext(AuthContext);
  if(!auth?.access) return <Navigate to="/auth/login" replace />;
  return children;
}
