
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import './Onboarding.css';

const niches = [
  'Technology',
  'Gaming',
  'Education',
  'Lifestyle',
  'Fashion',
  'Beauty',
  'Fitness',
  'Travel',
  'Food',
  'Photography',
  'Music',
  'Entertainment',
  'Finance',
  'Art & Design',
  'Other',
];

const goals = [
  'Grow my audience',
  'Find collaboration partners',
  'Improve content quality',
  'Increase engagement',
  'Build my personal brand',
  'Monetize my content',
];

const steps = ['Profile', 'Niche', 'Socials', 'Goals'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    bio: '',
    niches: [],
    instagram: '',
    youtube: '',
    tiktok: '',
    goals: [],
  });

  // LOAD EXISTING PROFILE
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user?.id) {
        if (mounted) setFetching(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select(`
            full_name,
            username,
            bio,
            niches,
            instagram,
            youtube,
            tiktok,
            goals
          `)
          .eq('id', user.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!mounted) return;

        if (data) {
          setForm({
            fullName:
              data.full_name ||
              user.user_metadata?.full_name ||
              '',
            username:
              data.username ||
              user.user_metadata?.username ||
              '',
            bio: data.bio || '',
            niches: Array.isArray(data.niches)
              ? data.niches
              : [],
            instagram: data.instagram || '',
            youtube: data.youtube || '',
            tiktok: data.tiktok || '',
            goals: Array.isArray(data.goals)
              ? data.goals
              : [],
          });
        } else {
          setForm((previous) => ({
            ...previous,
            fullName: user.user_metadata?.full_name || '',
            username: user.user_metadata?.username || '',
          }));
        }
      } catch (err) {
        console.error('Profile loading failed:', err);
        if (mounted) {
          setError('Unable to load your existing profile.');
        }
      } finally {
        if (mounted) setFetching(false);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  function updateField(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function toggleSelection(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field].includes(value)
        ? previous[field].filter((item) => item !== value)
        : [...previous[field], value],
    }));
  }

  function nextStep() {
    setError('');

    if (step === 0) {
      if (!form.fullName.trim() || !form.username.trim()) {
        setError('Please complete your name and username.');
        return;
      }

      if (form.username.trim().length < 3) {
        setError('Username must contain at least 3 characters.');
        return;
      }
    }

    if (step === 1 && form.niches.length === 0) {
      setError('Please select at least one creator niche.');
      return;
    }

    if (step < steps.length - 1) {
      setStep((previous) => previous + 1);
    }
  }

  function previousStep() {
    setError('');
    setStep((previous) => Math.max(0, previous - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Please sign in before saving your profile.');
      return;
    }

    if (form.goals.length === 0) {
      setError('Please select at least one creator goal.');
      return;
    }

    setLoading(true);

    try {
      const profileData = {
        full_name: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        bio: form.bio.trim(),
        niches: form.niches,
        instagram: form.instagram.trim(),
        youtube: form.youtube.trim(),
        tiktok: form.tiktok.trim(),
        goals: form.goals,
        onboarding_completed: true,
      };

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error('No profile was updated.');
      }

      if (
        data.instagram !== profileData.instagram ||
        data.youtube !== profileData.youtube ||
        data.tiktok !== profileData.tiktok
      ) {
        throw new Error('Social links could not be saved.');
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Profile save failed:', err);
      setError(err.message || 'Unable to save your profile.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <main className="onboarding-page">
        <section className="onboarding-card">
          <div className="onboarding-header">
            <div className="onboarding-brand">
              <span>✳</span> CollabNest
            </div>
            <h1>Loading your profile...</h1>
            <p>Getting your creator information ready.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">

        <header className="onboarding-header">
          <div className="onboarding-brand">
            <span>✳</span> CollabNest
          </div>

          <span className="onboarding-tag">
            CREATOR SETUP
          </span>

          <h1>Let's build your nest.</h1>

          <p>
            Tell us a little about yourself so we can
            help you find your creative community.
          </p>
        </header>

        <div className="onboarding-progress">
          {steps.map((item, index) => (
            <div
              key={item}
              className={`progress-step ${
                index <= step ? 'active' : ''
              }`}
            >
              <div className="progress-circle">
                {index < step ? '✓' : index + 1}
              </div>

              <span>{item}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>

          {/* STEP 1: PROFILE */}

          {step === 0 && (
            <div className="onboarding-section">
              <span className="section-label">
                STEP 01 — ABOUT YOU
              </span>

              <h2>Let's get to know you.</h2>

              <p>
                Start with the basics of your creator identity.
              </p>

              <label htmlFor="fullName">Full name</label>

              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(e) =>
                  updateField('fullName', e.target.value)
                }
                placeholder="Your name"
                required
              />

              <label htmlFor="username">Username</label>

              <input
                id="username"
                type="text"
                value={form.username}
                onChange={(e) =>
                  updateField('username', e.target.value)
                }
                placeholder="yourcreatorname"
                required
                minLength={3}
              />

              <label htmlFor="bio">Short bio</label>

              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) =>
                  updateField('bio', e.target.value)
                }
                placeholder="Tell the community what you create..."
                rows={4}
                maxLength={300}
              />

              <small className="character-count">
                {form.bio.length}/300 characters
              </small>
            </div>
          )}

          {/* STEP 2: NICHE */}

          {step === 1 && (
            <div className="onboarding-section">
              <span className="section-label">
                STEP 02 — YOUR NICHE
              </span>

              <h2>What do you create?</h2>

              <p>
                Choose the topics that best describe your content.
                You can select multiple.
              </p>

              <div className="selection-grid">
                {niches.map((niche) => (
                  <button
                    key={niche}
                    type="button"
                    className={`selection-chip ${
                      form.niches.includes(niche)
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      toggleSelection('niches', niche)
                    }
                  >
                    {form.niches.includes(niche) ? '✓ ' : '+ '}
                    {niche}
                  </button>
                ))}
              </div>

              <small className="selection-count">
                {form.niches.length} niche(s) selected
              </small>
            </div>
          )}

          {/* STEP 3: SOCIAL PROFILES */}

          {step === 2 && (
            <div className="onboarding-section">
              <span className="section-label">
                STEP 03 — SOCIAL PRESENCE
              </span>

              <h2>Where can people find you?</h2>

              <p>
                Add your social profiles so other creators
                can discover your work.
              </p>

              <label htmlFor="instagram">Instagram</label>

              <input
                id="instagram"
                type="text"
                value={form.instagram}
                onChange={(e) =>
                  updateField('instagram', e.target.value)
                }
                placeholder="@yourusername"
              />

              <label htmlFor="youtube">YouTube</label>

              <input
                id="youtube"
                type="text"
                value={form.youtube}
                onChange={(e) =>
                  updateField('youtube', e.target.value)
                }
                placeholder="https://youtube.com/@yourchannel"
              />

              <label htmlFor="tiktok">TikTok</label>

              <input
                id="tiktok"
                type="text"
                value={form.tiktok}
                onChange={(e) =>
                  updateField('tiktok', e.target.value)
                }
                placeholder="@yourusername"
              />

              <small className="optional-note">
                All social links are optional.
              </small>
            </div>
          )}

          {/* STEP 4: GOALS */}

          {step === 3 && (
            <div className="onboarding-section">
              <span className="section-label">
                STEP 04 — YOUR GOALS
              </span>

              <h2>What do you want to achieve?</h2>

              <p>
                Select the goals that matter most to your
                creator journey.
              </p>

              <div className="goal-list">
                {goals.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    className={`goal-option ${
                      form.goals.includes(goal)
                        ? 'selected'
                        : ''
                    }`}
                    onClick={() =>
                      toggleSelection('goals', goal)
                    }
                  >
                    <span className="goal-check">
                      {form.goals.includes(goal) ? '✓' : ''}
                    </span>

                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}

          <div className="onboarding-actions">
            {step > 0 && (
              <button
                type="button"
                className="back-button"
                onClick={previousStep}
                disabled={loading}
              >
                ← Back
              </button>
            )}

            {step < steps.length - 1 ? (
              <button
                type="button"
                className="continue-button"
                onClick={nextStep}
              >
                Continue →
              </button>
            ) : (
              <button
                type="submit"
                className="continue-button"
                disabled={loading}
              >
                {loading
                  ? 'Saving profile...'
                  : 'Save profile →'}
              </button>
            )}
          </div>
        </form>

        <footer className="onboarding-footer">
          Made for creators, built for collaboration.
        </footer>

      </section>
    </main>
  );
}
