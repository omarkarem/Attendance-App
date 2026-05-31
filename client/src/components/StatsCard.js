import React from 'react';

const StatsCard = ({ icon: Icon, label, value, subtext, color = 'accent' }) => {
  const colorClasses = {
    accent: 'from-accent-500/20 to-accent-600/10 text-accent-400',
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400',
    amber: 'from-amber-500/20 to-amber-600/10 text-amber-400',
  };

  const iconBg = {
    accent: 'bg-accent-500/20 text-accent-400',
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    amber: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
          {Icon && <Icon className="w-5 h-5" />}
        </div>
        {subtext && (
          <span className="text-xs text-dark-400">{subtext}</span>
        )}
      </div>
      <div className="mt-2">
        <p className={`text-2xl font-bold ${colorClasses[color].split(' ').pop()}`}>{value}</p>
        <p className="text-sm text-dark-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
};

export default StatsCard;
