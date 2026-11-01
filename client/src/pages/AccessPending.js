import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiArrowClockwise, PiSignOut, PiHourglassMedium, PiProhibit } from 'react-icons/pi';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { apiError } from '../utils/browser';

const POLL_MS = 30000;

/** Shown instead of the app to accounts an admin has not given access to, or has revoked. */
const AccessPending = () => {
  const { user, refreshUser, logout } = useAuth();
  const revoked = user?.status === 'revoked';
  usePageTitle(revoked ? 'Access revoked' : 'Waiting for access');
  const [checking, setChecking] = useState(false);

  // Look again now and then, so the app opens by itself once access is granted.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUser().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refreshUser]);

  const check = async () => {
    setChecking(true);
    try {
      const next = await refreshUser();
      if (next.status !== 'active') toast(revoked ? 'Access is still revoked' : 'No access yet. An admin still needs to approve you.');
    } catch (err) {
      toast.error(apiError(err, 'Could not check. Try again.'));
    } finally {
      setChecking(false);
    }
  };

  const Icon = revoked ? PiProhibit : PiHourglassMedium;

  return (
    <AuthLayout
      title={revoked ? 'Access revoked' : 'Waiting for access'}
      subtitle={revoked
        ? 'An admin has removed your access to AttendTrack. Your athletes and records are kept, and come back if access is restored.'
        : `Thanks${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. An admin needs to approve your account before you can use AttendTrack.`}
      footer={<>Signed in as <span className="text-ink">{user?.email}</span></>}
    >
      <div className="flex items-start gap-3 rounded-lg bg-surface-1 p-4">
        <span className={revoked
          ? 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger'
          : 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent'}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-[14px] text-muted">
          {revoked
            ? 'Contact your admin if you think this is a mistake.'
            : 'This page opens the app by itself once you are approved. You can also check now.'}
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button icon={PiArrowClockwise} size="lg" loading={checking} onClick={check} className="w-full sm:flex-1">
          Check again
        </Button>
        <Button icon={PiSignOut} variant="secondary" size="lg" onClick={logout} className="w-full sm:flex-1">
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
};

export default AccessPending;
