import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export interface PieChartData {
  name: string;
  value: number;
}

export interface PieChartComponentProps {
  data: PieChartData[];
  colors?: string[];
  height?: number;
  innerRadius?: number;
  valueFormatter?: (value: number) => string;
}

const DEFAULT_COLORS = [
  '#FF7300', // Primary
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

function CustomTooltip({
  active,
  payload,
  valueFormatter,
}: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];

  return (
    <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm">
      <p className="text-sm font-medium text-gray-900">{data.name}</p>
      <p className="text-sm text-gray-600">
        {valueFormatter
          ? valueFormatter(data.value)
          : data.value}
      </p>
    </div>
  );
}

export function PieChartComponent({
  data,
  colors = DEFAULT_COLORS,
  height = 300,
  innerRadius = 0,
  valueFormatter,
}: PieChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data as any}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={100}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
