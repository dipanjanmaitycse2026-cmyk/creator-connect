
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import './OneToOne.css';

const tabs = ['Discover', 'Incoming', 'Sent', 'My Collaborations'];

function OneToOne() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('Discover');
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [collaborations, setCollaborations] = useState([]);

  const [selectedCreator, setSelectedCreator] = useState(null);
  const [message, setMessage] = useState('');
  const [proposedAt, setProposedAt] = useState('');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Calculate the minimum date once, rather than during every render.
  const [minimumDate] = useState(
    () => new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const [
        profilesResult,
        requestsResult,
        collaborationsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, full_name, username, bio, niches, avatar_url'
          )
          .neq('id', user.id)
          .order('full_name', { ascending: true }),

        supabase
          .from('collaboration_requests')
          .select(`
            id,
            sender_id,
            recipient_id,
            message,
            proposed_at,
            status,
            created_at
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('collaborations')
          .select(`
            id,
            request_id,
            creator_one,
            creator_two,
            title,
            scheduled_at,
            status,
            created_at
          `)
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      const fetchError =
        profilesResult.error ||
        requestsResult.error ||
        collaborationsResult.error;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setProfiles(profilesResult.data || []);
        setRequests(requestsResult.data || []);
        setCollaborations(collaborationsResult.data || []);
      }

      setLoading(false);
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshKey]);

  const refreshData = () => {
    setRefreshKey((current) => current + 1);
  };

  const getProfile = (profileId) =>
    profiles.find((profile) => profile.id === profileId);

  const formatDate = (date) => {
    if (!date) return 'Not scheduled';

    return new Date(date).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const sendRequest = async () => {
    if (!user?.id || !selectedCreator) return;

    setError('');
    setNotice('');

    if (selectedCreator.id === user.id) {
      setError('You cannot send a request to yourself.');
      return;
    }

    const alreadyPending = requests.some(
      (request) =>
        request.status === 'pending' &&
        (
          (request.sender_id === user.id &&
            request.recipient_id === selectedCreator.id) ||
          (request.sender_id === selectedCreator.id &&
            request.recipient_id === user.id)
        )
    );

    if (alreadyPending) {
      setError(
        'A pending request already exists between these creators.'
      );
      return;
    }

    const alreadyCollaborating = collaborations.some(
      (collaboration) =>
        (
          collaboration.creator_one === user.id &&
          collaboration.creator_two === selectedCreator.id
        ) ||
        (
          collaboration.creator_one === selectedCreator.id &&
          collaboration.creator_two === user.id
        )
    );

    if (alreadyCollaborating) {
      setError('You are already collaborating with this creator.');
      return;
    }

    let scheduledDate = null;

    if (proposedAt) {
      scheduledDate = new Date(proposedAt);

      if (Number.isNaN(scheduledDate.getTime())) {
        setError('Please enter a valid proposed date.');
        return;
      }

      if (scheduledDate <= new Date()) {
        setError('The proposed date must be in the future.');
        return;
      }
    }

    setSending(true);

    const { error: insertError } = await supabase
      .from('collaboration_requests')
      .insert({
        sender_id: user.id,
        recipient_id: selectedCreator.id,
        message: message.trim() || null,
        proposed_at: scheduledDate
          ? scheduledDate.toISOString()
          : null,
      });

    setSending(false);

    if (insertError) {
      if (insertError.code === '23505') {
        setError(
          'A pending request already exists between these creators.'
        );
      } else {
        setError(insertError.message);
      }
      return;
    }

    setSelectedCreator(null);
    setMessage('');
    setProposedAt('');
    setNotice('Collaboration request sent successfully.');
    setActiveTab('Sent');
    refreshData();
  };

  const respondToRequest = async (requestId, status) => {
    if (!['accepted', 'rejected'].includes(status)) return;

    setError('');
    setNotice('');
    setProcessingId(requestId);

    const { data, error: updateError } = await supabase
      .from('collaboration_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('recipient_id', user.id)
      .eq('status', 'pending')
      .select('id');

    setProcessingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (!data || data.length === 0) {
      setError(
        'This request has already been processed or is unavailable.'
      );
      refreshData();
      return;
    }

    setNotice(
      status === 'accepted'
        ? 'Collaboration request accepted.'
        : 'Collaboration request rejected.'
    );

    refreshData();
  };

  const filteredProfiles = profiles.filter((profile) => {
    const searchText = search.toLowerCase();

    return (
      (profile.full_name || '').toLowerCase().includes(searchText) ||
      (profile.username || '').toLowerCase().includes(searchText) ||
      (profile.bio || '').toLowerCase().includes(searchText) ||
      (profile.niches || []).some((niche) =>
        niche.toLowerCase().includes(searchText)
      )
    );
  });

  // Keep the complete request history, including processed requests.
  const incomingRequests = requests.filter(
    (request) => request.recipient_id === user?.id
  );

  const sentRequests = requests.filter(
    (request) => request.sender_id === user?.id
  );

  const pendingIncomingCount = incomingRequests.filter(
    (request) => request.status === 'pending'
  ).length;

  const myCollaborations = collaborations.filter(
    (collaboration) =>
      collaboration.creator_one === user?.id ||
      collaboration.creator_two === user?.id
  );

  const renderRequest = (request, incoming) => {
    const otherCreatorId = incoming
      ? request.sender_id
      : request.recipient_id;

    const creator = getProfile(otherCreatorId);

    const creatorName =
      creator?.full_name ||
      creator?.username ||
      'Creator';

    return (
      <div className="oto-request-card" key={request.id}>
        <div className="oto-request-top">
          <div className="oto-avatar">
            {creator?.avatar_url ? (
              <img src={creator.avatar_url} alt={creatorName} />
            ) : (
              creatorName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="oto-request-info">
            <h3>{creatorName}</h3>
            <p>
              {creator?.username
                ? `@${creator.username}`
                : 'Creator'}
            </p>
          </div>

          <span className={`oto-status ${request.status}`}>
            {request.status.charAt(0).toUpperCase() +
              request.status.slice(1)}
          </span>
        </div>

        {request.message && (
          <p className="oto-request-message">
            {request.message}
          </p>
        )}

        <div className="oto-request-date">
          <span>
            Requested: {formatDate(request.created_at)}
          </span>

          {request.proposed_at && (
            <span>
              Proposed: {formatDate(request.proposed_at)}
            </span>
          )}
        </div>

        {incoming && request.status === 'pending' && (
          <div className="oto-request-actions">
            <button
              className="oto-primary-btn"
              disabled={processingId === request.id}
              onClick={() =>
                respondToRequest(request.id, 'accepted')
              }
            >
              {processingId === request.id
                ? 'Please wait...'
                : 'Accept'}
            </button>

            <button
              className="oto-danger-btn"
              disabled={processingId === request.id}
              onClick={() =>
                respondToRequest(request.id, 'rejected')
              }
            >
              Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCollaboration = (collaboration) => {
    const otherCreatorId =
      collaboration.creator_one === user?.id
        ? collaboration.creator_two
        : collaboration.creator_one;

    const creator = getProfile(otherCreatorId);

    const creatorName =
      creator?.full_name ||
      creator?.username ||
      'Creator';

    return (
      <div
        className="oto-collaboration-card"
        key={collaboration.id}
      >
        <div className="oto-request-top">
          <div className="oto-avatar">
            {creator?.avatar_url ? (
              <img src={creator.avatar_url} alt={creatorName} />
            ) : (
              creatorName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="oto-request-info">
            <h3>{creatorName}</h3>
            <p>
              {collaboration.title || 'Creator Collaboration'}
            </p>
          </div>

          <span className="oto-status accepted">
            {collaboration.status || 'confirmed'}
          </span>
        </div>

        <div className="oto-request-date">
          <span>
            Scheduled: {formatDate(collaboration.scheduled_at)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="oto-page">
      <div className="oto-header">
        <button
          className="oto-back-btn"
          onClick={() => navigate('/collaboration')}
        >
          ← Back to Collaboration Hub
        </button>

        <div>
          <span className="oto-eyebrow">
            COLLABORATION HUB
          </span>

          <h1>One-to-One Collaboration</h1>

          <p>
            Discover creators, connect with them, and build
            something together.
          </p>
        </div>
      </div>

      {error && (
        <div className="oto-alert error">
          {error}
        </div>
      )}

      {notice && (
        <div className="oto-alert success">
          {notice}
        </div>
      )}

      <div className="oto-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => {
              setActiveTab(tab);
              setError('');
              setNotice('');
            }}
          >
            {tab}

            {tab === 'Incoming' &&
              pendingIncomingCount > 0 && (
                <span className="oto-tab-count">
                  {pendingIncomingCount}
                </span>
              )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="oto-empty">
          Loading collaboration data...
        </div>
      ) : (
        <>
          {activeTab === 'Discover' && (
            <section className="oto-section">
              <div className="oto-section-heading">
                <div>
                  <h2>Discover Creators</h2>
                  <p>
                    Find creators and send collaboration requests.
                  </p>
                </div>

                <span>{filteredProfiles.length} creators</span>
              </div>

              <input
                className="oto-search"
                type="text"
                placeholder="Search by name, username or niche..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {filteredProfiles.length === 0 ? (
                <div className="oto-empty">
                  No creators found.
                </div>
              ) : (
                <div className="oto-creator-grid">
                  {filteredProfiles.map((profile) => (
                    <div
                      className="oto-creator-card"
                      key={profile.id}
                    >
                      <div className="oto-avatar oto-large-avatar">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile.full_name || 'Creator'}
                          />
                        ) : (
                          (profile.full_name || 'C')
                            .charAt(0)
                            .toUpperCase()
                        )}
                      </div>

                      <h3>
                        {profile.full_name ||
                          profile.username ||
                          'Creator'}
                      </h3>

                      {profile.username && (
                        <p className="oto-username">
                          @{profile.username}
                        </p>
                      )}

                      <p className="oto-bio">
                        {profile.bio || 'No bio added yet.'}
                      </p>

                      <div className="oto-niches">
                        {(profile.niches || [])
                          .slice(0, 3)
                          .map((niche) => (
                            <span key={niche}>{niche}</span>
                          ))}
                      </div>

                      <button
                        className="oto-primary-btn"
                        onClick={() => {
                          setSelectedCreator(profile);
                          setError('');
                          setNotice('');
                        }}
                      >
                        Send Request
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'Incoming' && (
            <section className="oto-section">
              <div className="oto-section-heading">
                <div>
                  <h2>Incoming Requests</h2>
                  <p>
                    Requests sent to you by other creators.
                  </p>
                </div>
              </div>

              {incomingRequests.length === 0 ? (
                <div className="oto-empty">
                  You have no incoming requests yet.
                </div>
              ) : (
                <div className="oto-request-list">
                  {incomingRequests.map((request) =>
                    renderRequest(request, true)
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'Sent' && (
            <section className="oto-section">
              <div className="oto-section-heading">
                <div>
                  <h2>Sent Requests</h2>
                  <p>
                    Track all requests you have sent.
                  </p>
                </div>
              </div>

              {sentRequests.length === 0 ? (
                <div className="oto-empty">
                  You have not sent any requests yet.
                </div>
              ) : (
                <div className="oto-request-list">
                  {sentRequests.map((request) =>
                    renderRequest(request, false)
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'My Collaborations' && (
            <section className="oto-section">
              <div className="oto-section-heading">
                <div>
                  <h2>My Collaborations</h2>
                  <p>
                    Creators whose requests you have accepted.
                  </p>
                </div>
              </div>

              {myCollaborations.length === 0 ? (
                <div className="oto-empty">
                  You do not have any active collaborations yet.
                </div>
              ) : (
                <div className="oto-request-list">
                  {myCollaborations.map(renderCollaboration)}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {selectedCreator && (
        <div
          className="oto-modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCreator(null);
            }
          }}
        >
          <div className="oto-modal">
            <button
              className="oto-modal-close"
              onClick={() => setSelectedCreator(null)}
              aria-label="Close"
            >
              ×
            </button>

            <span className="oto-eyebrow">
              NEW COLLABORATION
            </span>

            <h2>
              Send request to{' '}
              {selectedCreator.full_name ||
                selectedCreator.username ||
                'Creator'}
            </h2>

            <label htmlFor="oto-message">
              Message (optional)
            </label>

            <textarea
              id="oto-message"
              placeholder="Tell the creator what you would like to collaborate on..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
            />

            <label htmlFor="oto-proposed-date">
              Proposed date and time (optional)
            </label>

            <input
              id="oto-proposed-date"
              type="datetime-local"
              value={proposedAt}
              min={minimumDate}
              onChange={(event) =>
                setProposedAt(event.target.value)
              }
            />

            <div className="oto-modal-actions">
              <button
                className="oto-secondary-btn"
                onClick={() => setSelectedCreator(null)}
                disabled={sending}
              >
                Cancel
              </button>

              <button
                className="oto-primary-btn"
                onClick={sendRequest}
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OneToOne;
