import { useDashboard } from '../hooks/useDashboard';
import { useWorkers } from '../hooks/useWorkers';
import { Card, StatCard } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { WorkerStatusBadge } from '../components/ui/StatusBadge';
import { formatRelativeTime, formatDuration } from '../utils/formatting';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

const TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  NORMAL: '#3b82f6',
  LOW: '#6b7280',
};

export function DashboardPage() {
  const { stats, jobStats, isLoading, error } = useDashboard();
  const { workers } = useWorkers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-xl text-red-700 text-sm">{error}</div>
    );
  }

  const hourlyData =
    jobStats?.hourly.map((h) => ({
      hour: format(new Date(h.hour), 'HH:mm'),
      total: h.total,
      completed: h.completed,
      failed: h.failed,
    })) ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time system overview</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Jobs"
          value={stats?.jobs.total ?? 0}
          colorClass="text-gray-900"
          icon={<span className="text-lg">⊞</span>}
        />
        <StatCard
          label="Running"
          value={stats?.jobs.running ?? 0}
          colorClass="text-yellow-600"
          sub="In progress now"
          icon={<span className="text-lg">▶</span>}
        />
        <StatCard
          label="Completed"
          value={stats?.jobs.completed ?? 0}
          colorClass="text-green-600"
          icon={<span className="text-lg">✓</span>}
        />
        <StatCard
          label="Failed"
          value={stats?.jobs.failed ?? 0}
          colorClass="text-red-600"
          icon={<span className="text-lg">✗</span>}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Queued"
          value={stats?.jobs.queued ?? 0}
          colorClass="text-blue-600"
          icon={<span className="text-lg">⏳</span>}
        />
        <StatCard
          label="Scheduled"
          value={stats?.jobs.scheduled ?? 0}
          colorClass="text-purple-600"
          icon={<span className="text-lg">📅</span>}
        />
        <StatCard
          label="Success Rate"
          value={`${stats?.jobs.successRate ?? 0}%`}
          colorClass="text-green-600"
          icon={<span className="text-lg">%</span>}
        />
        <StatCard
          label="Active Workers"
          value={stats?.workers.active ?? 0}
          colorClass="text-blue-600"
          sub={`Avg ${formatDuration(stats?.performance.avgExecutionTimeMs ?? 0)}/job`}
          icon={<span className="text-lg">⚙</span>}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly activity */}
        <Card className="lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Jobs per Hour (last 24h)</h2>
          {hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorTotal)" name="Total" />
                <Area type="monotone" dataKey="completed" stroke="#10b981" fill="url(#colorCompleted)" name="Completed" />
                <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="none" strokeDasharray="4 2" name="Failed" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No data in the last 24 hours
            </div>
          )}
        </Card>

        {/* By type pie */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Jobs by Type</h2>
          {(jobStats?.byType ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={jobStats!.byType}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ type, percent }) =>
                    `${type?.split('_')[0]} ${Math.round(percent * 100)}%`
                  }
                  labelLine={false}
                >
                  {jobStats!.byType.map((_, i) => (
                    <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No jobs yet</div>
          )}
        </Card>
      </div>

      {/* Priority distribution + Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By priority bar chart */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Jobs by Priority</h2>
          {(jobStats?.byPriority ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={jobStats!.byPriority} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="priority" type="category" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Jobs" radius={[0, 4, 4, 0]}>
                  {jobStats!.byPriority.map((entry, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[entry.priority] ?? '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </Card>

        {/* Active workers */}
        <Card>
          <h2 className="text-base font-semibold text-gray-800 mb-4">Workers</h2>
          {workers.length === 0 ? (
            <div className="text-gray-400 text-sm">No workers registered yet</div>
          ) : (
            <div className="space-y-3">
              {workers.slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{w.workerName}</p>
                    <p className="text-xs text-gray-400">
                      {w.jobsProcessed} processed · {w.jobsFailed} failed
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <WorkerStatusBadge status={w.isOnline ? (w.status === 'BUSY' ? 'BUSY' : 'ONLINE') : 'OFFLINE'} />
                    <span className="text-xs text-gray-400">{formatRelativeTime(w.lastHeartbeat)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Queue stats */}
      <Card>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Redis Queue Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'Waiting', value: stats?.queue.waiting ?? 0, color: 'text-blue-600' },
            { label: 'Active', value: stats?.queue.active ?? 0, color: 'text-yellow-600' },
            { label: 'Delayed', value: stats?.queue.delayed ?? 0, color: 'text-purple-600' },
            { label: 'Completed', value: stats?.queue.completed ?? 0, color: 'text-green-600' },
            { label: 'Failed', value: stats?.queue.failed ?? 0, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
