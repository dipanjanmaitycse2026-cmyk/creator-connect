
import { useNavigate } from 'react-router-dom';
import './CollaborationHub.css';

const collaborationOptions = [
  {
    icon: '♡',
    title: 'One-to-One Collaboration',
    description: 'Connect and work with another creator.',
    status: 'Available',
    path: '/collaboration/one-to-one',
    active: true,
  },
  {
    icon: '👥',
    title: 'Group Collaboration',
    description: 'Create projects and work with multiple creators.',
    status: 'Coming Soon',
    path: '/collaboration/group',
    active: false,
  },
  {
    icon: '🏆',
    title: 'Bounty Board',
    description: 'Explore creator opportunities and collaboration tasks.',
    status: 'Coming Soon',
    path: '/collaboration/bounty-board',
    active: false,
  },
];

export default function CollaborationHub() {
  const navigate = useNavigate();

  return (
    <div className="collab-hub-page">
      <header className="collab-hub-header">
        <button
          className="collab-hub-back"
          onClick={() => navigate('/dashboard')}
        >
          ← Dashboard
        </button>

        <span className="collab-hub-eyebrow">COLLABNEST</span>
        <h1>Collaboration Hub</h1>
        <p>
          Great things happen when creators work together.
          Choose your collaboration style to get started.
        </p>
      </header>

      <main className="collab-options">
        {collaborationOptions.map((option) => (
          <button
            key={option.path}
            className={`collab-option-card ${
              option.active ? 'collab-option-active' : ''
            }`}
            onClick={() => navigate(option.path)}
          >
            <div className="collab-option-top">
              <span className="collab-option-icon">{option.icon}</span>
              <span
                className={`collab-option-status ${
                  option.active ? 'status-available' : ''
                }`}
              >
                {option.status}
              </span>
            </div>

            <h2>{option.title}</h2>
            <p>{option.description}</p>

            <span className="collab-option-arrow">
              Open page →
            </span>
          </button>
        ))}
      </main>
    </div>
  );
}
