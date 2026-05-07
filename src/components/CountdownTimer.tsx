import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string;
  eventName: string;
}

export function CountdownTimer({ targetDate, eventName }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  function calculateTimeLeft(target: string) {
    const difference = +new Date(target) - +new Date();
    let timeLeft = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }

    return { difference, timeLeft };
  }

  const { difference, timeLeft: { days, hours, minutes, seconds } } = timeLeft;

  if (difference <= 0) {
    return (
      <Card className="countdown-timer-card shadcn-card-lift">
        <div className="countdown-timer-content">
          <Clock className="countdown-icon" />
          <div className="countdown-text">
            <h3>{eventName} Is Live!</h3>
            <p>The time has come. Join us now!</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="countdown-timer-card shadcn-card-lift">
      <div className="countdown-timer-header">
        <Clock className="countdown-icon pulse-anim" />
        <h3>{eventName}</h3>
      </div>
      <div className="countdown-grid">
        <div className="countdown-item">
          <div className="countdown-value-container">
            <span key={days} className="countdown-value flip-drop">{days}</span>
          </div>
          <span className="countdown-label">Days</span>
        </div>
        <div className="countdown-item">
          <div className="countdown-value-container">
            <span key={hours} className="countdown-value flip-drop">{hours}</span>
          </div>
          <span className="countdown-label">Hours</span>
        </div>
        <div className="countdown-item">
          <div className="countdown-value-container">
            <span key={minutes} className="countdown-value flip-drop">{minutes}</span>
          </div>
          <span className="countdown-label">Minutes</span>
        </div>
        <div className="countdown-item">
          <div className="countdown-value-container">
            <span key={seconds} className="countdown-value flip-drop">{seconds}</span>
          </div>
          <span className="countdown-label">Seconds</span>
        </div>
      </div>
    </Card>
  );
}
