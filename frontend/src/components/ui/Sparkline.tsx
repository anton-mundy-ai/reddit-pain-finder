// Sparkline chart component
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
  className?: string;
}

export function Sparkline({ 
  data, 
  width = 100, 
  height = 30,
  color,
  showArea = false,
  showDots = false,
  className = '',
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <span className="text-gray-500 text-xs">No data</span>;
  }
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return { x, y };
  });
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  
  // Determine color based on trend if not specified
  const first = data[0] || 0;
  const last = data[data.length - 1] || 0;
  const trendColor = color || (last > first ? '#22c55e' : last < first ? '#ef4444' : '#6b7280');
  
  return (
    <svg width={width} height={height} className={`inline-block ${className}`}>
      {showArea && (
        <path
          d={areaPath}
          fill={trendColor}
          fillOpacity={0.1}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={trendColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={2}
          fill={trendColor}
        />
      ))}
    </svg>
  );
}

// Mini bar chart
export function MiniBarChart({
  data,
  width = 100,
  height = 30,
  color = '#8b5cf6',
  className = '',
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (!data || data.length === 0) {
    return <span className="text-gray-500 text-xs">No data</span>;
  }
  
  const max = Math.max(...data, 1);
  const barWidth = width / data.length - 2;
  
  return (
    <svg width={width} height={height} className={`inline-block ${className}`}>
      {data.map((value, i) => {
        const barHeight = (value / max) * (height - 2);
        const x = i * (barWidth + 2) + 1;
        const y = height - barHeight - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill={color}
            rx={1}
            opacity={0.7 + (value / max) * 0.3}
          />
        );
      })}
    </svg>
  );
}

// Progress ring
export function ProgressRing({
  value,
  max = 100,
  size = 40,
  strokeWidth = 4,
  color = '#8b5cf6',
  bgColor = '#1f1f30',
  showValue = true,
  className = '',
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  showValue?: boolean;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percent = Math.min(value / max, 1);
  const offset = circumference - percent * circumference;
  
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showValue && (
        <span className="absolute text-xs font-medium text-white">
          {Math.round(percent * 100)}%
        </span>
      )}
    </div>
  );
}

export default Sparkline;
