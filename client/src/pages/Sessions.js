import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDays, format, isValid, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  PiPlus, PiRepeat, PiCalendarDots, PiPencilSimple, PiUsersThree, PiTrash, PiPause, PiPlay, PiWarningCircle, PiClock
} from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, PageHeader, Badge, EmptyState, Skeleton, WeekDots, DAY_NAMES } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import Dialog from '../components/ui/Dialog';
import { Field, Input } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';
import DateStepper from '../components/DateStepper';
import AssignAthletesDialog from '../components/AssignAthletesDialog';
import SessionDialog from '../components/SessionDialog';
import RosterField from '../components/RosterField';
import cx from '../utils/cx';
import { presentLabel, rosterLabel } from '../utils/sessions';

const todayKey = () => format(new Date(), 'yyyy-MM-dd');
const keyToDate = (key) => parseISO(`${key}T12:00:00`);
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


// ---------- Forms ----------

const TemplateDialog = ({ open, onClose, template, templates = [], onSaved }) => {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [days, setDays] = useState([]);
  const [roster, setRoster] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name || '');
    setTime(template?.time || '');
    setDays(template?.daysOfWeek || []);
    setRoster(new Set());
    setErrors({});
  }, [open, template]);

  const toggleDay = (d) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
    setErrors((x) => ({ ...x, days: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!name.trim()) next.name = 'Give the template a name.';
    if (days.length === 0) next.days = 'Pick at least one day.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const body = { name: name.trim(), daysOfWeek: days, time: time || null, ...(template ? {} : { assignedAthletes: [...roster] }) };
      const { data } = template ? await api.put(`/schedules/${template._id}`, body) : await api.post('/schedules', body);
      onSaved(data, !template);
      onClose();
    } catch (err) {
      setErrors({ form: apiError(err, 'Could not save the template.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={template ? 'Edit template' : 'New recurring template'}
      description="A session is created automatically on every selected day."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="template-form" loading={saving}>{template ? 'Save changes' : 'Create template'}</Button>
        </>
      )}
    >
      <form id="template-form" onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Field label="Name" htmlFor="template-name" error={errors.name}>
          <Input id="template-name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} placeholder="Morning swim" maxLength={100} aria-invalid={!!errors.name} data-autofocus />
        </Field>
        <Field label="Repeats on" error={errors.days}>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Repeats on">
            {DAY_SHORT.map((label, d) => {
              const on = days.includes(d);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={cx('h-11 rounded-pill text-[13px] font-semibold transition-colors', on ? 'bg-ink text-canvas' : 'bg-surface-2 text-muted hover:text-ink')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Start time" htmlFor="template-time" hint="Optional. Shown on every generated session.">
          <Input id="template-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {!template && (
          <RosterField
            value={roster}
            onChange={setRoster}
            sources={templates.filter((t) => t.assignedAthletes?.length).map((t) => ({ label: `Same as ${t.name}`, ids: t.assignedAthletes }))}
          />
        )}
        {template && <p className="text-[12px] text-muted">Changes apply to today and future sessions. Past sessions keep their history. Removing a day or pausing removes upcoming sessions nobody has been checked in to.</p>}
        {errors.form && <p role="alert" className="text-[13px] text-danger">{errors.form}</p>}
      </form>
    </Dialog>
  );
};

// ---------- Lists ----------

const SessionRow = ({ session, onCheckIn, onEdit, onAssign, onDelete }) => {
  const taken = session.recordCount > 0;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="w-14 shrink-0 pt-0.5">
          <p className="text-[15px] font-semibold tabular-nums">{session.time || '-'}</p>
          <p className="text-[11px] text-muted">{session.time ? 'start' : 'any time'}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-[-0.02em]">{session.name}</h3>
            {session.scheduleId ? <Badge icon={PiRepeat}>Template</Badge> : <Badge>One-off</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {rosterLabel(session.assignedAthletes)}
            <span aria-hidden="true"> · </span>
            {taken ? <span className="text-ink">{presentLabel(session)}</span> : 'Not taken yet'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 pl-[72px] sm:pl-0">
        <Button size="sm" variant={taken ? 'secondary' : 'primary'} onClick={onCheckIn} className="flex-1 sm:flex-none">
          {taken ? 'Review attendance' : 'Take attendance'}
        </Button>
        <Menu
          label={`Actions for ${session.name}`}
          items={[
            { label: 'Edit name or time', icon: PiPencilSimple, onSelect: onEdit },
            { label: 'Choose athletes', icon: PiUsersThree, onSelect: onAssign },
            { label: 'Delete session', icon: PiTrash, tone: 'danger', onSelect: onDelete }
          ]}
        />
      </div>
    </li>
  );
};

const TemplateCard = ({ template, onEdit, onAssign, onToggle, onDelete }) => (
  <Card as="li" className={cx('flex flex-col gap-4 p-5', !template.active && 'opacity-70')}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em]">{template.name}</h3>
          {!template.active && <Badge>Paused</Badge>}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <PiClock className="h-3.5 w-3.5" aria-hidden="true" />
          {template.time || 'No set time'}
          <span aria-hidden="true">·</span>
          {rosterLabel(template.assignedAthletes)}
        </p>
      </div>
      <Menu
        label={`Actions for ${template.name}`}
        items={[
          { label: 'Edit template', icon: PiPencilSimple, onSelect: onEdit },
          { label: 'Choose athletes', icon: PiUsersThree, onSelect: onAssign },
          { label: template.active ? 'Pause' : 'Resume', icon: template.active ? PiPause : PiPlay, onSelect: onToggle },
          { label: 'Delete template', icon: PiTrash, tone: 'danger', onSelect: onDelete }
        ]}
      />
    </div>
    <WeekDots days={template.daysOfWeek} />
  </Card>
);

const ListSkeleton = ({ rows = 3 }) => (
  <Card className="divide-y divide-line-soft" aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-5">
        <Skeleton className="h-9 w-12" />
        <div className="flex-1"><Skeleton className="mb-2 h-4 w-40" /><Skeleton className="h-3 w-56" /></div>
        <Skeleton className="h-9 w-32 rounded-pill" />
      </div>
    ))}
  </Card>
);

// ---------- Page ----------

const Sessions = () => {
  usePageTitle('Sessions');
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const view = params.get('view') === 'templates' ? 'templates' : 'day';
  const rawDay = params.get('date');
  const dayKey = rawDay && isValid(parseISO(rawDay)) ? rawDay : todayKey();
  const isToday = dayKey === todayKey();

  const [sessions, setSessions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [sessionDialog, setSessionDialog] = useState({ open: false, session: null });
  const [templateDialog, setTemplateDialog] = useState({ open: false, template: null });
  const [assign, setAssign] = useState(null); // { kind, entity }

  const setView = (v) => setParams((p) => { const n = new URLSearchParams(p); if (v === 'day') n.delete('view'); else n.set('view', v); return n; }, { replace: true });
  const setDay = (key) => setParams((p) => { const n = new URLSearchParams(p); if (key === todayKey()) n.delete('date'); else n.set('date', key); return n; }, { replace: true });

  const loadDay = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get(`/sessions?date=${dayKey}`);
      setSessions(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [dayKey]);

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/schedules');
      setTemplates(data);
      if (view === 'templates') setStatus('ready');
    } catch {
      if (view === 'templates') setStatus('error');
    }
  }, [view]);

  useEffect(() => { if (view === 'day') loadDay(); else { setStatus('loading'); loadTemplates(); } }, [view, loadDay, loadTemplates]);
  // Template count in the tab label.
  useEffect(() => { if (view === 'day') loadTemplates(); }, [view, loadTemplates]);

  const deleteSession = async (s) => {
    const ok = await confirm({
      title: 'Delete this session?',
      body: `“${s.name}” on ${format(keyToDate(dayKey), 'MMM d')} and its attendance will be removed.${s.scheduleId ? ' The template will skip this day from now on.' : ''} This cannot be undone.`,
      confirmLabel: 'Delete session',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/sessions/${s._id}`);
      setSessions((list) => list.filter((x) => x._id !== s._id));
      toast.success('Session deleted');
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the session'));
    }
  };

  const deleteTemplate = async (t) => {
    const ok = await confirm({
      title: 'Delete this template?',
      body: `No new “${t.name}” sessions will be created. Past sessions and their attendance are kept; upcoming sessions nobody has been checked in to are removed.`,
      confirmLabel: 'Delete template',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/schedules/${t._id}`);
      setTemplates((list) => list.filter((x) => x._id !== t._id));
      toast.success('Template deleted');
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the template'));
    }
  };

  const toggleTemplate = async (t) => {
    try {
      const { data } = await api.put(`/schedules/${t._id}`, { active: !t.active });
      setTemplates((list) => list.map((x) => (x._id === data._id ? data : x)));
      toast.success(data.active ? 'Template resumed' : 'Template paused. No new sessions until you resume it.');
      if (view === 'day') loadDay();
    } catch (err) {
      toast.error(apiError(err, 'Could not update the template'));
    }
  };

  const saveAssignment = async (ids) => {
    const { kind, entity } = assign;
    try {
      const { data } = await api.put(kind === 'session' ? `/sessions/${entity._id}` : `/schedules/${entity._id}`, { assignedAthletes: ids });
      if (kind === 'session') {
        setSessions((list) => list.map((x) => (x._id === data._id ? { ...x, ...data } : x)));
        if (entity.scheduleId) loadTemplates();
      } else {
        setTemplates((list) => list.map((x) => (x._id === data._id ? data : x)));
      }
      toast.success('Athletes updated');
    } catch (err) {
      toast.error(apiError(err, 'Could not save athletes'));
      throw err;
    }
  };

  const templateName = (id) => templates.find((t) => t._id === id)?.name;
  // Editing a past template session only corrects that session; today or later also updates the template.
  const assignDescription = assign
    ? assign.kind === 'template'
      ? 'Expected at every session this template creates from today on.'
      : assign.entity.scheduleId && dayKey >= todayKey()
        ? `This also updates the “${templateName(assign.entity.scheduleId) || 'parent'}” template for today and future days.`
        : 'Expected at this one session.'
    : '';
  const assignSources = templates
    .filter((t) => t.assignedAthletes?.length && t._id !== assign?.entity._id)
    .map((t) => ({ label: `Same as ${t.name}`, ids: t.assignedAthletes }));

  const openCheckIn = (id) => navigate(`/checkin/${id}`, { state: { from: `/sessions${isToday ? '' : `?date=${dayKey}`}` } });

  const primary = view === 'day'
    ? <Button icon={PiPlus} onClick={() => setSessionDialog({ open: true, session: null })}>New session</Button>
    : <Button icon={PiPlus} onClick={() => setTemplateDialog({ open: true, template: null })}>New template</Button>;

  return (
    <>
      <PageHeader title="Sessions" description="Plan each day and take attendance." actions={primary}>
        <Segmented
          label="Sessions view"
          value={view}
          onChange={setView}
          options={[
            { value: 'day', label: 'By day', icon: PiCalendarDots },
            { value: 'templates', label: 'Templates', icon: PiRepeat, count: templates.length || undefined }
          ]}
          className="self-start"
        />
      </PageHeader>

      {view === 'day' && (
        <div className="flex flex-col gap-4">
          <DateStepper
            title={isToday ? 'Today' : format(keyToDate(dayKey), 'EEEE')}
            subtitle={format(keyToDate(dayKey), 'MMMM d, yyyy')}
            onPrev={() => setDay(format(addDays(keyToDate(dayKey), -1), 'yyyy-MM-dd'))}
            onNext={() => setDay(format(addDays(keyToDate(dayKey), 1), 'yyyy-MM-dd'))}
            onJump={setDay}
            pickerValue={dayKey}
            trailing={!isToday && <Button size="sm" variant="secondary" onClick={() => setDay(todayKey())}>Today</Button>}
          />

          {status === 'loading' ? (
            <ListSkeleton />
          ) : status === 'error' ? (
            <Card><EmptyState icon={PiWarningCircle} title="Could not load sessions" body="Check your connection and try again." action={<Button onClick={loadDay}>Try again</Button>} /></Card>
          ) : sessions.length === 0 ? (
            <Card>
              <EmptyState
                icon={PiCalendarDots}
                title={isToday ? 'No sessions today' : `No sessions on ${format(keyToDate(dayKey), 'MMM d')}`}
                body={templates.length ? 'None of your templates run on this day. Add a one-off session if you are training anyway.' : 'Add a one-off session, or create a template so sessions appear on their own.'}
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button icon={PiPlus} onClick={() => setSessionDialog({ open: true, session: null })}>New session</Button>
                    {templates.length === 0 && <Button variant="secondary" icon={PiRepeat} onClick={() => { setView('templates'); setTemplateDialog({ open: true, template: null }); }}>New template</Button>}
                  </div>
                )}
              />
            </Card>
          ) : (
            <Card as="ul" className="divide-y divide-line-soft animate-rise">
              {sessions.map((s) => (
                <SessionRow
                  key={s._id}
                  session={s}
                  onCheckIn={() => openCheckIn(s._id)}
                  onEdit={() => setSessionDialog({ open: true, session: s })}
                  onAssign={() => setAssign({ kind: 'session', entity: s })}
                  onDelete={() => deleteSession(s)}
                />
              ))}
            </Card>
          )}
        </div>
      )}

      {view === 'templates' && (
        status === 'loading' ? (
          <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">{[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        ) : status === 'error' ? (
          <Card><EmptyState icon={PiWarningCircle} title="Could not load templates" action={<Button onClick={loadTemplates}>Try again</Button>} /></Card>
        ) : templates.length === 0 ? (
          <Card>
            <EmptyState
              icon={PiRepeat}
              title="No templates yet"
              body="A template is a weekly plan, like Morning swim on Sun, Tue and Thu. Sessions appear on those days automatically."
              action={<Button icon={PiPlus} onClick={() => setTemplateDialog({ open: true, template: null })}>Create a template</Button>}
            />
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 animate-rise">
            {templates.map((t) => (
              <TemplateCard
                key={t._id}
                template={t}
                onEdit={() => setTemplateDialog({ open: true, template: t })}
                onAssign={() => setAssign({ kind: 'template', entity: t })}
                onToggle={() => toggleTemplate(t)}
                onDelete={() => deleteTemplate(t)}
              />
            ))}
          </ul>
        )
      )}

      {view === 'templates' && templates.length > 0 && (
        <p className="mt-6 text-[13px] text-muted">
          Sessions are created automatically every day a template runs. Need a day off? Delete that day&apos;s session from <Link to="/sessions" className="text-accent hover:underline">By day</Link>.
        </p>
      )}

      <SessionDialog
        open={sessionDialog.open}
        session={sessionDialog.session}
        dayKey={dayKey}
        templates={templates}
        onClose={() => setSessionDialog({ open: false, session: null })}
        onSaved={(data, created, { checkIn }) => {
          if (created && checkIn) { openCheckIn(data._id); return; }
          setSessions((list) => (created ? [...list, data] : list.map((x) => (x._id === data._id ? { ...x, ...data } : x)))
            .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99')));
          toast.success(created ? 'Session created' : 'Session updated');
        }}
      />
      <TemplateDialog
        open={templateDialog.open}
        template={templateDialog.template}
        templates={templates}
        onClose={() => setTemplateDialog({ open: false, template: null })}
        onSaved={(data, created) => {
          setTemplates((list) => (created ? [data, ...list] : list.map((x) => (x._id === data._id ? data : x))));
          toast.success(created ? `Template created. Runs every ${data.daysOfWeek.map((d) => DAY_SHORT[d]).join(', ')}.` : 'Template updated');
          if (view === 'day') loadDay();
        }}
      />
      <AssignAthletesDialog
        open={!!assign}
        onClose={() => setAssign(null)}
        title={assign ? `Athletes for ${assign.entity.name}` : ''}
        description={assignDescription}
        initialIds={assign?.entity.assignedAthletes || []}
        sources={assignSources}
        onSave={saveAssignment}
      />
    </>
  );
};

export default Sessions;
