// "3 of 6 present +1 extra": expected athletes, plus anyone checked in from outside the roster.
export const presentLabel = (s) => {
  const of = s.assignedAthletes?.length || s.totalCount;
  return `${s.presentCount} of ${of} present${s.extraCount ? ` +${s.extraCount} extra` : ''}`;
};

export const rosterLabel = (ids) => (ids?.length ? `${ids.length} expected` : 'Everyone expected');
