const User = require('../models/User');
const TeamRequest = require('../models/TeamRequest');

// One level only: a head coach has members, a member has a head, never both.
const DATA_ACCESS = ['none', 'view', 'edit'];

const accessOf = (user) => ({
  data: user.teamAccess?.data || 'none',
  finance: !!user.teamAccess?.finance
});

// The account that owns the team's finance data: the head coach, or yourself.
const financeOwnerId = (user) => user.headCoach || user._id;

// Coaches without a head always see their own finance; members only when allowed.
const hasFinanceAccess = (user) => !user.headCoach || accessOf(user).finance;

const brief = (u) => ({ id: u._id, name: u.name, email: u.email });

// The accounts this user may open (act as), with the access level for each.
const workspacesFor = async (user) => {
  const list = [];
  if (user.headCoach) {
    const access = accessOf(user).data;
    if (access !== 'none') {
      const head = await User.findById(user.headCoach).select('name email status');
      if (head && head.status === 'active') list.push({ ...brief(head), relation: 'head', access });
    }
  } else {
    const members = await User.find({ headCoach: user._id, status: 'active' }).select('name email').sort({ name: 1 });
    members.forEach((m) => list.push({ ...brief(m), relation: 'member', access: 'edit' }));
  }
  return list;
};

// The access `user` has to `target`'s data: 'edit', 'view' or null.
const accessTo = (user, target) => {
  if (!target || target.status !== 'active') return null;
  if (target.headCoach && target.headCoach.equals(user._id)) return 'edit';
  if (user.headCoach && user.headCoach.equals(target._id)) {
    const access = accessOf(user).data;
    return access === 'none' ? null : access;
  }
  return null;
};

// Team details for /auth/me.
const teamSummary = async (user) => {
  const [head, memberCount, requestCount, workspaces] = await Promise.all([
    user.headCoach ? User.findById(user.headCoach).select('name email') : null,
    User.countDocuments({ headCoach: user._id }),
    TeamRequest.countDocuments({
      status: 'pending',
      initiatedBy: { $ne: user._id },
      $or: [{ head: user._id }, { member: user._id }]
    }),
    workspacesFor(user)
  ]);
  return {
    headCoach: head ? brief(head) : null,
    teamAccess: accessOf(user),
    memberCount,
    requestCount,
    financeAccess: hasFinanceAccess(user),
    workspaces
  };
};

module.exports = { DATA_ACCESS, accessOf, financeOwnerId, hasFinanceAccess, workspacesFor, accessTo, teamSummary, brief };
