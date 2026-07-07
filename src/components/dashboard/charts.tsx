"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, RadialBarChart, RadialBar,
} from "recharts";

const C = (n: number) => `hsl(var(--chart-${n}))`;
const SERIES = [C(1), C(2), C(3), C(4), C(5)];

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
  },
};

export function CompletionTrend({ data }: { data: { date: string; completed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="completed" name="Tasks completed" stroke={C(1)} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WorkloadBars({ data }: { data: { name: string; tasks: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="tasks" name="Open tasks" radius={[4, 4, 0, 0]} fill={C(1)} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPie({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DepartmentPerformance({ data }: { data: { department: string; done: number; open: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis type="category" dataKey="department" width={90} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="done" name="Done" stackId="a" fill={C(2)} radius={[0, 0, 0, 0]} />
        <Bar dataKey="open" name="Open" stackId="a" fill={C(3)} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function UtilizationGauge({ pct }: { pct: number }) {
  const data = [{ name: "Utilization", value: Math.min(pct, 100), fill: pct > 90 ? C(3) : C(2) }];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={210} endAngle={-30}>
        <RadialBar background dataKey="value" cornerRadius={8} />
        <text x="50%" y="55%" textAnchor="middle" className="tabular" fontSize={28} fill="hsl(var(--foreground))" fontWeight={700}>
          {pct}%
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
