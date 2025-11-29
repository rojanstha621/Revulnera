import React, {useState, useContext} from 'react';
import {postJSON} from '../api/api';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const { login } = useContext(AuthContext);
  const [form,setForm]=useState({email:'',password:''});
  const [err,setErr]=useState(null);
  const nav = useNavigate();
  const onSubmit = async (e) => {
    e.preventDefault();
    const res = await postJSON('/auth/login/', form);
    if(res.access){
      login(res);
      nav('/dashboard');
    } else {
      setErr(res.detail || 'Login failed');
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800">
      <div className="card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-4 text-white">Sign in</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input required name="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email" className="w-full p-3 rounded-xl bg-white/5 border border-white/6 text-white" />
          <input required type="password" name="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="w-full p-3 rounded-xl bg-white/5 border border-white/6 text-white" />
          <button className="btn-primary w-full">Sign in</button>
        </form>
        {err && <p className="mt-3 text-red-400">{err}</p>}
      </div>
    </div>
  );
}
