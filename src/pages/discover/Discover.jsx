
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import './Discover.css';

const niches = [
  'All Niches',
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

export default function Discover() {
  const { user } = useAuth();

  const [creators, setCreators] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('All Niches');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchCreators() {
      setLoading(true);
      setError('');

      if (!user?.id) {
        setCreators([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          username,
          bio,
          niches,
          avatar_url,
          instagram,
          youtube,
          tiktok
        `)
        .neq('id', user.id)
        .order('full_name', { ascending: true });

      if (!mounted) return;

      if (fetchError) {
        console.error('Creator discovery error:', fetchError);
        setError(
          'Unable to load creators. Please check your database permissions and try again.'
        );
        setCreators([]);
      } else {
        setCreators(data || []);
      }

      setLoading(false);
    }

    fetchCreators();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const filteredCreators = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return creators.filter((creator) => {
      const name = creator.full_name || '';
      const username = creator.username || '';
      const bio = creator.bio || '';

      const matchesSearch =
        !searchTerm ||
        name.toLowerCase().includes(searchTerm) ||
        username.toLowerCase().includes(searchTerm) ||
        bio.toLowerCase().includes(searchTerm);

      const creatorNiches = Array.isArray(creator.niches)
        ? creator.niches
        : [];

      const matchesNiche =
        selectedNiche === 'All Niches' ||
        creatorNiches.includes(selectedNiche);

      return matchesSearch && matchesNiche;
    });
  }, [creators, search, selectedNiche]);

  function getInitials(name, username) {
    const value = name || username || 'Creator';

    return value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  function getSocialLink(platform, value) {
    if (!value) return '';

    const cleanValue = value.trim();

    if (cleanValue.startsWith('http://') ||
        cleanValue.startsWith('https://')) {
      return cleanValue;
    }

    const username = cleanValue.replace(/^@/, '');

    if (platform === 'instagram') {
      return `https://www.instagram.com/${username}/`;
    }

    if (platform === 'youtube') {
      return `https://www.youtube.com/@${username}`;
    }

    if (platform === 'tiktok') {
      return `https://www.tiktok.com/@${username}`;
    }

    return '';
  }

  return (
    <div className="discover-page">
      <header className="discover-header">
        <div>
          <span className="discover-eyebrow">CREATOR COMMUNITY</span>
          <h1>Discover Creators</h1>
          <p>
            Find creators, explore different niches and discover
            people you could collaborate with.
          </p>
        </div>

        <div className="discover-count">
          <strong>{filteredCreators.length}</strong>
          <span>Creators found</span>
        </div>
      </header>

      <section className="discover-filters">
        <div className="discover-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search by name, username or bio..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={selectedNiche}
          onChange={(event) => setSelectedNiche(event.target.value)}
        >
          {niches.map((niche) => (
            <option key={niche} value={niche}>
              {niche}
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="discover-state">
          <div className="discover-spinner"></div>
          <p>Finding creators...</p>
        </div>
      ) : error ? (
        <div className="discover-state discover-error">
          <h3>Something went wrong</h3>
          <p>{error}</p>
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="discover-empty">
          <div className="discover-empty-icon">✦</div>
          <h3>No creators found</h3>
          <p>
            {creators.length === 0
              ? 'There are no other creator profiles available yet.'
              : 'Try changing your search or selecting another niche.'}
          </p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedNiche('All Niches');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="creator-grid">
          {filteredCreators.map((creator) => {
            const name = creator.full_name || 'Creator';
            const username = creator.username || 'username';
            const creatorNiches = Array.isArray(creator.niches)
              ? creator.niches
              : [];

            return (
              <article className="creator-card" key={creator.id}>
                <div className="creator-card-top">
                  {creator.avatar_url ? (
                    <img
                      className="creator-avatar"
                      src={creator.avatar_url}
                      alt={`${name}'s profile`}
                    />
                  ) : (
                    <div className="creator-avatar creator-avatar-fallback">
                      {getInitials(name, username)}
                    </div>
                  )}

                  <div className="creator-identity">
                    <h3>{name}</h3>
                    <span>@{username.replace(/^@/, '')}</span>
                  </div>
                </div>

                <p className="creator-bio">
                  {creator.bio || 'This creator has not added a bio yet.'}
                </p>

                <div className="creator-niches">
                  {creatorNiches.length > 0 ? (
                    creatorNiches.slice(0, 4).map((niche) => (
                      <span className="creator-niche" key={niche}>
                        {niche}
                      </span>
                    ))
                  ) : (
                    <span className="creator-niche">
                      Niche not specified
                    </span>
                  )}
                </div>

                <div className="creator-card-footer">
                  <div className="creator-socials">
                    {['instagram', 'youtube', 'tiktok'].map((platform) => {
                      const link = getSocialLink(
                        platform,
                        creator[platform]
                      );

                      return link ? (
                        <a
                          key={platform}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${platform} profile`}
                          title={platform}
                        >
                          {platform === 'instagram'
                            ? 'IG'
                            : platform === 'youtube'
                              ? 'YT'
                              : 'TT'}
                        </a>
                      ) : null;
                    })}
                  </div>

                  <span className="creator-profile-label">
                    Creator profile
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
