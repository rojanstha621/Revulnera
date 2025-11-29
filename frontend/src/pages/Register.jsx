import React, {useState, useContext} from 'react';
import {postJSON} from '../api/api';
import { AuthContext } from '../context/AuthContext';

export default function Register(){
  const [form,setForm] = useState({email:'',password:'',full_name:''});
  const [msg,setMsg]=useState('');
  const onChange = e => setForm({...form,[e.target.name]: e.target.value});
  const onSubmit = async (e) => {
    e.preventDefault();
    const res = await postJSON('/auth/register/', form);
    if(res.email){
      setMsg('Registration successful. Check your email to verify.');
    } else if(res.detail){
      setMsg(res.detail);
    } else {
      setMsg('Registration error.');
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-slate-900 to-slate-800">
      <div className="card w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-white">Create an account</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <input required name="email" value={form.email} onChange={onChange} placeholder="Email" className="w-full p-3 rounded-xl bg-white/5 border border-white/6 text-white" />
          <input required name="full_name" value={form.full_name} onChange={onChange} placeholder="Full name" className="w-full p-3 rounded-xl bg-white/5 border border-white/6 text-white" />
          <input required name="password" value={form.password} onChange={onChange} type="password" placeholder="Password" className="w-full p-3 rounded-xl bg-white/5 border border-white/6 text-white" />
          <button className="btn-primary w-full">Create account</button>
        </form>
        {msg && <p className="mt-4 text-sm text-slate-300">{msg}</p>}
      </div>
    </div>
  );
}
