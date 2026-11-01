import React from 'react';

// Shared Recharts styling for the dark canvas: hairline grid, muted ticks, charcoal tooltip.
export const AXIS = {
  stroke: '#262626',
  tickLine: false,
  axisLine: false,
  tick: { fill: '#999999', fontSize: 12 }
};

export const GRID = { stroke: '#1f1f1f', vertical: false };

export const ChartTooltip = ({ active, payload, render }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] shadow-float">
      {render(payload[0].payload)}
    </div>
  );
};

export const ChartFrame = ({ height = 'h-56', children, label }) => (
  <div className={`${height} w-full`} role="img" aria-label={label}>
    {children}
  </div>
);
