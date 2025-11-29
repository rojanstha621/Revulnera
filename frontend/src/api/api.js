const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function postJSON(path, body, token){
  const res = await fetch(`${API_ROOT}${path}`, {
    method:'POST',
    headers: {
      'Content-Type':'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function getJSON(path, token){
  const res = await fetch(`${API_ROOT}${path}`, {
    headers: {
      'Content-Type':'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });
  return res.json();
}
