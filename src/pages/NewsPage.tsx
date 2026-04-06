import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { NEWS_ITEMS, formatDate } from '../lib/content';
import { assetUrl } from '../lib/asset-url';

export default function NewsPage() {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [days, setDays] = useState('all');
  const [now] = useState(() => Date.now());

  const topics = useMemo(() => ['all', ...Array.from(new Set(NEWS_ITEMS.map((item) => item.topic)))], []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return NEWS_ITEMS.filter((item) => {
      const hitKeyword =
        !keyword || `${item.title} ${item.author} ${item.preview}`.toLowerCase().includes(keyword);
      const hitTopic = topic === 'all' || item.topic === topic;
      const hitDate =
        days === 'all' || (now - new Date(item.date).getTime()) <= Number(days) * 86400000;
      return hitKeyword && hitTopic && hitDate;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [days, now, query, topic]);

  return (
    <main className="container section reveal in-view">
      <h1>Server News</h1>
      <p className="subtitle">A news page for archived and latest news! Filter by topic or date.</p>

      <div className="search-row">
        <input
          id="news-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, author, or keyword"
        />
        <select id="news-topic-filter" value={topic} onChange={(event) => setTopic(event.target.value)}>
          {topics.map((item) => (
            <option key={item} value={item}>
              {item === 'all' ? 'All topics' : item}
            </option>
          ))}
        </select>
        <select id="news-date-filter" value={days} onChange={(event) => setDays(event.target.value)}>
          <option value="all">Any date</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div id="news-list" className="stack">
        {filtered.map((item) => (
          <article key={item.id} className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="two-col">
              <img src={assetUrl(item.thumbnail)} alt={item.title} loading="lazy" decoding="async" className="news-thumb" />
              <div>
                <h3>{item.title}</h3>
                <p className="meta">{item.author} • {formatDate(item.date)} • {item.topic}</p>
                <p>{item.preview}</p>
                <p>
                  <Link to={`/news/${encodeURIComponent(item.id)}`} className="link-arrow">Read article -&gt;</Link>
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
