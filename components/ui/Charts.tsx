import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

// Colors for charts
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#6b7280', // gray-500
];

// Format currency for tooltips
const formatCurrency = (value: number) => {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

// Line Chart Component
interface LineChartProps {
  data: any[];
  lines: {
    key: string;
    name: string;
    color: string;
  }[];
  xAxisKey: string;
  yAxisFormatter?: (value: number) => string;
  height?: number;
}

export const TrendLineChart: React.FC<LineChartProps> = ({
  data,
  lines,
  xAxisKey,
  yAxisFormatter = formatCurrency,
  height = 300,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey={xAxisKey} 
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
          tickFormatter={yAxisFormatter}
        />
        <Tooltip 
          formatter={(value: number) => [yAxisFormatter(value), '']}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        {lines.map((line, index) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={{ r: 4, fill: line.color }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// Area Chart Component
interface AreaChartProps {
  data: any[];
  areas: {
    key: string;
    name: string;
    color: string;
    fillOpacity?: number;
  }[];
  xAxisKey: string;
  yAxisFormatter?: (value: number) => string;
  height?: number;
}

export const TrendAreaChart: React.FC<AreaChartProps> = ({
  data,
  areas,
  xAxisKey,
  yAxisFormatter = formatCurrency,
  height = 300,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          {areas.map((area, index) => (
            <linearGradient key={area.key} id={`color${area.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={area.color} stopOpacity={area.fillOpacity || 0.3} />
              <stop offset="95%" stopColor={area.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey={xAxisKey} 
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
          tickFormatter={yAxisFormatter}
        />
        <Tooltip 
          formatter={(value: number) => [yAxisFormatter(value), '']}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        {areas.map((area) => (
          <Area
            key={area.key}
            type="monotone"
            dataKey={area.key}
            name={area.name}
            stroke={area.color}
            fillOpacity={1}
            fill={`url(#color${area.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// Pie/Donut Chart Component
interface PieChartProps {
  data: {
    name: string;
    value: number;
  }[];
  colors?: string[];
  isDonut?: boolean;
  height?: number;
  showLegend?: boolean;
}

export const DonutPieChart: React.FC<PieChartProps> = ({
  data,
  colors = CHART_COLORS,
  isDonut = true,
  height = 300,
  showLegend = true,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={isDonut ? 60 : 0}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number, name: string) => {
            const percentage = ((value / total) * 100).toFixed(1);
            return [`${formatCurrency(value)} (${percentage}%)`, name];
          }}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        {showLegend && <Legend />}
      </PieChart>
    </ResponsiveContainer>
  );
};

// Bar Chart Component
interface BarChartProps {
  data: any[];
  bars: {
    key: string;
    name: string;
    color: string;
  }[];
  xAxisKey: string;
  yAxisFormatter?: (value: number) => string;
  height?: number;
  horizontal?: boolean;
}

export const SimpleBarChart: React.FC<BarChartProps> = ({
  data,
  bars,
  xAxisKey,
  yAxisFormatter = formatCurrency,
  height = 300,
  horizontal = false,
}) => {
  const ChartComponent = horizontal ? BarChart : BarChart;
  const layout = horizontal ? 'vertical' : 'horizontal';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          type={horizontal ? 'number' : 'category'} 
          dataKey={horizontal ? undefined : xAxisKey}
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
          tickFormatter={horizontal ? yAxisFormatter : undefined}
        />
        <YAxis 
          type={horizontal ? 'category' : 'number'}
          dataKey={horizontal ? xAxisKey : undefined}
          stroke="#6b7280"
          tick={{ fontSize: 12 }}
          tickFormatter={horizontal ? undefined : yAxisFormatter}
          width={horizontal ? 100 : 60}
        />
        <Tooltip 
          formatter={(value: number) => [yAxisFormatter(value), '']}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        {bars.map((bar) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// Sparkline Component (mini chart for stat cards)
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  showArea?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#10b981',
  height = 40,
  showArea = true,
}) => {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showArea && (
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill="url(#sparklineGradient)"
            strokeWidth={2}
          />
        )}
        {!showArea && (
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};
