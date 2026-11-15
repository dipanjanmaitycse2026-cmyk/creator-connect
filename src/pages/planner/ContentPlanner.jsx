
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';
import './ContentPlanner.css';

const initialForm = {
  title: '',
  description: '',
  platform: 'Instagram',
  content_type: 'Reel',
};

const statusOptions = [
  'draft',
  'confirmed',
  'scheduled',
  'completed',
];

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalDateTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function ContentPlanner() {
  const [ideas, setIdeas] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [plannerEvents, setPlannerEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto Scientist AI
  const [aiEvaluatingId, setAiEvaluatingId] = useState(null);
  const [aiSavingId, setAiSavingId] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const [aiError, setAiError] = useState('');

  // Create and edit
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  // Status
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Scheduling
  const [scheduleEditingId, setScheduleEditingId] = useState(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('calendar');
  const [selectedCalendarItem, setSelectedCalendarItem] = useState(null);

  useEffect(() => {
    fetchIdeas();
  }, []);

  // =========================================
  // FETCH CONTENT, COLLABORATIONS AND EVENTS
  // =========================================

  async function fetchIdeas() {
    setLoading(true);
    setError('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Please log in to access your content ideas.');
      setLoading(false);
      return;
    }

    const [
      ideaResult,
      collaborationResult,
      plannerEventResult,
    ] = await Promise.all([
      supabase
        .from('content_ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      supabase
        .from('collaborations')
        .select(`
          id,
          creator_one,
          creator_two,
          title,
          scheduled_at,
          status
        `)
        .eq('status', 'confirmed')
        .not('scheduled_at', 'is', null)
        .or(`creator_one.eq.${user.id},creator_two.eq.${user.id}`)
        .order('scheduled_at', { ascending: true }),

      supabase
        .from('planner_events')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true }),
    ]);

    const fetchErrors = [];

    if (ideaResult.error) {
      fetchErrors.push(`Content ideas: ${ideaResult.error.message}`);
    } else {
      setIdeas(ideaResult.data || []);
    }

    if (collaborationResult.error) {
      fetchErrors.push(
        `Collaborations: ${collaborationResult.error.message}`
      );
    } else {
      setCollaborations(collaborationResult.data || []);
    }

    if (plannerEventResult.error) {
      fetchErrors.push(
        `Planner events: ${plannerEventResult.error.message}`
      );
    } else {
      setPlannerEvents(plannerEventResult.data || []);
    }

    if (fetchErrors.length > 0) {
      setError(fetchErrors.join(' | '));
    }

    setLoading(false);
  }

  // =========================================
  // CREATE AND EDIT
  // =========================================

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(initialForm);
    setError('');
    setShowForm(true);
  }

  function openEditForm(idea) {
    setEditingId(idea.id);

    setForm({
      title: idea.title || '',
      description: idea.description || '',
      platform: idea.platform || 'Instagram',
      content_type: idea.content_type || 'Reel',
    });

    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Please enter a content idea title.');
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Your session could not be verified. Please log in again.');
      setSaving(false);
      return;
    }

    const ideaData = {
      title: form.title.trim(),
      description: form.description.trim(),
      platform: form.platform,
      content_type: form.content_type,
    };

    let result;

    if (editingId) {
      result = await supabase
        .from('content_ideas')
        .update(ideaData)
        .eq('id', editingId)
        .eq('user_id', user.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('content_ideas')
        .insert({
          ...ideaData,
          user_id: user.id,
          status: 'draft',
        })
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    if (editingId) {
      setIdeas((previous) =>
        previous.map((idea) =>
          idea.id === editingId ? result.data : idea
        )
      );
    } else {
      setIdeas((previous) => [result.data, ...previous]);
    }

    closeForm();
    setSaving(false);
  }

  // =========================================
  // AUTO SCIENTIST AI EVALUATION
  // =========================================

  async function evaluateIdeaWithAI(idea) {
    setAiError('');
    setAiEvaluatingId(idea.id);

    try {
      const response = await fetch('http://localhost:5000/api/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [
            'You are the content strategy assistant for Creator Connect.',
            'Evaluate the creator content idea below.',
            'Give a practical, constructive evaluation with these headings:',
            '1. Overall assessment',
            '2. Strengths',
            '3. Improvements',
            '4. Suggested hook',
            '5. Recommended content approach',
            'Keep the advice specific to the selected platform and content type.',
            'Do not invent performance statistics or guarantee results.',
            '',
            `Title: ${idea.title || ''}`,
            `Description: ${idea.description || 'Not provided'}`,
            `Platform: ${idea.platform || 'Not specified'}`,
            `Content type: ${idea.content_type || 'Not specified'}`,
          ].join('\n'),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const message = typeof result.error === 'string'
          ? result.error
          : 'The AI evaluation request failed.';

        throw new Error(message);
      }

      if (
        !result.response ||
        result.response === 'No text response received.'
      ) {
        throw new Error('The AI returned an empty evaluation. Please try again.');
      }

      setAiResults((previous) => ({
        ...previous,
        [idea.id]: result.response,
      }));
    } catch (evaluationError) {
      setAiError(
        evaluationError.message || 'Unable to evaluate this idea.'
      );
    } finally {
      setAiEvaluatingId(null);
    }
  }

  async function saveAIFeedback(idea) {
    const feedback = aiResults[idea.id];
    if (!feedback) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAiError('Your session could not be verified. Please log in again.');
      return;
    }

    setAiSavingId(idea.id);
    setAiError('');

    const { data, error: updateError } = await supabase
      .from('content_ideas')
      .update({ ai_feedback: feedback })
      .eq('id', idea.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      setAiError(updateError.message);
    } else {
      setIdeas((previous) =>
        previous.map((item) =>
          item.id === idea.id ? data : item
        )
      );

      setAiResults((previous) => {
        const next = { ...previous };
        delete next[idea.id];
        return next;
      });
    }

    setAiSavingId(null);
  }

  function discardAIFeedback(ideaId) {
    setAiResults((previous) => {
      const next = { ...previous };
      delete next[ideaId];
      return next;
    });
  }

  // =========================================
  // DELETE IDEA
  // =========================================

  async function handleDelete(ideaId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this content idea?'
    );

    if (!confirmed) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Your session could not be verified.');
      return;
    }

    setDeletingId(ideaId);
    setError('');

    const { error: deleteError } = await supabase
      .from('content_ideas')
      .delete()
      .eq('id', ideaId)
      .eq('user_id', user.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setIdeas((previous) =>
        previous.filter((idea) => idea.id !== ideaId)
      );

      if (
        selectedCalendarItem?.type === 'content' &&
        selectedCalendarItem.data.id === ideaId
      ) {
        setSelectedCalendarItem(null);
      }
    }

    setDeletingId(null);
  }

  // =========================================
  // STATUS MANAGEMENT
  // =========================================

  async function handleStatusChange(idea, newStatus) {
    if (!statusOptions.includes(newStatus)) return;

    setError('');

    if (newStatus === 'scheduled') {
      setScheduleEditingId(idea.id);
      setScheduleValue(toLocalDateTime(idea.scheduled_at));
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Your session could not be verified.');
      return;
    }

    const previousIdeas = ideas;
    setUpdatingStatusId(idea.id);

    setIdeas((previous) =>
      previous.map((item) =>
        item.id === idea.id ? { ...item, status: newStatus } : item
      )
    );

    const { error: updateError } = await supabase
      .from('content_ideas')
      .update({ status: newStatus })
      .eq('id', idea.id)
      .eq('user_id', user.id);

    if (updateError) {
      setIdeas(previousIdeas);
      setError(updateError.message);
    }

    setUpdatingStatusId(null);
  }

  // =========================================
  // SCHEDULING
  // =========================================

  async function handleScheduleSave(ideaId) {
    setError('');

    if (!scheduleValue) {
      setError('Please select a publishing date and time.');
      return;
    }

    const selectedDate = new Date(scheduleValue);

    if (Number.isNaN(selectedDate.getTime())) {
      setError('Please select a valid date and time.');
      return;
    }

    if (selectedDate.getTime() <= Date.now()) {
      setError('Please select a future publishing date and time.');
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('Your session could not be verified.');
      return;
    }

    setScheduleSaving(true);

    const scheduledAt = selectedDate.toISOString();

    const { data, error: updateError } = await supabase
      .from('content_ideas')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledAt,
      })
      .eq('id', ideaId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
    } else {
      setIdeas((previous) =>
        previous.map((idea) =>
          idea.id === ideaId ? data : idea
        )
      );

      setScheduleEditingId(null);
      setScheduleValue('');
    }

    setScheduleSaving(false);
  }

  function cancelSchedule() {
    setScheduleEditingId(null);
    setScheduleValue('');
  }

  // =========================================
  // CALENDAR HELPERS
  // =========================================

  function getCalendarItems(date) {
    const dateKey = getDateKey(date);

    const contentItems = ideas
      .filter((idea) => {
        if (idea.status !== 'scheduled' || !idea.scheduled_at) {
          return false;
        }

        const scheduledDate = new Date(idea.scheduled_at);

        return (
          !Number.isNaN(scheduledDate.getTime()) &&
          getDateKey(scheduledDate) === dateKey
        );
      })
      .map((idea) => ({
        type: 'content',
        id: `content-${idea.id}`,
        data: idea,
        date: idea.scheduled_at,
      }));

    const collaborationItems = collaborations
      .filter((collaboration) => {
        if (!collaboration.scheduled_at) return false;

        const scheduledDate = new Date(collaboration.scheduled_at);

        return (
          !Number.isNaN(scheduledDate.getTime()) &&
          getDateKey(scheduledDate) === dateKey
        );
      })
      .map((collaboration) => ({
        type: 'collaboration',
        id: `collaboration-${collaboration.id}`,
        data: collaboration,
        date: collaboration.scheduled_at,
      }));

    const wellnessItems = plannerEvents
      .filter((event) => {
        if (!event.start_time) return false;

        const eventDate = new Date(event.start_time);

        return (
          !Number.isNaN(eventDate.getTime()) &&
          getDateKey(eventDate) === dateKey
        );
      })
      .map((event) => ({
        type: 'wellness',
        id: `wellness-${event.id}`,
        data: event,
        date: event.start_time,
      }));

    return [
      ...contentItems,
      ...collaborationItems,
      ...wellnessItems,
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function changeMonth(direction) {
    setCalendarDate((previous) =>
      new Date(
        previous.getFullYear(),
        previous.getMonth() + direction,
        1
      )
    );
  }

  function renderCalendarDays() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = getDateKey(new Date());
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(
        <div className="calendar-day empty-day" key={`empty-${i}`} />
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dateKey = getDateKey(currentDate);
      const calendarItems = getCalendarItems(currentDate);

      cells.push(
        <div
          className={`calendar-day ${dateKey === todayKey ? 'today' : ''}`}
          key={dateKey}
        >
          <span className="calendar-day-number">{day}</span>

          <div className="calendar-events">
            {calendarItems.map((item) => (
              <button
                type="button"
                className={`calendar-event ${
                  item.type === 'collaboration'
                    ? 'collaboration-calendar-event'
                    : item.type === 'wellness'
                      ? 'wellness-calendar-event'
                      : ''
                }`}
                key={item.id}
                onClick={() => setSelectedCalendarItem(item)}
                title={
                  item.type === 'collaboration'
                    ? `Collaboration: ${item.data.title || 'Untitled collaboration'}`
                    : item.type === 'wellness'
                      ? `Wellness task: ${item.data.title || 'Untitled task'}`
                      : item.data.title
                }
              >
                {item.type === 'collaboration'
                  ? '🤝 '
                  : item.type === 'wellness'
                    ? '✓ '
                    : '• '}

                {item.data.title || 'Untitled event'}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return cells;
  }

  // =========================================
  // CALENDAR LIST DATA
  // =========================================

  const scheduledIdeas = ideas
    .filter((idea) => idea.status === 'scheduled' && idea.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const scheduledCollaborations = collaborations
    .filter((item) => item.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  const calendarListItems = [
    ...scheduledIdeas.map((idea) => ({
      type: 'content',
      id: `content-${idea.id}`,
      data: idea,
      date: idea.scheduled_at,
    })),

    ...scheduledCollaborations.map((collaboration) => ({
      type: 'collaboration',
      id: `collaboration-${collaboration.id}`,
      data: collaboration,
      date: collaboration.scheduled_at,
    })),

    ...plannerEvents
      .filter((event) => event.start_time)
      .map((event) => ({
        type: 'wellness',
        id: `wellness-${event.id}`,
        data: event,
        date: event.start_time,
      })),
  ]
    .filter((item) => !Number.isNaN(new Date(item.date).getTime()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // =========================================
  // MAIN UI
  // =========================================

  return (
    <div className="content-planner">
      <header className="planner-header">
        <div>
          <p className="planner-eyebrow">CREATOR WORKSPACE</p>
          <h1>Content Planner</h1>
          <p>
            Organise your ideas, manage your content workflow,
            and prepare your next creation.
          </p>
        </div>

        <button
          className="add-idea-button"
          type="button"
          onClick={openCreateForm}
        >
          + Add New Idea
        </button>
      </header>

      {error && (
        <div className="planner-error" role="alert">
          {error}
        </div>
      )}

      {aiError && (
        <div className="planner-error" role="alert">
          {aiError}
        </div>
      )}

      {showForm && (
        <section className="idea-form-section">
          <div className="planner-section-heading">
            <h2>{editingId ? 'Edit Idea' : 'Create New Idea'}</h2>

            <button
              type="button"
              className="close-form-button"
              onClick={closeForm}
            >
              ✕
            </button>
          </div>

          <form className="idea-form" onSubmit={handleSubmit}>
            <label htmlFor="idea-title">Idea Title</label>
            <input
              id="idea-title"
              name="title"
              type="text"
              placeholder="Enter your content idea"
              value={form.title}
              onChange={handleChange}
              required
            />

            <label htmlFor="idea-description">Description</label>
            <textarea
              id="idea-description"
              name="description"
              placeholder="Describe what you want to create..."
              value={form.description}
              onChange={handleChange}
              rows={4}
            />

            <div className="idea-form-row">
              <div>
                <label htmlFor="idea-platform">Platform</label>
                <select
                  id="idea-platform"
                  name="platform"
                  value={form.platform}
                  onChange={handleChange}
                >
                  <option value="Instagram">Instagram</option>
                  <option value="YouTube">YouTube</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="idea-content-type">Content Type</label>
                <select
                  id="idea-content-type"
                  name="content_type"
                  value={form.content_type}
                  onChange={handleChange}
                >
                  <option value="Reel">Reel</option>
                  <option value="Short">Short</option>
                  <option value="Video">Video</option>
                  <option value="Post">Post</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="idea-form-actions">
              <button
                type="button"
                className="cancel-idea-button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-idea-button"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Update Idea'
                    : 'Save Idea'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* CONTENT CALENDAR */}

      <section className="content-calendar">
        <div className="calendar-header">
          <div>
            <p className="planner-eyebrow">PUBLISHING & COLLABORATIONS</p>
            <h2>Content Calendar</h2>
            <p>
              Track your publishing schedule, confirmed collaborations
              and Wellness tasks.
            </p>
          </div>

          <div className="calendar-view-buttons">
            <button
              type="button"
              className={calendarView === 'calendar' ? 'active' : ''}
              onClick={() => setCalendarView('calendar')}
            >
              Calendar
            </button>

            <button
              type="button"
              className={calendarView === 'list' ? 'active' : ''}
              onClick={() => setCalendarView('list')}
            >
              List
            </button>
          </div>
        </div>

        <div className="calendar-legend">
          <span>• Scheduled content</span>
          <span>🤝 Confirmed collaboration</span>
          <span>✓ Wellness tasks</span>
        </div>

        {loading ? (
          <p className="calendar-no-events">Loading calendar...</p>
        ) : calendarView === 'calendar' ? (
          <>
            <div className="calendar-navigation">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                ←
              </button>

              <h3>
                {calendarDate.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                →
              </button>
            </div>

            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (day) => (
                  <div className="calendar-weekday" key={day}>
                    {day}
                  </div>
                )
              )}

              {renderCalendarDays()}
            </div>
          </>
        ) : (
          <div className="calendar-list">
            {calendarListItems.map((item) => (
              <button
                type="button"
                className="calendar-list-item"
                key={item.id}
                onClick={() => setSelectedCalendarItem(item)}
              >
                <span>{new Date(item.date).toLocaleString()}</span>

                <strong>
                  {item.type === 'collaboration'
                    ? '🤝 '
                    : item.type === 'wellness'
                      ? '✓ '
                      : '• '}

                  {item.data.title || 'Untitled event'}
                </strong>

                <small>
                  {item.type === 'collaboration'
                    ? 'Confirmed collaboration'
                    : item.type === 'wellness'
                      ? 'Wellness task'
                      : item.data.platform}
                </small>
              </button>
            ))}

            {calendarListItems.length === 0 && (
              <p className="calendar-no-events">
                No scheduled content, collaborations or Wellness tasks yet.
              </p>
            )}
          </div>
        )}

        {/* SELECTED CALENDAR ITEM */}

        {selectedCalendarItem && (
          <div className="calendar-detail">
            <div>
              <span className="planner-eyebrow">
                {selectedCalendarItem.type === 'collaboration'
                  ? 'CONFIRMED COLLABORATION'
                  : selectedCalendarItem.type === 'wellness'
                    ? 'WELLNESS TASK'
                    : 'SCHEDULED CONTENT'}
              </span>

              <h3>
                {selectedCalendarItem.data.title || 'Untitled event'}
              </h3>

              {selectedCalendarItem.type === 'content' ? (
                <>
                  <p>
                    {selectedCalendarItem.data.description ||
                      'No description provided.'}
                  </p>

                  <p>
                    Publishing:{' '}
                    {new Date(
                      selectedCalendarItem.data.scheduled_at
                    ).toLocaleString()}
                  </p>

                  <p>
                    {selectedCalendarItem.data.platform} ·{' '}
                    {selectedCalendarItem.data.content_type}
                  </p>
                </>
              ) : selectedCalendarItem.type === 'collaboration' ? (
                <>
                  <p>
                    Collaboration scheduled for:{' '}
                    {new Date(
                      selectedCalendarItem.data.scheduled_at
                    ).toLocaleString()}
                  </p>

                  <p>Status: Confirmed</p>
                </>
              ) : (
                <>
                  <p>
                    {selectedCalendarItem.data.description ||
                      'Wellness task added from your Wellness Centre.'}
                  </p>

                  <p>
                    Date:{' '}
                    {new Date(
                      selectedCalendarItem.data.start_time
                    ).toLocaleDateString()}
                  </p>

                  <p>
                    Event type:{' '}
                    {selectedCalendarItem.data.event_type || 'Wellness task'}
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedCalendarItem(null)}
            >
              Close
            </button>
          </div>
        )}
      </section>

      {/* CONTENT IDEAS */}

      <section className="planner-section">
        <div className="planner-section-heading">
          <div>
            <h2>Your Content Ideas</h2>
            <p>Manage the progress of your creative ideas.</p>
          </div>

          <span className="idea-count">
            {ideas.length} {ideas.length === 1 ? 'Idea' : 'Ideas'}
          </span>
        </div>

        {loading ? (
          <div className="planner-empty-state">
            Loading your ideas...
          </div>
        ) : ideas.length === 0 ? (
          <div className="planner-empty-state">
            <h3>No content ideas yet</h3>
            <p>
              Start building your content strategy by adding your first idea.
            </p>

            <button
              type="button"
              className="add-idea-button"
              onClick={openCreateForm}
            >
              Create Your First Idea
            </button>
          </div>
        ) : (
          <div className="idea-list">
            {ideas.map((idea) => (
              <article className="idea-card" key={idea.id}>
                <div className="idea-card-header">
                  <div className="idea-status-control">
                    <span className={`idea-status status-${idea.status}`}>
                      {idea.status}
                    </span>

                    <select
                      className="idea-status-select"
                      value={idea.status}
                      disabled={updatingStatusId === idea.id}
                      onChange={(event) =>
                        handleStatusChange(idea, event.target.value)
                      }
                      aria-label={`Change status for ${idea.title}`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>

                    {updatingStatusId === idea.id && (
                      <span className="status-saving">Saving...</span>
                    )}
                  </div>

                  <div className="idea-actions">
                    <button
                      type="button"
                      className="edit-idea-button"
                      onClick={() => openEditForm(idea)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-idea-button"
                      onClick={() => handleDelete(idea.id)}
                      disabled={deletingId === idea.id}
                    >
                      {deletingId === idea.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                <h3>{idea.title}</h3>

                {idea.description && (
                  <p className="idea-description">{idea.description}</p>
                )}

                <div className="idea-meta">
                  {idea.platform && <span>{idea.platform}</span>}
                  {idea.content_type && <span>{idea.content_type}</span>}
                </div>

                <div className="ai-evaluation-actions">
                  <button
                    type="button"
                    className="edit-idea-button"
                    onClick={() => evaluateIdeaWithAI(idea)}
                    disabled={aiEvaluatingId === idea.id}
                  >
                    {aiEvaluatingId === idea.id
                      ? 'Evaluating...'
                      : '✨ Evaluate with AI'}
                  </button>
                </div>

                {/* AI FEEDBACK REPORT */}

                {(aiResults[idea.id] || idea.ai_feedback) && (
                  <section className="ai-feedback-panel">
                    <div className="ai-report-header">
                      <div className="ai-report-brand">
                        <span className="ai-report-icon" aria-hidden="true">
                          ✦
                        </span>

                        <div>
                          <span className="ai-report-eyebrow">
                            CREATOR CONNECT · AI INSIGHTS
                          </span>
                          <h4>Auto Scientist Evaluation</h4>
                        </div>
                      </div>

                      <span className="ai-report-status">
                        Evaluation report
                      </span>
                    </div>

                    <div className="ai-report-content">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => (
                            <h2 className="ai-report-title">{children}</h2>
                          ),
                          h2: ({ children }) => (
                            <h3 className="ai-report-section-title">
                              {children}
                            </h3>
                          ),
                          h3: ({ children }) => (
                            <h4 className="ai-report-subtitle">{children}</h4>
                          ),
                          p: ({ children }) => (
                            <p className="ai-report-paragraph">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="ai-report-list">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="ai-report-list ai-report-ordered">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => <li>{children}</li>,
                          blockquote: ({ children }) => (
                            <blockquote className="ai-report-quote">
                              {children}
                            </blockquote>
                          ),
                          strong: ({ children }) => <strong>{children}</strong>,
                          em: ({ children }) => <em>{children}</em>,
                          code: ({ children }) => (
                            <code className="ai-report-code">{children}</code>
                          ),
                          hr: () => <hr className="ai-report-divider" />,
                        }}
                      >
                        {aiResults[idea.id] || idea.ai_feedback}
                      </ReactMarkdown>
                    </div>

                    {aiResults[idea.id] && (
                      <div className="idea-form-actions">
                        <button
                          type="button"
                          className="save-idea-button"
                          onClick={() => saveAIFeedback(idea)}
                          disabled={aiSavingId === idea.id}
                        >
                          {aiSavingId === idea.id
                            ? 'Saving...'
                            : 'Save AI Feedback'}
                        </button>

                        <button
                          type="button"
                          className="cancel-idea-button"
                          onClick={() => discardAIFeedback(idea.id)}
                          disabled={aiSavingId === idea.id}
                        >
                          Discard
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {idea.status === 'scheduled' && idea.scheduled_at && (
                  <div className="scheduled-date">
                    <span>Publishing date</span>
                    <strong>
                      {new Date(idea.scheduled_at).toLocaleString()}
                    </strong>
                  </div>
                )}

                {scheduleEditingId === idea.id && (
                  <div className="schedule-editor">
                    <label htmlFor={`schedule-${idea.id}`}>
                      Select publishing date and time
                    </label>

                    <input
                      id={`schedule-${idea.id}`}
                      type="datetime-local"
                      value={scheduleValue}
                      min={toLocalDateTime(new Date())}
                      onChange={(event) =>
                        setScheduleValue(event.target.value)
                      }
                    />

                    <div className="schedule-actions">
                      <button
                        type="button"
                        className="save-schedule-button"
                        onClick={() => handleScheduleSave(idea.id)}
                        disabled={scheduleSaving}
                      >
                        {scheduleSaving ? 'Saving...' : 'Save Schedule'}
                      </button>

                      <button
                        type="button"
                        className="cancel-schedule-button"
                        onClick={cancelSchedule}
                        disabled={scheduleSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {idea.created_at && (
                  <p className="idea-date">
                    Created: {new Date(idea.created_at).toLocaleDateString()}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default ContentPlanner;
