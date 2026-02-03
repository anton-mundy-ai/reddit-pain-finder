// Score bar component for visualizing scores
interface ScoreBarProps {
  score: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ScoreBar({ 
  score, 
  max = 100, 
  showLabel = true,
  size = 'md',
  className = '' 
}: ScoreBarProps) {
  const percent = Math.min((score / max) * 100, 100);
  
  const getColor = (score: number) => {
    if (score >= 70) return 'from-green-600 to-green-400';
    if (score >= 50) return 'from-blue-600 to-blue-400';
    if (score >= 30) return 'from-yellow-600 to-yellow-400';
    return 'from-gray-600 to-gray-400';
  };
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-dark-600 rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className={`h-full bg-gradient-to-r ${getColor(score)} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold text-gray-300 min-w-[2.5rem] text-right">
          {score}
        </span>
      )}
    </div>
  );
}
