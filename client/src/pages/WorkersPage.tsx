import { useWorkers } from '../hooks/useWorkers';
import { Card } from '../components/ui/Card';
import { WorkerStatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { formatRelativeTime, formatDate } from '../utils/formatting';

export function WorkersPage() {
  const { workers, isLoading, error, refetch } = useWorkers();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const onlineCount = workers.filter((w) => w.isOnline).length;
  const totalProcessed = workers.reduce((acc, w) => acc + w.jobsProcessed, 0);
  const totalFailed = workers.reduce((acc, w) => acc + w.jobsFailed, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workers</h1>
          <p className="text-gray-500 text-sm">
            {onlineCount} online · {workers.length} total
          </p>
        </div>
        <Button variant="secondary" onClick={refetch}>↻ Refresh</Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Online Workers</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{onlineCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Jobs Processed</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{totalProcessed}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Jobs Failed</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{totalFailed}</p>
        </Card>
      </div>

      {/* Worker cards */}
      {workers.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-gray-400">
            <p className="text-lg mb-2">No workers registered</p>
            <p className="text-sm">Start a worker container to begin processing jobs</p>
            <code className="block mt-3 text-xs bg-gray-100 rounded px-3 py-2 text-gray-600">
              docker compose up --scale worker=2
            </code>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workers.map((worker) => {
            const effectiveStatus = !worker.isOnline ? 'OFFLINE' : worker.status;
            const successRate =
              worker.jobsProcessed + worker.jobsFailed > 0
                ? Math.round(
                    (worker.jobsProcessed / (worker.jobsProcessed + worker.jobsFailed)) * 100,
                  )
                : 100;

            return (
              <Card key={worker.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{worker.workerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{worker.hostname}</p>
                  </div>
                  <WorkerStatusBadge status={effectiveStatus} />
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Concurrency</dt>
                    <dd className="font-medium text-gray-800">{worker.concurrency}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Success Rate</dt>
                    <dd className={`font-medium ${successRate >= 80 ? 'text-green-600' : 'text-red-600'}`}>
                      {successRate}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Processed</dt>
                    <dd className="font-medium text-gray-800">{worker.jobsProcessed}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Failed</dt>
                    <dd className="font-medium text-gray-800">{worker.jobsFailed}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Started</dt>
                    <dd className="font-medium text-gray-800 text-xs">{formatDate(worker.startedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Last Heartbeat</dt>
                    <dd className={`font-medium text-xs ${worker.isOnline ? 'text-green-600' : 'text-red-500'}`}>
                      {formatRelativeTime(worker.lastHeartbeat)}
                    </dd>
                  </div>
                </dl>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Success rate</span>
                    <span>{successRate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${successRate >= 80 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
