import './ArticleCard.css';

function ArticleCard({ article, isFirst }) {
  const { title, date, url } = article;

  // Format date nicely
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className={`article-card ${isFirst ? 'article-card--first' : ''}`}>
      <div className="article-info">
        <h4 className="article-title">{title}</h4>
        <time className="article-date" dateTime={date}>
          {formattedDate}
        </time>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="article-cta"
      >
        Read Article
      </a>
    </article>
  );
}

export default ArticleCard;
