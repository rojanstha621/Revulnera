import { useState } from "react";
import axios from "axios";

export default function ScanSubdomains() {
  const [domain, setDomain] = useState("");
  const [results, setResults] = useState([]);

  async function scan() {
    const res = await axios.post("http://localhost:8000/api/scan/subdomains/", {
      domain
    });
    setResults(res.data.subdomains || []);
  }

  return (
    <div className="p-6">
      <input 
        value={domain}
        onChange={e => setDomain(e.target.value)}
        className="border p-2"
        placeholder="example.com"
      />
      <button onClick={scan} className="ml-2 bg-blue-600 text-white px-4 rounded">
        Scan
      </button>

      <ul className="mt-4">
        {results.map(sub => (
          <li key={sub}>{sub}</li>
        ))}
      </ul>
    </div>
  );
}
