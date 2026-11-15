import { API_BASE_URL } from '../../lib/api';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';
import './WellnessCentre.css';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const validEventTypes = [
  'personal',
  'content',
  'collaboration',
  'reminder',
];

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEventDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleString();
}

function formatPlanTime(value) {
  if (!value) return 'Time unavailable';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  return date.toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// =========================================
// AI PLAN PARSER
// Supports JSON and Markdown responses.
// =========================================

function parseAIPlan(response) {
  const cleaned = response
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  // First, try to parse JSON.
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(
        cleaned.slice(firstBrace, lastBrace + 1)
      );

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return {
          structured: true,
          overview:
            typeof parsed.overview === 'string'
              ? parsed.overview
              : '',
          priority_tasks: Array.isArray(parsed.priority_tasks)
            ? parsed.priority_tasks
            : [],
          schedule: Array.isArray(parsed.schedule)
            ? parsed.schedule
            : [],
          breaks: Array.isArray(parsed.breaks)
            ? parsed.breaks
            : [],
          suggestions: Array.isArray(parsed.suggestions)
            ? parsed.suggestions
            : [],
        };
      }
    } catch {
      // Continue to Markdown parsing.
    }
  }

  // Markdown fallback.
  // Only accept explicit dates and times.
  const priorityTasks = [];
  const schedule = [];

  const lines = response.split('\n');

  let currentSection = '';

  for (const originalLine of lines) {
    const line = originalLine.trim();

    if (!line) continue;

    const heading = line.match(/^#{1,4}\s*(.+)$/);

    if (heading) {
      const headingText = heading[1].toLowerCase();

      if (headingText.includes('priority task')) {
        currentSection = 'tasks';
      } else if (headingText.includes('suggested schedule')) {
        currentSection = 'schedule';
      } else {
        currentSection = '';
      }

      continue;
    }

    if (
      !line.startsWith('- ') &&
      !line.startsWith('* ')
    ) {
      continue;
    }

    const content = line.replace(/^[-*]\s*/, '').trim();

    if (currentSection === 'tasks') {
      // Expected format:
      // - Title | Description | YYYY-MM-DD

      const parts = content.split('|').map((part) => part.trim());

      if (
        parts.length >= 3 &&
        /^\d{4}-\d{2}-\d{2}$/.test(parts[2])
      ) {
        priorityTasks.push({
          title: parts[0],
          description: parts[1],
          task_date: parts[2],
        });
      }
    }

    if (currentSection === 'schedule') {
      // Expected format:
      // - Title | Description | Start ISO | End ISO | event_type

      const parts = content.split('|').map((part) => part.trim());

      if (
        parts.length >= 4 &&
        !Number.isNaN(new Date(parts[2]).getTime()) &&
        !Number.isNaN(new Date(parts[3]).getTime()) &&
        new Date(parts[3]) > new Date(parts[2])
      ) {
        schedule.push({
          title: parts[0],
          description: parts[1],
          start_time: parts[2],
          end_time: parts[3],
          event_type: validEventTypes.includes(parts[4])
            ? parts[4]
            : 'reminder',
        });
      }
    }
  }

  return {
    structured: false,
    markdownFallback: true,
    raw: response,
    priority_tasks: priorityTasks,
    schedule,
  };
}

// =========================================
// VALIDATE AI TASK
// =========================================

function cleanPlanTask(task) {
  if (!task || typeof task !== 'object') return null;

  const title =
    typeof task.title === 'string'
      ? task.title.trim()
      : '';

  if (!title) return null;

  const taskDate =
    typeof task.task_date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(task.task_date)
      ? task.task_date
      : '';

  // Do not invent a date for a task.
  if (!taskDate) return null;

  return {
    title,
    description:
      typeof task.description === 'string'
        ? task.description.trim()
        : '',
    task_date: taskDate,
  };
}

// =========================================
// VALIDATE AI SCHEDULE ITEM
// =========================================

function cleanScheduleItem(item) {
  if (!item || typeof item !== 'object') return null;

  const title =
    typeof item.title === 'string'
      ? item.title.trim()
      : '';

  const startTime =
    typeof item.start_time === 'string'
      ? item.start_time.trim()
      : '';

  const endTime =
    typeof item.end_time === 'string'
      ? item.end_time.trim()
      : '';

  if (!title || !startTime || !endTime) {
    return null;
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return null;
  }

  return {
    title,
    description:
      typeof item.description === 'string'
        ? item.description.trim()
        : '',
    start_time: startTime,
    end_time: endTime,
    event_type: validEventTypes.includes(item.event_type)
      ? item.event_type
      : 'reminder',
  };
}

export default function WellnessCentre() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [activeView, setActiveView] = useState('daily');
  const [newTask, setNewTask] = useState('');
  const [showTaskInput, setShowTaskInput] = useState(false);

  const [notice, setNotice] = useState('');

  // AI plan
  const [aiPlan, setAiPlan] = useState(null);
  const [aiPlanMode, setAiPlanMode] = useState('daily');
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanSaving, setAiPlanSaving] = useState(false);
  const [aiPlanError, setAiPlanError] = useState('');

  // AI assistant chat
  const [assistantMessage, setAssistantMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const today = new Date();
  const todayKey = getDateKey(today);

  const todaysTasks = tasks.filter(
    (task) => task.task_date === todayKey
  );

  const completedTasks = todaysTasks.filter(
    (task) => task.completed
  ).length;

  const progress = todaysTasks.length
    ? Math.round((completedTasks / todaysTasks.length) * 100)
    : 0;

  // =========================================
  // FETCH SUPABASE DATA
  // =========================================

  useEffect(() => {
    fetchWellnessData();
  }, []);

  async function fetchWellnessData() {
    setLoading(true);
    setError('');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError('Please log in to access your Wellness Centre.');
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();

    const [
      taskResult,
      plannerEventResult,
      contentResult,
      collaborationResult,
    ] = await Promise.all([
      supabase
        .from('wellness_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('task_date', { ascending: true }),

      supabase
        .from('planner_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', now)
        .order('start_time', { ascending: true }),

      supabase
        .from('content_ideas')
        .select('id, title, description, platform, scheduled_at, status')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true }),

      supabase
        .from('collaborations')
        .select('id, creator_one, creator_two, title, scheduled_at, status')
        .eq('status', 'confirmed')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now)
        .or(`creator_one.eq.${user.id},creator_two.eq.${user.id}`)
        .order('scheduled_at', { ascending: true }),
    ]);

    const fetchErrors = [];

    if (taskResult.error) {
      fetchErrors.push(`Tasks: ${taskResult.error.message}`);
    } else {
      setTasks(taskResult.data || []);
    }

    const combinedEvents = [];

    if (plannerEventResult.error) {
      fetchErrors.push(
        `Planner events: ${plannerEventResult.error.message}`
      );
    } else {
      (plannerEventResult.data || []).forEach((event) => {
        combinedEvents.push({
          id: `planner-${event.id}`,
          title: event.title,
          description: event.description,
          event_type: event.event_type || 'reminder',
          start_time: event.start_time,
          end_time: event.end_time,
          source: 'Planner event',
        });
      });
    }

    if (contentResult.error) {
      fetchErrors.push(
        `Scheduled content: ${contentResult.error.message}`
      );
    } else {
      (contentResult.data || []).forEach((idea) => {
        combinedEvents.push({
          id: `content-${idea.id}`,
          title: idea.title,
          description: idea.description,
          event_type: 'content',
          start_time: idea.scheduled_at,
          source: idea.platform
            ? `Content · ${idea.platform}`
            : 'Scheduled content',
        });
      });
    }

    if (collaborationResult.error) {
      fetchErrors.push(
        `Collaborations: ${collaborationResult.error.message}`
      );
    } else {
      (collaborationResult.data || []).forEach((collaboration) => {
        combinedEvents.push({
          id: `collaboration-${collaboration.id}`,
          title: collaboration.title || 'Creator collaboration',
          description: 'Confirmed collaboration',
          event_type: 'collaboration',
          start_time: collaboration.scheduled_at,
          source: 'Confirmed collaboration',
        });
      });
    }

    combinedEvents.sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    );

    setEvents(combinedEvents);

    if (fetchErrors.length > 0) {
      setError(fetchErrors.join(' | '));
    }

    setLoading(false);
  }

  // =========================================
  // ADD TASK
  // =========================================

  async function addTask(event) {
    event.preventDefault();

    if (!newTask.trim()) return;

    setSaving(true);
    setError('');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError('Your login session could not be verified.');
      setSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('wellness_tasks')
      .insert({
        user_id: user.id,
        title: newTask.trim(),
        task_date: todayKey,
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
    } else {
      setTasks((previous) => [...previous, data]);
      setNewTask('');
      setShowTaskInput(false);
    }

    setSaving(false);
  }

  // =========================================
  // UPDATE TASK COMPLETION
  // =========================================

  async function toggleTask(task) {
    setError('');

    const newCompletedState = !task.completed;

    setTasks((previous) =>
      previous.map((item) =>
        item.id === task.id
          ? { ...item, completed: newCompletedState }
          : item
      )
    );

    const { error: updateError } = await supabase
      .from('wellness_tasks')
      .update({ completed: newCompletedState })
      .eq('id', task.id)
      .eq('user_id', task.user_id);

    if (updateError) {
      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id
            ? { ...item, completed: task.completed }
            : item
        )
      );

      setError(updateError.message);
    }
  }

  // =========================================
  // AI CONTEXT
  // =========================================

  function buildAIContext() {
    const currentDate = new Date();

    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartKey = getDateKey(weekStart);
    const weekEndKey = getDateKey(weekEnd);

    const currentWeekTasks = tasks.filter(
      (task) =>
        task.task_date >= weekStartKey &&
        task.task_date <= weekEndKey
    );

    const taskSummary = currentWeekTasks.length
      ? currentWeekTasks.map((task) =>
          `- ${task.title} | Date: ${task.task_date} | ${
            task.completed ? 'Completed' : 'Pending'
          }`
        ).join('\n')
      : 'No tasks currently scheduled.';

    const eventSummary = events.length
      ? events.map((event) =>
          `- ${event.title} | ${event.source} | ${formatEventDate(event.start_time)}`
        ).join('\n')
      : 'No upcoming events.';

    return `
CURRENT DATE: ${formatDate(currentDate)}
CURRENT DATE KEY: ${todayKey}
TIMEZONE: Asia/Kolkata

CURRENT WEEK:
${weekStartKey} to ${weekEndKey}

TASKS:
${taskSummary}

UPCOMING EVENTS:
${eventSummary}

TODAY'S PROGRESS:
${completedTasks} completed out of ${todaysTasks.length} tasks.
Progress: ${progress}%.
`;
  }

  // =========================================
  // AI BACKEND REQUEST
  // =========================================

  async function requestAI(input) {
    const response = await fetch(`${API_BASE_URL}/api/ai/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error('The AI server returned an invalid response.');
    }

    if (!response.ok || !result.success) {
      const message = typeof result.error === 'string'
        ? result.error
        : 'The AI request failed. Please try again.';

      throw new Error(message);
    }

    if (
      !result.response ||
      result.response === 'No text response received.'
    ) {
      throw new Error('The AI returned an empty response.');
    }

    return result.response;
  }

  // =========================================
  // GENERATE DAILY / WEEKLY PLAN
  // =========================================

  async function generatePlan(mode = activeView) {
    setAiPlanError('');
    setAiPlan(null);
    setAiPlanLoading(true);
    setNotice('');

    const period = mode === 'weekly' ? 'weekly' : 'daily';
    setAiPlanMode(period);

    const prompt = `
You are the Wellness Assistant inside Creator Connect.

Create a practical ${period} plan using the application information below.

${buildAIContext()}

IMPORTANT RULES:
- Create a realistic and manageable plan.
- Prioritise pending tasks and upcoming events.
- Account for scheduled content and confirmed collaborations.
- Never duplicate existing scheduled content or collaborations.
- Include reasonable breaks and personal time.
- Do not overload the schedule.
- Do not invent appointments, deadlines or commitments.
- Suggested schedule blocks are proposals, not existing commitments.
- Avoid scheduling over existing events.
- Use the current date and timezone supplied above.
- Use ISO date-time strings with the +05:30 offset for schedule start_time and end_time.
- For weekly plans, keep all suggested items within the current week.
- Priority tasks must have task_date in YYYY-MM-DD format.
- Use event_type values only from: personal, content, collaboration, reminder.
- Keep descriptions short and useful.
- Suggestions must be practical and optional.
- Do not use vague dates such as "tomorrow" for saveable tasks.
- Do not use vague times such as "morning" or "afternoon" for saveable events.
- If no new dated tasks or timed events are suitable, return empty arrays.

Return ONLY valid JSON. Do not use Markdown fences or additional text.

Use this exact structure:
{
  "overview": "Short explanation of the suggested approach",
  "priority_tasks": [
    {
      "title": "Task title",
      "description": "Short description",
      "task_date": "YYYY-MM-DD"
    }
  ],
  "schedule": [
    {
      "title": "Schedule item title",
      "description": "What this time block is for",
      "start_time": "YYYY-MM-DDTHH:mm:ss+05:30",
      "end_time": "YYYY-MM-DDTHH:mm:ss+05:30",
      "event_type": "personal"
    }
  ],
  "breaks": [
    "A suggested break"
  ],
  "suggestions": [
    "A helpful suggestion"
  ]
}

Return empty arrays if there are no suitable items. Do not invent fixed commitments.
`;

    try {
      const result = await requestAI(prompt);
      const parsedPlan = parseAIPlan(result);

      setAiPlan(parsedPlan);
    } catch (aiError) {
      setAiPlanError(
        aiError.message || 'Unable to generate your plan.'
      );
    } finally {
      setAiPlanLoading(false);
    }
  }

  // =========================================
  // CONFIRM AI PLAN AND SAVE TO SUPABASE
  // =========================================

  async function confirmAIPlan() {
    if (
      !aiPlan ||
      aiPlanSaving ||
      (!aiPlan.structured && !aiPlan.markdownFallback)
    ) {
      return;
    }

    const scheduleItems = (aiPlan.schedule || [])
      .map(cleanScheduleItem)
      .filter(Boolean);

    const priorityTasks = (aiPlan.priority_tasks || [])
      .map(cleanPlanTask)
      .filter(Boolean);

    if (!scheduleItems.length && !priorityTasks.length) {
      setAiPlanError(
        'This plan does not contain any valid dated tasks or timed schedule items to save.'
      );
      return;
    }

    setAiPlanSaving(true);
    setAiPlanError('');
    setNotice('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          'Your login session could not be verified. Please log in again.'
        );
      }

      let savedScheduleCount = 0;
      let savedTaskCount = 0;

      // Save timed schedule items to Content Planner.
      if (scheduleItems.length > 0) {
        const plannerRows = scheduleItems.map((item) => ({
          user_id: user.id,
          title: item.title,
          description: item.description || null,
          event_type: item.event_type,
          start_time: item.start_time,
          end_time: item.end_time,
        }));

        const { error: plannerError } = await supabase
          .from('planner_events')
          .insert(plannerRows);

        if (plannerError) {
          throw new Error(
            `Could not save schedule items: ${plannerError.message}`
          );
        }

        savedScheduleCount = plannerRows.length;

        // Remove saved entries from the pending plan.
        setAiPlan((previous) => ({
          ...previous,
          schedule: [],
        }));
      }

      // Save priority tasks to Wellness Centre.
      if (priorityTasks.length > 0) {
        const taskRows = priorityTasks.map((task) => ({
          user_id: user.id,
          title: task.title,
          description: task.description || null,
          task_date: task.task_date,
          completed: false,
        }));

        const { error: taskError } = await supabase
          .from('wellness_tasks')
          .insert(taskRows);

        if (taskError) {
          throw new Error(
            `Schedule items were saved, but some priority tasks could not be saved: ${taskError.message}`
          );
        }

        savedTaskCount = taskRows.length;

        setAiPlan((previous) => ({
          ...previous,
          priority_tasks: [],
        }));
      }

      await fetchWellnessData();

      setNotice(
        `Plan saved successfully: ${savedScheduleCount} schedule item(s) added to Content Planner and ${savedTaskCount} task(s) added to Wellness Centre.`
      );

      setAiPlan(null);
    } catch (saveError) {
      setAiPlanError(
        saveError.message || 'Unable to save the AI plan.'
      );
    } finally {
      setAiPlanSaving(false);
    }
  }

  // =========================================
  // AI ASSISTANT CHAT
  // =========================================

  async function handleAssistantSubmit(event) {
    event.preventDefault();

    const message = assistantMessage.trim();

    if (!message || chatLoading) return;

    setAssistantMessage('');
    setChatLoading(true);
    setAiPlanError('');

    const updatedMessages = [
      ...chatMessages,
      {
        role: 'user',
        content: message,
      },
    ];

    setChatMessages(updatedMessages);

    const conversation = updatedMessages
      .slice(-8)
      .map((item) =>
        `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`
      )
      .join('\n\n');

    const prompt = `
You are the Wellness Assistant inside Creator Connect.

Help the creator organise their tasks, schedule, content workload and personal time.

Use the following current application information when answering:

${buildAIContext()}

CONVERSATION:
${conversation}

INSTRUCTIONS:
- Answer the user's latest question directly.
- Use the available tasks and events when relevant.
- Be practical, supportive and concise.
- Do not invent information about the user's schedule.
- Do not claim to have changed or saved anything in the application.
- If the user asks to add or change a task, explain that they must use the planner controls.
- Encourage a manageable workload and reasonable breaks.
`;

    try {
      const result = await requestAI(prompt);

      setChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: result,
        },
      ]);
    } catch (aiError) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: `I couldn't get a response from the AI assistant: ${aiError.message}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // =========================================
  // WEEKLY TASKS
  // =========================================

  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);

    const dateKey = getDateKey(date);

    return {
      name: weekdays[date.getDay()],
      date: date.getDate(),
      dateKey,
      isToday: dateKey === todayKey,
      tasks: tasks.filter(
        (task) => task.task_date === dateKey
      ),
    };
  });

  // =========================================
  // AI PLAN SAVEABLE ITEMS
  // =========================================

  const saveableScheduleItems = (aiPlan?.schedule || [])
    .map(cleanScheduleItem)
    .filter(Boolean);

  const saveablePriorityTasks = (aiPlan?.priority_tasks || [])
    .map(cleanPlanTask)
    .filter(Boolean);

  const hasSaveableItems =
    saveableScheduleItems.length > 0 ||
    saveablePriorityTasks.length > 0;

  // =========================================
  // MAIN UI
  // =========================================

  return (
    <div className="wellness-page">

      {/* HEADER */}

      <header className="wellness-header">
        <div>
          <span className="wellness-eyebrow">
            CREATOR CONNECT / WELLNESS
          </span>

          <h1>Your Wellness Centre</h1>

          <p>
            Organise your time, manage your workload and make
            space for yourself.
          </p>
        </div>

        <button
          type="button"
          className="generate-plan-btn"
          onClick={() => generatePlan(activeView)}
          disabled={aiPlanLoading}
        >
          {aiPlanLoading
            ? 'Generating...'
            : `✦ Generate ${activeView === 'weekly' ? 'Weekly' : 'Daily'} Plan`}
        </button>
      </header>

      {/* ERROR */}

      {error && (
        <div className="wellness-notice wellness-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* AI ERROR */}

      {aiPlanError && (
        <div className="wellness-notice wellness-error" role="alert">
          <span>{aiPlanError}</span>

          <button
            type="button"
            onClick={() => setAiPlanError('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* NOTICE */}

      {notice && (
        <div className="wellness-notice">
          <span>{notice}</span>

          <button
            type="button"
            onClick={() => setNotice('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* WELCOME */}

      <section className="wellness-welcome">
        <div>
          <span className="wellness-date">
            {formatDate(today)}
          </span>

          <h2>Make today count.</h2>

          <p>
            Small, consistent steps can make your creative
            journey more manageable.
          </p>
        </div>

        <div className="wellness-day-icon">☀</div>
      </section>

      {/* OVERVIEW */}

      <section className="wellness-overview">

        <div className="wellness-stat-card">
          <span className="stat-icon">✓</span>

          <div>
            <p>Tasks completed today</p>

            <h3>
              {loading
                ? '...'
                : `${completedTasks}/${todaysTasks.length}`}
            </h3>
          </div>
        </div>

        <div className="wellness-stat-card">
          <span className="stat-icon">◷</span>

          <div>
            <p>Daily progress</p>
            <h3>{loading ? '...' : `${progress}%`}</h3>
          </div>
        </div>

        <div className="wellness-stat-card">
          <span className="stat-icon">✦</span>

          <div>
            <p>Upcoming events</p>
            <h3>{loading ? '...' : events.length}</h3>
          </div>
        </div>

      </section>

      {/* AI GENERATED PLAN */}

      {(aiPlan || aiPlanLoading) && (
        <section className="wellness-panel wellness-ai-plan">

          <div className="wellness-panel-header">
            <div>
              <span className="wellness-eyebrow">
                AUTO SCIENTIST · AI INSIGHTS
              </span>

              <h2>
                Your {aiPlanMode === 'weekly' ? 'Weekly' : 'Daily'} Plan
              </h2>

              <p>
                Review the suggestions before adding anything to your planner.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAiPlan(null)}
              disabled={aiPlanSaving}
              aria-label="Close AI plan"
            >
              ✕
            </button>
          </div>

          {aiPlanLoading ? (
            <div className="wellness-empty">
              <p>Preparing your personalised plan...</p>

              <small>
                Reviewing your tasks and upcoming schedule.
              </small>
            </div>
          ) : aiPlan?.structured ? (

            <div className="wellness-ai-plan-content">

              <div className="ai-plan-overview">
                <h3>Overview</h3>

                <p>
                  {aiPlan.overview ||
                    'Your suggested plan is ready for review.'}
                </p>
              </div>

              {/* PRIORITY TASKS */}

              <div className="ai-plan-section">
                <h3>Priority Tasks</h3>

                {aiPlan.priority_tasks.length === 0 ? (
                  <p className="wellness-empty">
                    No additional priority tasks suggested.
                  </p>
                ) : (
                  <div className="ai-plan-items">
                    {aiPlan.priority_tasks.map((task, index) => (
                      <div
                        className="ai-plan-item"
                        key={`priority-${index}`}
                      >
                        <div>
                          <strong>{task.title}</strong>

                          {task.description && (
                            <p>{task.description}</p>
                          )}

                          {task.task_date && (
                            <small>
                              Task date: {task.task_date}
                            </small>
                          )}
                        </div>

                        <span>Task</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SUGGESTED SCHEDULE */}

              <div className="ai-plan-section">
                <h3>Suggested Schedule</h3>

                {aiPlan.schedule.length === 0 ? (
                  <p className="wellness-empty">
                    No additional schedule blocks suggested.
                  </p>
                ) : (
                  <div className="ai-plan-items">
                    {aiPlan.schedule.map((item, index) => (
                      <div
                        className="ai-plan-item"
                        key={`schedule-${index}`}
                      >
                        <div>
                          <strong>{item.title}</strong>

                          {item.description && (
                            <p>{item.description}</p>
                          )}

                          <small>
                            {formatPlanTime(item.start_time)}

                            {item.end_time
                              ? ` – ${new Date(item.end_time).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}`
                              : ''}
                          </small>
                        </div>

                        <span>
                          {item.event_type || 'reminder'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* BREAKS */}

              {aiPlan.breaks.length > 0 && (
                <div className="ai-plan-section">
                  <h3>Breaks and Personal Time</h3>

                  <ul>
                    {aiPlan.breaks.map((item, index) => (
                      <li key={`break-${index}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* SUGGESTIONS */}

              {aiPlan.suggestions.length > 0 && (
                <div className="ai-plan-section">
                  <h3>Helpful Suggestions</h3>

                  <ul>
                    {aiPlan.suggestions.map((item, index) => (
                      <li key={`suggestion-${index}`}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* CONFIRMATION */}

              <div className="ai-plan-actions">

                <button
                  type="button"
                  className="ai-generate-btn"
                  onClick={confirmAIPlan}
                  disabled={aiPlanSaving || !hasSaveableItems}
                >
                  {aiPlanSaving
                    ? 'Saving plan...'
                    : '✓ Confirm & Add to Planner'}
                </button>

                <button
                  type="button"
                  className="ai-plan-discard-btn"
                  onClick={() => setAiPlan(null)}
                  disabled={aiPlanSaving}
                >
                  Discard Plan
                </button>

              </div>

              {!hasSaveableItems && (
                <small className="ai-plan-disclaimer">
                  There are no new dated tasks or timed schedule items
                  to save in this plan.
                </small>
              )}

              <small className="ai-plan-disclaimer">
                Nothing is saved until you confirm. Review suggested dates
                and times before adding them.
              </small>

            </div>

          ) : (

            /* MARKDOWN FALLBACK */

            <div className="wellness-ai-plan-content">

              <ReactMarkdown>
                {aiPlan?.raw || ''}
              </ReactMarkdown>

              <div className="ai-plan-actions">

                {hasSaveableItems ? (
                  <button
                    type="button"
                    className="ai-generate-btn"
                    onClick={confirmAIPlan}
                    disabled={aiPlanSaving}
                  >
                    {aiPlanSaving
                      ? 'Saving plan...'
                      : '✓ Confirm & Add to Planner'}
                  </button>
                ) : (
                  <p className="wellness-empty">
                    This plan contains no new dated tasks or timed
                    schedule items to save. Existing scheduled content
                    and collaborations are already in your planner.
                  </p>
                )}

                <button
                  type="button"
                  className="ai-plan-discard-btn"
                  onClick={() => setAiPlan(null)}
                  disabled={aiPlanSaving}
                >
                  Close Plan
                </button>

              </div>

              <small className="ai-plan-disclaimer">
                Only explicitly dated tasks and schedule items with
                valid start and end times can be saved.
              </small>

            </div>
          )}

        </section>
      )}

      {/* MAIN GRID */}

      <div className="wellness-main-grid">

        <div className="wellness-primary">

          {/* TASK PLANNER */}

          <section className="wellness-panel">

            <div className="wellness-panel-header">
              <div>
                <span className="wellness-eyebrow">
                  YOUR SCHEDULE
                </span>

                <h2>My Planner</h2>
              </div>

              <div className="planner-view-switch">
                <button
                  type="button"
                  className={activeView === 'daily' ? 'selected' : ''}
                  onClick={() => setActiveView('daily')}
                >
                  Daily
                </button>

                <button
                  type="button"
                  className={activeView === 'weekly' ? 'selected' : ''}
                  onClick={() => setActiveView('weekly')}
                >
                  Weekly
                </button>
              </div>
            </div>

            {loading ? (
              <div className="wellness-empty">
                Loading your planner...
              </div>
            ) : activeView === 'daily' ? (

              <div className="daily-view">

                <div className="daily-progress-heading">
                  <span>Today's progress</span>
                  <strong>{progress}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="task-list-header">
                  <h3>Today's Tasks</h3>

                  <button
                    type="button"
                    className="add-task-btn"
                    onClick={() => setShowTaskInput(!showTaskInput)}
                  >
                    + Add Task
                  </button>
                </div>

                {showTaskInput && (
                  <form
                    className="wellness-task-form"
                    onSubmit={addTask}
                  >
                    <input
                      type="text"
                      placeholder="Enter a task..."
                      value={newTask}
                      onChange={(event) => setNewTask(event.target.value)}
                      autoFocus
                    />

                    <button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Add'}
                    </button>
                  </form>
                )}

                <div className="wellness-task-list">

                  {todaysTasks.length === 0 ? (
                    <p className="wellness-empty">
                      No tasks for today. Add your first task.
                    </p>
                  ) : (
                    todaysTasks.map((task) => (
                      <div
                        className={`wellness-task ${
                          task.completed ? 'task-completed' : ''
                        }`}
                        key={task.id}
                      >
                        <button
                          type="button"
                          className={`task-checkbox ${
                            task.completed ? 'checked' : ''
                          }`}
                          onClick={() => toggleTask(task)}
                          aria-label={`Mark ${task.title} ${
                            task.completed ? 'incomplete' : 'complete'
                          }`}
                        >
                          {task.completed ? '✓' : ''}
                        </button>

                        <div className="task-information">
                          <strong>{task.title}</strong>

                          <span>
                            {task.description || 'Personal task'}
                          </span>
                        </div>

                        <span className="task-state">
                          {task.completed ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                    ))
                  )}

                </div>
              </div>

            ) : (

              <div className="weekly-view">

                <div className="weekly-days">
                  {weekDays.map((day) => (
                    <div
                      className={`weekly-day ${
                        day.isToday ? 'current-day' : ''
                      }`}
                      key={day.dateKey}
                    >
                      <span>{day.name}</span>
                      <strong>{day.date}</strong>

                      <small>
                        {day.tasks.length}{' '}
                        {day.tasks.length === 1 ? 'task' : 'tasks'}
                      </small>

                      {day.isToday && <small>Today</small>}
                    </div>
                  ))}
                </div>

                <div className="weekly-task-details">
                  <h3>This week's tasks</h3>

                  {weekDays.map((day) =>
                    day.tasks.length > 0 ? (
                      <div
                        className="weekly-task-day"
                        key={day.dateKey}
                      >
                        <strong>
                          {day.name}, {day.date}
                        </strong>

                        {day.tasks.map((task) => (
                          <p key={task.id}>
                            {task.completed ? '✓' : '○'} {task.title}
                          </p>
                        ))}
                      </div>
                    ) : null
                  )}

                  {!weekDays.some((day) => day.tasks.length > 0) && (
                    <p className="wellness-empty">
                      No tasks scheduled this week.
                    </p>
                  )}
                </div>

              </div>
            )}

          </section>

          {/* UPCOMING REMINDERS */}

          <section className="wellness-panel reminders-panel">

            <div className="wellness-panel-header">
              <div>
                <span className="wellness-eyebrow">
                  STAY ORGANISED
                </span>

                <h2>Upcoming Reminders</h2>
              </div>
            </div>

            <div className="reminder-source-legend">
              <span>📝 Scheduled content</span>
              <span>🤝 Confirmed collaboration</span>
              <span>◷ Planner events</span>
            </div>

            {loading ? (
              <p className="wellness-empty">
                Loading reminders...
              </p>
            ) : events.length === 0 ? (
              <div className="reminder-empty">
                <span>◷</span>

                <h3>No upcoming reminders</h3>

                <p>
                  Your scheduled content, confirmed collaborations
                  and planner events will appear here.
                </p>
              </div>
            ) : (
              <div className="wellness-reminder-list">

                {events.map((event) => (
                  <div
                    className="wellness-reminder"
                    key={event.id}
                  >
                    <span className="reminder-icon">
                      {event.event_type === 'collaboration'
                        ? '🤝'
                        : event.event_type === 'content'
                          ? '📝'
                          : '◷'}
                    </span>

                    <div>
                      <strong>{event.title}</strong>

                      <p>{formatEventDate(event.start_time)}</p>

                      <small>{event.source}</small>

                      {event.description && (
                        <p>{event.description}</p>
                      )}
                    </div>
                  </div>
                ))}

              </div>
            )}

          </section>

        </div>

        {/* AI ASSISTANT */}

        <aside className="wellness-sidebar">

          <section className="ai-wellness-card">

            <div className="ai-card-heading">
              <span className="ai-symbol">✦</span>
              <span>AUTO SCIENTIST POWERED</span>
            </div>

            <h2>Your Wellness Assistant</h2>

            <p>
              Your AI assistant can help organise your creative
              workload and maintain a balanced routine.
            </p>

            <div className="ai-capability-list">
              <div>
                <span>✦</span>
                Daily plan generation
              </div>

              <div>
                <span>✦</span>
                Weekly schedule suggestions
              </div>

              <div>
                <span>✦</span>
                Workload management
              </div>

              <div>
                <span>✦</span>
                Personal task recommendations
              </div>
            </div>

            <div className="ai-status">
              <span className="status-dot" />
              AI connected
            </div>

            <button
              type="button"
              className="ai-generate-btn"
              onClick={() => generatePlan(activeView)}
              disabled={aiPlanLoading}
            >
              {aiPlanLoading ? 'Generating...' : 'Generate My Plan'}
              <span>→</span>
            </button>

          </section>

          {/* AI CHAT */}

          <section className="assistant-chat-card">

            <span className="wellness-eyebrow">
              ASK YOUR ASSISTANT
            </span>

            <h3>Need help organising your day?</h3>

            <p>
              Ask about your tasks, upcoming schedule or workload.
            </p>

            <div className="wellness-chat-messages">

              {chatMessages.length === 0 ? (
                <div className="wellness-chat-empty">
                  <span>✦</span>

                  <p>
                    Your assistant is ready. Ask a question to get started.
                  </p>
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    className={`wellness-chat-message ${
                      message.role === 'user'
                        ? 'user-message'
                        : 'ai-message'
                    }`}
                    key={`${message.role}-${index}`}
                  >
                    <span>
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>

                    {message.role === 'assistant' ? (
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="wellness-chat-loading">
                  Assistant is thinking...
                </div>
              )}

            </div>

            <form
              className="wellness-chat-form"
              onSubmit={handleAssistantSubmit}
            >
              <input
                type="text"
                placeholder="Ask your assistant..."
                value={assistantMessage}
                onChange={(event) =>
                  setAssistantMessage(event.target.value)
                }
                disabled={chatLoading}
                aria-label="AI assistant message"
              />

              <button
                type="submit"
                disabled={chatLoading || !assistantMessage.trim()}
                aria-label="Send message"
              >
                →
              </button>
            </form>

            <small>
              AI suggestions are not automatically saved to your planner.
            </small>

          </section>

        </aside>
      </div>

      {/* FOOTER */}

      <footer className="wellness-footer">
        <p>Creator Connect · Grow Together</p>
        <span>Take it one step at a time.</span>
      </footer>

    </div>
  );
}