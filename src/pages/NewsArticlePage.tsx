import { Link, useParams } from 'react-router-dom';
import { NEWS_ITEMS, formatDate } from '../lib/content';

export default function NewsArticlePage() {
  const { id } = useParams();
  const decoded = decodeURIComponent(id ?? '');
  const item = NEWS_ITEMS.find((entry) => entry.id === decoded);

  if (!item) {
    return (
      <main className="container section reveal in-view">
        <article className="card" style={{ gridColumn: '1 / -1' }}>
          <h1>Article not found</h1>
          <p className="subtitle">The requested article id is unavailable.</p>
          <p><Link to="/news" className="link-arrow">Back to News -&gt;</Link></p>
        </article>
      </main>
    );
  }

  return (
    <main className="container section reveal in-view">
      <article className="card" style={{ gridColumn: '1 / -1' }}>
        <img
          src={item.thumbnail}
          alt={item.title}
          loading="lazy"
          decoding="async"
          className="news-thumb"
        />
        <h1>{item.title}</h1>
        <p className="meta">
          {item.author} • {formatDate(item.date)} • {item.topic}
        </p>
        <p>{item.content}</p>
        <p className="card-actions"><Link to="/news" className="link-arrow">Back to News -&gt;</Link></p>
      </article>
    </main>
  );
}
