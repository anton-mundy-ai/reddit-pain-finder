const colorMap: Record<string, string> = {
  frequency: 'bg-blue-500', severity: 'bg-red-500', economic: 'bg-green-500',
  solvability: 'bg-purple-500', competitive: 'bg-yellow-500', au_fit: 'bg-cyan-500', default: 'bg-indigo-500'
};

export default function ScoreBar({ label, score, color }: { label: string; score: number; color?: string }) {
  const barColor = color || colorMap[label.toLowerCase().replace(' ', '_')] || colorMap.default;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{Math.round(score)}</span>
      </div>
      <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
        <div className={`h-full score-bar ${barColor} rounded-full`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}
