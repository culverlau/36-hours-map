import ArticleCard from './ArticleCard';
import './LocationPopup.css';

function LocationPopup({ location }) {
  const { name, region, articles } = location;
  const hasMultiple = articles.length > 1;

  return (
    <div className="popup-content">
      <div className="popup-header">
        <h3 className="popup-title">{name}</h3>
        <span className="popup-region">{region}</span>
      </div>

      {hasMultiple && (
        <p className="popup-count">
          {articles.length} articles about this destination
        </p>
      )}

      <div className="popup-articles">
        {articles.map((article, index) => (
          <ArticleCard
            key={article.nytId}
            article={article}
            isFirst={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export default LocationPopup;
