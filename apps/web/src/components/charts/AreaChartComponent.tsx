import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface AreaChartData {
  name: string;
  value: number;
}

export interface AreaChartComponentProps {
  data: AreaChartData[];
  dataKey?: string;
  nameKey?: string;
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}

function CustomTooltip({
  active,
  payload,
  valueFormatter,
}: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];

  return (
    <div className="bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm">
      <p className="text-sm font-medium text-gray-900">{data.payload.name}</p>
      <p className="text-sm text-gray-600">
        {valueFormatter
          ? valueFormatter(data.value)
          : data.value}
      </p>
    </div>
  );
}

export function AreaChartComponent({
  data,
  dataKey = 'value',
  nameKey = 'name',
  color = '#FF7300',
  height = 300,
  valueFormatter,
}: AreaChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={nameKey}
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
        />
        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
        <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
