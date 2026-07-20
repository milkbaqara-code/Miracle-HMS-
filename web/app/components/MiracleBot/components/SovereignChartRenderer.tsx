'use client';
// ============================================================
// MiracleBot / components / SovereignChartRenderer.tsx
// Parses json_chart code blocks from AI responses and renders
// themed Recharts bar/line/pie graphs inside the chat window.
// V4.0 — Enterprise Refactor (extracted from monolith)
// ============================================================
import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from '../lib/constants';

const tooltipStyle = {
  backgroundColor: 'rgba(4,4,14,0.97)',
  border:          '1px solid rgba(0,242,255,0.3)',
  borderRadius:    8,
  color:           '#00F2FF',
  fontSize:        11,
};

export function SovereignChartRenderer({ raw }: { raw: string }) {
  try {
    const config = JSON.parse(raw.trim());
    const { type = 'bar', title, data = [] } = config;
    if (!data.length) return null;

    return (
      <div style={{
        background:   'linear-gradient(135deg, rgba(0,242,255,0.04) 0%, rgba(157,0,255,0.04) 100%)',
        border:       '1px solid rgba(0,242,255,0.2)',
        borderRadius: 16,
        padding:      '16px 12px 8px',
        marginTop:    10,
        width:        '100%',
      }}>
        {title && (
          <div style={{
            color: '#00F2FF', fontSize: 10, fontWeight: 800,
            letterSpacing: 1.5, textTransform: 'uppercase',
            marginBottom: 12, textAlign: 'center',
          }}>{title}</div>
        )}
        <ResponsiveContainer width="100%" height={180}>
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={data} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={65}
                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#00F2FF" strokeWidth={2} dot={{ fill: '#00F2FF', r: 3 }} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  } catch { return null; }
}
