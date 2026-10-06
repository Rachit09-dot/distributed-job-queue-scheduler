import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { formatDate } from '../utils/formatting';

export function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold uppercase">
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <dt className="text-gray-500">User ID</dt>
            <dd className="font-mono text-xs text-gray-600">{user.id}</dd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <dt className="text-gray-500">Role</dt>
            <dd>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.role === 'ADMIN'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {user.role}
              </span>
            </dd>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <dt className="text-gray-500">Member since</dt>
            <dd className="text-gray-700">{formatDate(user.createdAt)}</dd>
          </div>
          {user._count && (
            <div className="flex justify-between py-2">
              <dt className="text-gray-500">Total jobs created</dt>
              <dd className="font-semibold text-gray-800">{user._count.jobs}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Security</h2>
        <p className="text-sm text-gray-500">
          Your password is stored as a bcrypt hash (cost factor 12). JWT tokens expire after{' '}
          <span className="font-medium">7 days</span>. Use the sign out button to invalidate your
          session.
        </p>
      </Card>
    </div>
  );
}
