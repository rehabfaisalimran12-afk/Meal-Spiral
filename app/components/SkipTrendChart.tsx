'use client';

import type { SkipLog } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SkipTrendChartProps {
  logs: SkipLog[];
  isLoading: boolean;
}

interface DayBucket {
  date: string;
  skips: number;
}

function buildChartData(logs: SkipLog[]): DayBucket[] {
  if (logs.length === 0) return [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - 13);
  const countByDate: Record<string, number> = {};
  for (const log of logs) {
    const day = log.created_at.slice(0, 10);
    countByDate[day] = (countByDate[day] ?? 0) + 1;
  }
  const buckets: DayBucket[] = [];
  const cursor = new Date(windowStart);
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  while (cursor <= today) {
    const iso = cursor.toISOString().slice(0, 10);
    const label = DAY_NAMES[cursor.getUTCDay()] + ' ' + cursor.getUTCDate();
    buckets.push({ date: label, skips: countByDate[iso] ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

export default function SkipTrendChart({ logs, isLoading }: SkipTrendChartProps) {
  if (isLoading) {
    return (
      <section aria-labelledby='trend-chart-heading'>
        <h2 id='trend-chart-heading' className='mb-3 text-lg font-semibold text-gray-800'>
          Skip Trend
        </h2>
        <div
          role='status'
          aria-live='polite'
          className='flex h-40 items-center justify-center rounded-lg border border-gray-100 bg-white text-sm text-gray-500'
        >
          Loading chart…
        </div>
      </section>
    );
  }

  const data = buildChartData(logs);

  if (data.length === 0) {
    return (
      <section aria-labelledby='trend-chart-heading'>
        <h2 id='trend-chart-heading' className='mb-3 text-lg font-semibold text-gray-800'>
          Skip Trend
        </h2>
        <p className='text-sm text-gray-500'>No data yet to chart.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby='trend-chart-heading'>
      <h2 id='trend-chart-heading' className='mb-3 text-lg font-semibold text-gray-800'>
        Skip Trend
      </h2>
      <div className='rounded-lg border border-gray-100 bg-white p-4 shadow-sm'>
        <ResponsiveContainer width='100%' height={180}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' vertical={false} stroke='#f0f0f0' />
            <XAxis
              dataKey='date'
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#f9fafb' }}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e5e7eb' }}
              formatter={(value: number | undefined) => [value ?? 0, 'skips']}
            />
            <Bar dataKey='skips' fill='#818cf8' radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
