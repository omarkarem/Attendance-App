const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const TeamRequest = require('../models/TeamRequest');
const Athlete = require('../models/Athlete');
const Session = require('../models/Session');
const auth = require('../middleware/auth');
const { DATA_ACCESS, accessOf, brief } = require('../utils/team');
const { clientToday, monthRange } = require('../utils/dates');

const router = express.Router();

// Team management always acts as the signed-in account, never as an opened one.
router.use(auth.self);

const requestView = (r, me) => ({
  _id: r._id,
  // invite: the head asked the coach to join. join: the coach asked to join the head.
  type: r.initiatedBy.equals(r.head._id) ? 'invite' : 'join',
  incoming: !r.initiatedBy.equals(me._id),
  head: brief(r.head),
  member: brief(r.member),
  createdAt: r.createdAt
});

// Why `member` cannot go under `head`, from the point of view of `me`; null when it can.
const joinProblem = async (head, member, me) => {
  const you = (u, yours, theirs) => (u._id.equals(me._id) ? yours : theirs);
  if (head._id.equals(member._id)) return 'You cannot add yourself.';
  if (head.status !== 'active' || member.status !== 'active') return 'That account does not have access to AttendTrack yet.';
  if (member.headCoach) {
    return member.headCoach.equals(head._id)
      ? 'This coach is already on the team.'
      : you(member, 'You already coach under a head coach. Leave that team first.', `${member.name} already coaches under another head coach.`);
  }
  if (await User.exists({ headCoach: member._id })) {
    return you(member, 'You have coaches under you, so you cannot join another team.', `${member.name} has coaches under them, so they cannot join a team.`);
  }
  if (head.headCoach) {
    return you(head, 'You coach under a head coach, so you cannot have coaches under you.', `${head.name} coaches under someone else, so they cannot take coaches.`);
  }
  return null;
};

const loadRequest = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Request not found.' });
    return null;
  }
  const r = await TeamRequest.findOne({
    _id: req.params.id,
    status: 'pending',
    $or: [{ head: req.authUser._id }, { member: req.authUser._id }]
  }).populate('head member', 'name email status headCoach');
  if (!r || !r.head || !r.member) {
    res.status(404).json({ message: 'This request is no longer open.' });
    return null;
  }
  return r;
};

const loadMember = async (req, res) => {
  const member = mongoose.isValidObjectId(req.params.id)
    ? await User.findOne({ _id: req.params.id, headCoach: req.authUser._id })
    : null;
  if (!member) res.status(404).json({ message: 'This coach is not on your team.' });
  return member;
};

const leaveTeam = (userId) => User.updateOne(
  { _id: userId },
  { $set: { headCoach: null, teamJoinedAt: null, 'teamAccess.data': 'none', 'teamAccess.finance': false } }
);

// GET /api/team - your head coach or your coaches, plus open requests
router.get('/', async (req, res) => {
  try {
    const me = req.authUser;
    const today = clientToday(req.query.today);
    const [y, m] = today.split('-').map(Number);
    const { start, end } = monthRange(y, m);

    const [head, members, requests] = await Promise.all([
      me.headCoach ? User.findById(me.headCoach).select('name email') : null,
      User.find({ headCoach: me._id }).select('name email status teamAccess teamJoinedAt').sort({ name: 1 }),
      TeamRequest.find({ status: 'pending', $or: [{ head: me._id }, { member: me._id }] })
        .populate('head member', 'name email')
        .sort({ createdAt: -1 })
    ]);

    const ids = members.map((u) => u._id);
    const [athleteRows, sessionRows] = await Promise.all([
      Athlete.aggregate([{ $match: { coach: { $in: ids }, active: true } }, { $group: { _id: '$coach', count: { $sum: 1 } } }]),
      Session.aggregate([{ $match: { coach: { $in: ids }, date: { $gte: start, $lte: end } } }, { $group: { _id: '$coach', count: { $sum: 1 } } }])
    ]);
    const athletes = new Map(athleteRows.map((r) => [String(r._id), r.count]));
    const sessions = new Map(sessionRows.map((r) => [String(r._id), r.count]));

    const open = requests.filter((r) => r.head && r.member).map((r) => requestView(r, me));
    res.json({
      head: head ? brief(head) : null,
      access: accessOf(me),
      members: members.map((u) => ({
        ...brief(u),
        status: u.status,
        access: accessOf(u),
        joinedAt: u.teamJoinedAt,
        athleteCount: athletes.get(String(u._id)) || 0,
        sessionsThisMonth: sessions.get(String(u._id)) || 0
      })),
      incoming: open.filter((r) => r.incoming),
      outgoing: open.filter((r) => !r.incoming)
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load your team.' });
  }
});

// POST /api/team/requests - { email, type: 'invite' | 'join' }
router.post('/requests', async (req, res) => {
  try {
    const me = req.authUser;
    const { type } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!['invite', 'join'].includes(type)) return res.status(400).json({ message: 'Choose whether to invite a coach or join a head coach.' });
    if (!email) return res.status(400).json({ message: 'Enter the email they use for AttendTrack.' });

    const other = await User.findOne({ email });
    if (!other) return res.status(404).json({ message: `No AttendTrack account uses ${email}. Ask them to sign up first.` });

    const head = type === 'invite' ? me : other;
    const member = type === 'invite' ? other : me;
    const problem = await joinProblem(head, member, me);
    if (problem) return res.status(400).json({ message: problem });

    const existing = await TeamRequest.findOne({ head: head._id, member: member._id, status: 'pending' });
    if (existing) {
      return res.status(400).json({
        message: existing.initiatedBy.equals(me._id)
          ? 'You already sent this request. It is waiting for an answer.'
          : `${other.name} already sent you this request. Accept it below.`
      });
    }

    const created = await TeamRequest.create({ head: head._id, member: member._id, initiatedBy: me._id });
    await created.populate('head member', 'name email');
    res.status(201).json(requestView(created, me));
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'This request is already waiting for an answer.' });
    res.status(500).json({ message: 'Could not send the request.' });
  }
});

// POST /api/team/requests/:id/accept - only the side that did not send it
router.post('/requests/:id/accept', async (req, res) => {
  try {
    const me = req.authUser;
    const r = await loadRequest(req, res);
    if (!r) return;
    if (r.initiatedBy.equals(me._id)) return res.status(400).json({ message: 'Wait for the other coach to answer your request.' });

    const problem = await joinProblem(r.head, r.member, me);
    if (problem) return res.status(400).json({ message: problem });

    // Guarded so two accepts at once cannot put a coach in two teams.
    const joined = await User.updateOne(
      { _id: r.member._id, headCoach: null },
      { $set: { headCoach: r.head._id, teamJoinedAt: new Date(), 'teamAccess.data': 'none', 'teamAccess.finance': false } }
    );
    if (joined.modifiedCount === 0) return res.status(400).json({ message: 'This coach just joined another team.' });

    r.status = 'accepted';
    r.respondedAt = new Date();
    await r.save();

    // Requests that no longer make sense: other teams for the member, and the head
    // joining someone else's team now that it has coaches.
    await TeamRequest.updateMany(
      {
        status: 'pending',
        _id: { $ne: r._id },
        $or: [{ member: r.member._id }, { head: r.member._id }, { member: r.head._id }]
      },
      { $set: { status: 'cancelled', respondedAt: new Date() } }
    );

    res.json({ message: `${r.member.name} now coaches under ${r.head.name}.` });
  } catch (error) {
    res.status(500).json({ message: 'Could not accept the request.' });
  }
});

// POST /api/team/requests/:id/decline - the receiver says no; the sender cancels
router.post('/requests/:id/decline', async (req, res) => {
  try {
    const r = await loadRequest(req, res);
    if (!r) return;
    r.status = r.initiatedBy.equals(req.authUser._id) ? 'cancelled' : 'declined';
    r.respondedAt = new Date();
    await r.save();
    res.json({ message: r.status === 'cancelled' ? 'Request cancelled.' : 'Request declined.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not update the request.' });
  }
});

// PATCH /api/team/members/:id - { data?: 'none'|'view'|'edit', finance?: boolean }
router.patch('/members/:id', async (req, res) => {
  try {
    const { data, finance } = req.body;
    if (data !== undefined && !DATA_ACCESS.includes(data)) return res.status(400).json({ message: 'Access must be none, view or edit.' });
    if (finance !== undefined && typeof finance !== 'boolean') return res.status(400).json({ message: 'Finance access must be on or off.' });
    if (data === undefined && finance === undefined) return res.status(400).json({ message: 'Nothing to change.' });

    const member = await loadMember(req, res);
    if (!member) return;
    if (data !== undefined) member.teamAccess.data = data;
    if (finance !== undefined) member.teamAccess.finance = finance;
    await member.save();
    res.json({ ...brief(member), access: accessOf(member) });
  } catch (error) {
    res.status(500).json({ message: 'Could not change access.' });
  }
});

// DELETE /api/team/members/:id - take a coach off your team. Their data stays theirs.
router.delete('/members/:id', async (req, res) => {
  try {
    const member = await loadMember(req, res);
    if (!member) return;
    await leaveTeam(member._id);
    res.json({ message: `${member.name} is no longer on your team.` });
  } catch (error) {
    res.status(500).json({ message: 'Could not remove the coach.' });
  }
});

// POST /api/team/leave - leave your head coach's team
router.post('/leave', async (req, res) => {
  try {
    if (!req.authUser.headCoach) return res.status(400).json({ message: 'You are not on a team.' });
    await leaveTeam(req.authUser._id);
    res.json({ message: 'You left the team.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not leave the team.' });
  }
});

module.exports = router;
