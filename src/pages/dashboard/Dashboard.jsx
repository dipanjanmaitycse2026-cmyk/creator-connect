
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import './Dashboard.css';

const navigation = [
  { icon: '⌂', label: 'Dashboard', path: '/dashboard', active: true },
  { icon: '◎', label: 'Discover Creators', path: '/discover' },
  { icon: '♡', label: 'Collaboration Hub', path: '/collaboration' },
  { icon: '▦', label: 'Content Planner', path: '/planner', soon: true },
  { icon: '↗', label: 'Analytics', path: '/analytics', soon: true },
  { icon: '☁', label: 'Wellness Centre', path: '/wellness', soon: true },
  { icon: '✉', label: 'Messages', path: '/messages', soon: true },
];

function getSocialUrl(platform, value) {
  if (!value) return '';

  const trimmed = value.trim();

  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  const username = trimmed.replace(/^@/, '');

  const urls = {
    instagram: `https://www.instagram.com/${username}`,
    youtube: `https://www.youtube.com/@${username}`,
    tiktok: `https://www.tiktok.com/@${username}`,
  };

  return urls[platform];
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(`
          full_name,
          username,
          bio,
          niches,
          avatar_url,
          instagram,
          youtube,
          tiktok,
          goals
        `)
        .eq('id', user.id)
        .single();

      if (!active) return;

      if (profileError) {
        console.error('Profile loading error:', profileError);
        setError('Unable to load your profile. Please refresh the page.');
      } else {
        setProfile(data);
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    'Creator';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const socialProfiles = [
    {
      platform: 'instagram',
      name: 'Instagram',
      icon: '◎',
      value: profile?.instagram,
    },
    {
      platform: 'youtube',
      name: 'YouTube',
      icon: '▶',
      value: profile?.youtube,
    },
    {
      platform: 'tiktok',
      name: 'TikTok',
      icon: '♪',
      value: profile?.tiktok,
    },
  ].filter((item) => item.value);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner" />
        <p>Preparing your creator dashboard...</p>
      </div>
    );
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">✦</div>
          <div>
            <h2>CollabNest</h2>
            <span>GROW TOGETHER</span>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation">
          {navigation.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className={`sidebar-nav-item ${
                item.active ? 'active' : ''
              } ${item.soon ? 'coming-soon-nav' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>

              {item.soon && (
                <span className="nav-soon">Soon</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link to="/onboarding" className="sidebar-edit-profile">
            <span className="nav-icon">⚙</span>
            <span>Edit Profile</span>
          </Link>

          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
          >
            <span className="nav-icon">↪</span>
            <span>Log Out</span>
          </button>

          <div className="sidebar-footer">
            <span>Made for creators</span>
            <strong>CollabNest © 2026</strong>
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="topbar-label">YOUR CREATOR SPACE</span>
            <h1>Dashboard</h1>
          </div>

          <Link to="/onboarding" className="topbar-profile">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="topbar-avatar"
              />
            ) : (
              <div className="topbar-avatar-placeholder">
                {initials}
              </div>
            )}

            <div>
              <strong>{displayName}</strong>
              <span>@{profile?.username || 'creator'}</span>
            </div>
          </Link>
        </header>

        {error && (
          <div className="dashboard-error">
            {error}
          </div>
        )}

        <div className="dashboard-content">
          <section className="welcome-banner">
            <div className="welcome-text">
              <span className="welcome-eyebrow">
                WELCOME BACK
              </span>

              <h2>Hello, {displayName}! ✨</h2>

              <p>
                Your creative journey continues here.
                Discover creators, build connections, and grow together.
              </p>

              <Link to="/discover" className="welcome-button">
                Discover Creators →
              </Link>
            </div>

            <div className="welcome-decoration" aria-hidden="true">
              <span>✦</span>
              <span>♡</span>
              <span>✧</span>
              <div className="welcome-circle">✿</div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR SPACE</span>
                <h2>Creator Overview</h2>
              </div>

              <Link to="/onboarding" className="section-link">
                Edit Profile →
              </Link>
            </div>

            <div className="overview-grid">
              <article className="overview-card">
                <div className="overview-card-icon">♙</div>
                <span>Creator Name</span>
                <strong>{displayName}</strong>
              </article>

              <article className="overview-card">
                <div className="overview-card-icon">◎</div>
                <span>Username</span>
                <strong>
                  @{profile?.username || 'Not added'}
                </strong>
              </article>

              <article className="overview-card">
                <div className="overview-card-icon">✦</div>
                <span>Creator Niches</span>
                <strong>
                  {profile?.niches?.length || 0} selected
                </strong>
              </article>
            </div>
          </section>

          <section className="dashboard-section profile-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">ABOUT YOU</span>
                <h2>Your Creator Profile</h2>
              </div>
            </div>

            <div className="profile-overview-card">
              <div className="profile-overview-avatar">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Creator avatar" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              <div className="profile-overview-info">
                <h3>{displayName}</h3>
                <span>@{profile?.username || 'creator'}</span>
                <p>
                  {profile?.bio ||
                    'Add a short introduction to tell other creators about yourself.'}
                </p>
              </div>

              <Link to="/onboarding" className="profile-edit-link">
                Edit
              </Link>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR INTERESTS</span>
                <h2>Creator Niches</h2>
              </div>
            </div>

            <div className="niche-container">
              {profile?.niches?.length > 0 ? (
                profile.niches.map((niche) => (
                  <span className="niche-tag" key={niche}>
                    {niche}
                  </span>
                ))
              ) : (
                <p className="empty-section-text">
                  You haven't selected any niches yet.
                  <Link to="/onboarding"> Add your interests</Link>
                </p>
              )}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR DIRECTION</span>
                <h2>Creator Goals</h2>
              </div>
            </div>

            <div className="niche-container">
              {profile?.goals?.length > 0 ? (
                profile.goals.map((goal) => (
                  <span className="niche-tag goal-tag" key={goal}>
                    {goal}
                  </span>
                ))
              ) : (
                <p className="empty-section-text">
                  No goals added yet.
                  <Link to="/onboarding"> Set your creator goals</Link>
                </p>
              )}
            </div>
          </section>

          <section className="dashboard-section social-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">YOUR ONLINE PRESENCE</span>
                <h2>Social Profiles</h2>
              </div>

              <Link to="/onboarding" className="section-link">
                Manage Links →
              </Link>
            </div>

            {socialProfiles.length > 0 ? (
              <div className="social-profile-grid">
                {socialProfiles.map((social) => (
                  <article
                    className="social-profile-card"
                    key={social.platform}
                  >
                    <div className="social-profile-icon">
                      {social.icon}
                    </div>

                    <div className="social-profile-info">
                      <strong>{social.name}</strong>
                      <span>{social.value}</span>
                    </div>

                    <a
                      href={getSocialUrl(social.platform, social.value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-open-link"
                    >
                      Open ↗
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-social-card">
                <p>You haven't connected any social profiles yet.</p>
                <Link to="/onboarding">Add Social Profiles →</Link>
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <span className="section-eyebrow">GET STARTED</span>
                <h2>Your Next Steps</h2>
              </div>
            </div>

            <div className="quick-actions-grid">
              <Link to="/discover" className="quick-action-card">
                <div className="quick-action-icon">◎</div>
                <h3>Find Creators</h3>
                <p>Explore creators with similar interests.</p>
                <span>Explore →</span>
              </Link>

              <Link to="/collaboration" className="quick-action-card">
                <div className="quick-action-icon">♡</div>
                <h3>Collaborate</h3>
                <p>Build something together with other creators.</p>
                <span>Coming Soon →</span>
              </Link>

              <Link to="/planner" className="quick-action-card">
                <div className="quick-action-icon">▦</div>
                <h3>Plan Content</h3>
                <p>Organise your upcoming creative ideas.</p>
                <span>Coming Soon →</span>
              </Link>
            </div>
          </section>

          <section className="dashboard-bottom-panels">
            <article className="dashboard-info-panel creative-panel">
              <div className="panel-icon">✧</div>
              <span className="section-eyebrow">A LITTLE REMINDER</span>
              <h3>Keep creating!</h3>
              <p>
                Every creator starts somewhere. Keep learning,
                experimenting, and sharing your ideas.
              </p>
            </article>

            <article className="dashboard-info-panel wellness-panel">
              <div className="panel-icon">☁</div>
              <span className="section-eyebrow">YOUR WELLBEING</span>
              <h3>Take things at your pace.</h3>
              <p>
                Make room for creativity, breaks, and the things
                that inspire you.
              </p>
              <Link to="/wellness">Explore Wellness →</Link>
            </article>
          </section>

          <footer className="dashboard-footer">
            <span>CollabNest — Grow Together ✦</span>
            <span>Built for creators, by creators.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
