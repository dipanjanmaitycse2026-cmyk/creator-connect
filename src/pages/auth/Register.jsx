
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import './Register.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (form.fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (form.username.trim().length < 3) {
      setError('Username must contain at least 3 characters.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const data = await register({
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim(),
        password: form.password,
      });

      if (data.session) {
        setSuccess('Account created successfully! Redirecting to login...');

        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        setSuccess(
          'Your account has been created! Please check your email and verify your account before signing in.'
        );
      }
    } catch (err) {
      setError(
        err.message || 'Registration failed. Please try again.'
      );
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
          <span className="visual-label">
            YOUR CREATOR COMMUNITY
          </span>

          <h1>
            Your journey.
            <br />
            <span>Your community.</span>
          </h1>

          <p>
            Meet creators who share your passion.
            Exchange ideas, collaborate and turn
            your creative goals into reality.
          </p>

          <div className="creator-art">
            <div className="art-circle circle-one" />
            <div className="art-circle circle-two" />

            <div className="floating-card card-left">
              <span>✦</span>

              <div>
                <strong>Fresh ideas</strong>
                <small>Explore together</small>
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
                <strong>New friends</strong>
                <small>Better together</small>
              </div>
            </div>
          </div>
        </div>

        <div className="visual-footer">
          <span>✦</span> A little space for big creative dreams.
        </div>
      </section>

      <section className="auth-form-side register-side">
        <div className="mobile-brand">
          <span className="brand-icon">✳</span>
          CollabNest
        </div>

        <div className="register-container">
          <div className="form-heading">
            <span className="welcome-tag">
              JOIN THE COMMUNITY ✨
            </span>

            <h2>Create your account.</h2>

            <p>Your next creative chapter starts here.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="register-fields">
              <div className="form-field">
                <label htmlFor="fullName">Full name</label>

                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="form-field">
                <label htmlFor="username">Username</label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>

              <div className="form-field full-field">
                <label htmlFor="registerEmail">
                  Email address
                </label>

                <input
                  id="registerEmail"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-field">
                <label htmlFor="registerPassword">
                  Password
                </label>

                <input
                  id="registerPassword"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-field">
                <label htmlFor="confirmPassword">
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <label className="show-password-option">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) =>
                  setShowPassword(e.target.checked)
                }
              />

              Show passwords
            </label>

            {error && (
              <div className="register-error">
                {error}
              </div>
            )}

            {success && (
              <div className="register-success">
                {success}
              </div>
            )}

            <button
              type="submit"
              className="login-button register-button"
              disabled={loading}
            >
              {loading
                ? 'Creating account...'
                : 'Create my account'}

              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="signup-prompt">
            Already have an account?
            <Link to="/login"> Sign in</Link>
          </div>

          <div className="form-bottom">
            Made for creators, built for collaboration.
          </div>
        </div>
      </section>
    </main>
  );
}
