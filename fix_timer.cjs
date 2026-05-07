const fs = require('fs');
let css = fs.readFileSync('src/style.css', 'utf-8');

const newCSS = `/* Countdown Timer Styling */
.countdown-section {
    padding-top: 1rem;
    padding-bottom: 2rem;
    display: flex;
    justify-content: center;
}

.countdown-timer-card {
    width: 100%;
    max-width: 640px;
    padding: 1.75rem 2rem;
    background: linear-gradient(145deg, rgba(25, 35, 55, 0.6) 0%, rgba(15, 20, 30, 0.85) 100%);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(147, 197, 253, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    text-align: center;
    border-radius: 16px;
}

.countdown-timer-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin-bottom: 1.75rem;
}

.countdown-timer-header h3 {
    font-size: 1.45rem;
    font-weight: 800;
    margin: 0;
    background: linear-gradient(to right, #ffffff, #93c5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 2px 10px rgba(147, 197, 253, 0.2);
    letter-spacing: 0.02em;
}

.countdown-icon {
    color: #93c5fd;
    filter: drop-shadow(0 0 8px rgba(147, 197, 253, 0.5));
}

.countdown-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
}

.countdown-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
    padding: 1rem 0.5rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.2);
}

.countdown-label {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
}

@media (max-width: 600px) {
    .countdown-timer-card {
        padding: 1.25rem 1rem;
        border-radius: 12px;
    }
    .countdown-timer-header {
        margin-bottom: 1rem;
        gap: 0.5rem;
    }
    .countdown-timer-header h3 {
        font-size: 1.15rem;
        line-height: 1.2;
    }
    .countdown-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 0.4rem;
    }
    .countdown-item {
        padding: 0.75rem 0.2rem;
        border-radius: 8px;
    }
    .countdown-label {
        font-size: 0.6rem;
        letter-spacing: 0.02em;
    }
    .countdown-value-container {
        min-height: 1.8rem;
        margin-bottom: 0.15rem;
    }
    .countdown-value {
        font-size: 1.6rem;
    }
}
`;

css = css.replace(/\/\* Countdown Timer Styling \*\/[\s\S]*?(?=\/\* Timer Animations \*\/)/, newCSS + '\n');
fs.writeFileSync('src/style.css', css);
