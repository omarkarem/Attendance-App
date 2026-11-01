// ADMIN_EMAILS (comma-separated) names the accounts that are always admins and always
// active. It bootstraps the first admin; further admins can be promoted in the app.
const adminEmails = () => (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const isBootstrapAdmin = (email) => !!email && adminEmails().includes(email.toLowerCase());

// Promotes and activates a bootstrap admin. Returns true when the user was changed.
const syncBootstrapAdmin = async (user) => {
  if (!isBootstrapAdmin(user.email) || (user.role === 'admin' && user.status === 'active')) return false;
  user.role = 'admin';
  user.status = 'active';
  user.statusChangedAt = new Date();
  await user.save();
  return true;
};

// The user as the client sees it.
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status
});

module.exports = { isBootstrapAdmin, syncBootstrapAdmin, publicUser };
