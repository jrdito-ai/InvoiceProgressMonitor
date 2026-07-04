import { useState } from "react";
import { useAuth } from "../hooks/useAuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleLogin} className="w-80 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-bold">Invoice Progress Monitor</h2>
        <p className="mb-4 text-sm text-slate-500">Silakan login untuk melanjutkan</p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border px-3 py-2"
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border px-3 py-2"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-full rounded bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Loading..." : "Login"}
        </button>
      </form>
    </div>
  );
}
