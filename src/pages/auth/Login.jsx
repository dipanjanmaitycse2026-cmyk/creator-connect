
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { supabase } from '../../lib/supabase';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user } = await login(email.trim(), password);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || !profile.onboarding_completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="visual-top">
          <div className="brand">
            <span className="brand-icon">✳</span>
            <span>CollabNest</span>
          </div>
          <span className="brand-tagline">GROW TOGETHER</span>
        </div>

        <div className="visual-content">
          <span className="visual-label">YOUR CREATOR COMMUNITY</span>

          <h1>
            Create more.
            <br />
            <span>Grow together.</span>
          </h1>

          <p>
            Great things happen when creators connect.
            Find your community, share ideas and make
            something amazing together.
          </p>

          <div className="creator-art">
            <div className="art-circle circle-one" />
            <div className="art-circle circle-two" />

            <div className="floating-card card-left">
              <span>✦</span>
              <div>
                <strong>New ideas</strong>
                <small>Start creating</small>
              </div>
            </div>

            <div className="mascot">
              <div className="bunny-ears">
                <div />
                <div />
              </div>
              <div className="bunny-face">
                <div className="bunny-eyes">
                  <i />
                  <i />
                </div>
                <div className="bunny-nose" />
                <div className="bunny-mouth" />
                <div className="bunny-cheek left" />
                <div className="bunny-cheek right" />
              </div>
              <div className="bunny-body" />
            </div>

            <div className="floating-card card-right">
              <span>♡</span>
              <div>
                <strong>Let's collab!</strong>
                <small>Better together</small>
              </div>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <span>✦</span> A little space for big creative dreams.
        </div>
      </section>

      <section className="auth-form-side">
        <div className="mobile-brand">
          <span className="brand-icon">✳</span>
          CollabNest
        </div>

        <div className="login-container">
          <div className="form-heading">
            <span className="welcome-tag">WELCOME BACK 👋</span>
            <h2>Let's get you in.</h2>
            <p>Sign in to continue your creative journey.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-field">
              <div className="password-label">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? 'Signing you in...' : 'Sign in to CollabNest'}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="signup-prompt">
            New to CollabNest?
            <Link to="/register"> Create an account</Link>
          </div>

          <div className="form-bottom">
            <span>Made for creators, built for collaboration.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
