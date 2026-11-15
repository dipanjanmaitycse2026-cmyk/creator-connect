
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import './ResetPassword.css';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);

      setSuccess(
        'Your password has been updated successfully. Redirecting to login...'
      );

      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err) {
      setError(
        err.message || 'Unable to update your password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="reset-page">
      <section className="reset-card">
        <Link to="/login" className="reset-back">
          ← Back to login
        </Link>

        <div className="reset-icon">🔐</div>

        <p className="reset-eyebrow">ACCOUNT SECURITY</p>

        <h1>Create a new password</h1>

        <p className="reset-description">
          Choose a new password for your CollabNest account.
          Use at least 8 characters.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">
            New password
          </label>

          <input
            id="new-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />

          <label htmlFor="confirm-new-password">
            Confirm password
          </label>

          <input
            id="confirm-new-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />

          <label className="reset-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Show passwords
          </label>

          {error && (
            <p className="reset-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="reset-success" role="status">
              {success}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  );
}
