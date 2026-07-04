import { RefreshCw } from "lucide-react";

export default function UserStatistics({ sessions, loading, onRefresh, formatTimeOnline }) {
  const onlineUsers = sessions || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">User Statistics</div>
          <div className="text-xs text-slate-400">Active sessions only. Sessions expire after 30 minutes of inactivity.</div>
        </div>
        <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mb-3 text-sm text-slate-500">Total online sessions: {onlineUsers.length}</div>

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading sessions...</div>
      ) : onlineUsers.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">No active sessions</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Dept</th>
                <th className="px-3 py-3">Current Tab</th>
                <th className="px-3 py-3">Time Online</th>
                <th className="px-3 py-3">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {onlineUsers.map((session) => (
                <tr key={session.session_token} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-800">{session.email}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{session.role}</td>
                  <td className="px-3 py-3 text-slate-600">{session.departemen || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{session.current_page || "-"}</td>
                  <td className="px-3 py-3 text-slate-600">{formatTimeOnline(session.logged_in_at)}</td>
                  <td className="px-3 py-3 text-slate-600">{session.last_activity ? new Date(session.last_activity).toLocaleString("id-ID") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
