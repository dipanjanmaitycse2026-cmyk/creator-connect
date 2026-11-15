
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import './ForgotPassword.css';

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage('');
    setError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(trimmedEmail);

      setMessage(
        'If an account exists for this email, a password reset link will be sent. Please check your inbox and spam folder.'
      );
    } catch (err) {
      setError(
        err.message || 'Unable to send the reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="forgot-page">
      <section className="forgot-card">
        <Link to="/login" className="forgot-back">
          ← Back to login
        </Link>

        <div className="forgot-icon">✉</div>

        <p className="forgot-eyebrow">ACCOUNT RECOVERY</p>

        <h1>Forgot your password?</h1>

        <p className="forgot-description">
          Don't worry! Enter your registered email address
          and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="forgot-email">
            Email address
          </label>

          <input
            id="forgot-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {error && (
            <p className="forgot-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="forgot-success" role="status">
              {message}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="forgot-footer">
          Remember your password?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
