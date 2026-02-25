import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface BarChartData {
  name: string;
  value: number;
}

export interface BarChartComponentProps {
  data: BarChartData[];
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

export function BarChartComponent({
  data,
  dataKey = 'value',
  nameKey = 'name',
  color = '#FF7300',
  height = 300,
  valueFormatter,
}: BarChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={nameKey}
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
        />
        <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
        <Tooltip content={<CustomTooltip valueFormatter={valueFormatter} />} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
