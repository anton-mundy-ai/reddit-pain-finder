import { Link } from 'react-router-dom';
import { Opportunity } from '../types';
import ScoreBar from './ScoreBar';

export default function OpportunityCard({ opportunity, rank }: { opportunity: Opportunity; rank: number }) {
  const summary = opportunity.brief_summary || opportunity.centroid_text;
  return (
    <Link to={`/opportunity/${opportunity.id}`}
          className="block opportunity-card bg-dark-700 rounded-xl p-6 border border-dark-600 hover:border-indigo-500/50">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg">
          #{rank}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{summary}</h3>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
            <span>👥 {opportunity.unique_authors} authors</span>
            <span>💬 {opportunity.member_count} mentions</span>
            <span>📁 {opportunity.subreddit_count} subreddits</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ScoreBar label="Economic" score={opportunity.economic_score || 0} />
            <ScoreBar label="Severity" score={opportunity.severity_score || 0} />
            <ScoreBar label="Solvability" score={opportunity.solvability_score || 0} />
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-3xl font-bold text-white">{Math.round(opportunity.total_score || 0)}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider">Score</div>
        </div>
      </div>
    </Link>
  );
}
