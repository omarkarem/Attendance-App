import React, { useState } from 'react';
import { PiCalendarDots, PiCheckCircle, PiChartLineUp, PiEye, PiEyeSlash } from 'react-icons/pi';
import { Wordmark } from './AppShell';
import { Spotlight } from '../ui/Display';
import { Input } from '../ui/Form';
import { IconButton } from '../ui/Button';

const POINTS = [
  { icon: PiCalendarDots, text: 'Recurring templates create each day\'s sessions for you.' },
  { icon: PiCheckCircle, text: 'Check athletes in with one tap, right from the pool deck.' },
  { icon: PiChartLineUp, text: 'Track test results and see who is improving.' }
];

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="grid min-h-[100dvh] bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
      <Wordmark />
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 animate-rise">
        <h1 className="font-display text-[34px] font-medium leading-[1.02] tracking-[-0.05em] text-ink md:text-[42px]">{title}</h1>
        <p className="mt-3 text-[15px] text-muted">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-8 text-[14px] text-muted">{footer}</div>
      </div>
    </div>
    <div className="hidden p-4 lg:block">
      <Spotlight tone="violet" className="flex h-full flex-col justify-end p-12">
        <p className="max-w-[14ch] font-display text-[56px] font-medium leading-[0.95] tracking-[-0.055em]">Attendance in one tap.</p>
        <ul className="mt-10 flex max-w-[44ch] flex-col gap-4">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[16px] leading-snug text-white/85">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </Spotlight>
    </div>
  </div>
);

export const PasswordInput = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={(
        <IconButton
          icon={visible ? PiEyeSlash : PiEye}
          label={visible ? 'Hide password' : 'Show password'}
          size="sm"
          onClick={() => setVisible((v) => !v)}
        />
      )}
    />
  );
};

export default AuthLayout;
