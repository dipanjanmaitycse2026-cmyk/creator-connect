
import { useNavigate } from 'react-router-dom';
import './ComingSoon.css';

export default function ComingSoon({ title }) {
  const navigate = useNavigate();

  return (
    <div className="coming-soon-page">
      <div className="coming-soon-card">
        <div className="coming-soon-icon">✦</div>

        <span className="coming-soon-label">
          COLLABNEST
        </span>

        <h1>{title}</h1>

        <p>
          This feature will be available soon.
          We're working on something exciting!
        </p>

        <button
          className="coming-soon-back"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

