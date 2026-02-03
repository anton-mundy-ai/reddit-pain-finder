import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOpportunity } from '../api';
import { OpportunityDetail, PainRecord } from '../types';
import ScoreBar from '../components/ScoreBar';

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [members, setMembers] = useState<PainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (id) loadOpportunity(parseInt(id)); }, [id]);

  async function loadOpportunity(oppId: number) {
    setLoading(true);
    try {
      const data = await fetchOpportunity(oppId);
      setOpportunity(data.opportunity);
      setMembers(data.members);
    } catch { setError('Failed to load opportunity details.'); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div className="text-center py-16">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
      <p className="mt-4 text-gray-400">Loading opportunity...</p>
    </div>
  );

  if (error || !opportunity) return (
    <div className="text-center py-16">
      <p className="text-xl text-red-400">{error || 'Opportunity not found'}</p>
      <Link to="/" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300">← Back to opportunities</Link>
    </div>
  );

  const { score_breakdown } = opportunity;

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300">← Back to opportunities</Link>

      <div className="bg-dark-700 rounded-xl p-8 border border-dark-600">
        <div className="flex items-start justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-4">{opportunity.summary}</h1>
            <p className="text-gray-400 text-lg">{opportunity.problem_statement}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="text-5xl font-bold text-indigo-400">{Math.round(opportunity.total_score)}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider mt-1">Total Score</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-dark-500">
          <div><div className="text-2xl font-semibold text-white">{opportunity.member_count}</div><div className="text-sm text-gray-400">Pain Points</div></div>
          <div><div className="text-2xl font-semibold text-white">{opportunity.unique_authors}</div><div className="text-sm text-gray-400">Unique Authors</div></div>
          <div><div className="text-2xl font-semibold text-white">{opportunity.subreddits.length}</div><div className="text-sm text-gray-400">Subreddits</div></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {opportunity.subreddits.map(sub => <span key={sub} className="px-3 py-1 bg-dark-600 rounded-full text-sm text-gray-300">r/{sub}</span>)}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
          <h2 className="text-xl font-semibold text-white mb-4">Score Breakdown</h2>
          <div className="space-y-4">
            <ScoreBar label="Economic Value" score={score_breakdown.economic} color="bg-green-500" />
            <ScoreBar label="Solvability" score={score_breakdown.solvability} color="bg-purple-500" />
            <ScoreBar label="Severity" score={score_breakdown.severity} color="bg-red-500" />
            <ScoreBar label="Frequency" score={score_breakdown.frequency} color="bg-blue-500" />
            <ScoreBar label="Competitive Opportunity" score={score_breakdown.competitive} color="bg-yellow-500" />
            <ScoreBar label="Australia Fit" score={score_breakdown.au_fit} color="bg-cyan-500" />
          </div>
        </div>

        <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
          <h2 className="text-xl font-semibold text-white mb-4">Who Has This Problem?</h2>
          {opportunity.personas.length > 0 ? (
            <ul className="space-y-2">{opportunity.personas.map((p, i) => <li key={i} className="flex items-start gap-2 text-gray-300"><span className="text-indigo-400">→</span>{p}</li>)}</ul>
          ) : <p className="text-gray-500">No specific personas identified yet.</p>}
        </div>
      </div>

      {opportunity.workarounds.length > 0 && (
        <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
          <h2 className="text-xl font-semibold text-white mb-4">Current Workarounds</h2>
          <ul className="space-y-2">{opportunity.workarounds.map((w, i) => <li key={i} className="flex items-start gap-2 text-gray-300"><span className="text-yellow-400">⚡</span>{w}</li>)}</ul>
        </div>
      )}

      <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
        <h2 className="text-xl font-semibold text-white mb-4">Voice of the Customer</h2>
        <div className="space-y-4">
          {opportunity.top_quotes.length > 0 ? opportunity.top_quotes.map((q, i) => (
            <blockquote key={i} className="border-l-4 border-indigo-500 pl-4 py-2">
              <p className="text-gray-300 italic">"{q.text}"</p>
              <footer className="mt-2 text-sm text-gray-500">
                — u/{q.author} {q.url && <a href={q.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-400 hover:text-indigo-300">View on Reddit →</a>}
              </footer>
            </blockquote>
          )) : <p className="text-gray-500">No quotes available yet.</p>}
        </div>
      </div>

      {opportunity.open_questions.length > 0 && (
        <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
          <h2 className="text-xl font-semibold text-white mb-4">Open Questions</h2>
          <ul className="space-y-2">{opportunity.open_questions.map((q, i) => <li key={i} className="flex items-start gap-2 text-gray-300"><span className="text-cyan-400">?</span>{q}</li>)}</ul>
        </div>
      )}

      <div className="bg-dark-700 rounded-xl p-6 border border-dark-600">
        <h2 className="text-xl font-semibold text-white mb-4">All Pain Points ({members.length})</h2>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {members.map((m) => (
            <div key={m.id} className="p-4 bg-dark-800 rounded-lg border border-dark-600">
              <p className="text-gray-300">{m.problem_text}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span>r/{m.subreddit}</span>
                {m.persona && <span>• {m.persona}</span>}
                {m.source_url && <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">View source →</a>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
