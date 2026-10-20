import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PiPlus, PiMagnifyingGlass, PiPencilSimple, PiArchive, PiArrowCounterClockwise, PiTrash, PiUsersThree, PiCaretRight, PiWarningCircle } from 'react-icons/pi';
import api from '../utils/api';
import usePageTitle from '../hooks/usePageTitle';
import { apiError } from '../utils/browser';
import { Card, PageHeader, Avatar, Badge, Skeleton, EmptyState } from '../components/ui/Display';
import Button from '../components/ui/Button';
import Menu from '../components/ui/Menu';
import { Input } from '../components/ui/Form';
import { Segmented } from '../components/ui/Segmented';
import { useConfirm } from '../components/ui/ConfirmProvider';
import AthleteFormDialog from '../components/AthleteFormDialog';
import AddAthletesDialog from '../components/AddAthletesDialog';

const Athletes = () => {
  usePageTitle('Athletes');
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const archived = params.get('show') === 'archived';

  const [athletes, setAthletes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState({ open: false, athlete: null });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get(`/athletes?active=${!archived}`);
      setAthletes(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [archived]);

  useEffect(() => { load(); }, [load]);

  const setArchived = (v) => setParams(v === 'archived' ? { show: 'archived' } : {}, { replace: true });

  const archive = async (a) => {
    const ok = await confirm({
      title: `Archive ${a.name}?`,
      body: 'They leave check-in lists and reports. Their attendance and test history are kept, and you can restore them any time.',
      confirmLabel: 'Archive'
    });
    if (!ok) return;
    try {
      await api.delete(`/athletes/${a._id}`);
      setAthletes((list) => list.filter((x) => x._id !== a._id));
      toast.success(`${a.name} archived`);
    } catch (err) {
      toast.error(apiError(err, 'Could not archive the athlete'));
    }
  };

  const restore = async (a) => {
    try {
      await api.put(`/athletes/${a._id}`, { active: true });
      setAthletes((list) => list.filter((x) => x._id !== a._id));
      toast.success(`${a.name} restored`);
    } catch (err) {
      toast.error(apiError(err, 'Could not restore the athlete'));
    }
  };

  const destroy = async (a) => {
    const ok = await confirm({
      title: `Delete ${a.name} permanently?`,
      body: 'All of their attendance records and test results are deleted too. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      await api.delete(`/athletes/${a._id}/permanent`);
      setAthletes((list) => list.filter((x) => x._id !== a._id));
      toast.success(`${a.name} deleted`);
    } catch (err) {
      toast.error(apiError(err, 'Could not delete the athlete'));
    }
  };

  const query = search.trim().toLowerCase();
  const filtered = athletes.filter((a) => a.name.toLowerCase().includes(query));
  const newCount = athletes.filter((a) => a.isNewAthlete).length;

  return (
    <>
      <PageHeader
        title="Athletes"
        description={status === 'ready' && !archived ? `${athletes.length} active${newCount ? `, ${newCount} new` : ''}` : 'Your roster.'}
        actions={<Button icon={PiPlus} onClick={() => setAdding(true)}>Add athletes</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input icon={PiMagnifyingGlass} placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search athletes" />
        </div>
        <Segmented
          label="Roster"
          value={archived ? 'archived' : 'active'}
          onChange={setArchived}
          options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
        />
      </div>

      {status === 'loading' ? (
        <Card className="divide-y divide-line-soft" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1"><Skeleton className="mb-2 h-4 w-40" /><Skeleton className="h-3 w-28" /></div></div>
          ))}
        </Card>
      ) : status === 'error' ? (
        <Card><EmptyState icon={PiWarningCircle} title="Could not load athletes" action={<Button onClick={load}>Try again</Button>} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          {query ? (
            <EmptyState icon={PiMagnifyingGlass} title="No matches" body={`Nobody on this list is called “${search.trim()}”.`} />
          ) : archived ? (
            <EmptyState icon={PiArchive} title="No archived athletes" body="Athletes you archive appear here, with their history intact." />
          ) : (
            <EmptyState
              icon={PiUsersThree}
              title="Add your first athlete"
              body="Build your roster once. Paste a whole list of names to add everyone in one go."
              action={<Button icon={PiPlus} onClick={() => setAdding(true)}>Add athletes</Button>}
            />
          )}
        </Card>
      ) : (
        <Card as="ul" className="grid divide-y divide-line-soft md:grid-cols-2 md:divide-y-0 md:gap-px md:overflow-hidden md:bg-line-soft animate-rise">
          {filtered.map((a) => (
            <li key={a._id} className="flex items-center gap-1 bg-surface-1 pr-2">
              <Link to={`/athlete/${a._id}`} className="group flex min-w-0 flex-1 items-center gap-3 p-4 pr-2">
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium group-hover:underline">{a.name}</span>
                    {a.isNewAthlete && <Badge tone="new">New</Badge>}
                  </div>
                  <p className="text-[12px] text-muted">
                    {archived
                      ? `Archived ${format(new Date(a.archivedAt || a.updatedAt), 'MMM d, yyyy')}`
                      : `Joined ${new Date(a.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`}
                  </p>
                </div>
                <PiCaretRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              </Link>
              <Menu
                label={`Actions for ${a.name}`}
                items={archived ? [
                  { label: 'Restore', icon: PiArrowCounterClockwise, onSelect: () => restore(a) },
                  { label: 'Delete permanently', icon: PiTrash, tone: 'danger', onSelect: () => destroy(a) }
                ] : [
                  { label: 'Edit', icon: PiPencilSimple, onSelect: () => setDialog({ open: true, athlete: a }) },
                  { label: 'Archive', icon: PiArchive, onSelect: () => archive(a) }
                ]}
              />
            </li>
          ))}
          {/* Keep the two-column grid even so no cell is left empty. */}
          {filtered.length % 2 === 1 && <li aria-hidden="true" className="hidden bg-surface-1 md:block" />}
        </Card>
      )}

      <AthleteFormDialog
        open={dialog.open}
        athlete={dialog.athlete}
        onClose={() => setDialog({ open: false, athlete: null })}
        onSaved={(data) => {
          setAthletes((list) => list.map((x) => (x._id === data._id ? data : x)).sort((x, y) => x.name.localeCompare(y.name)));
          toast.success('Athlete updated');
        }}
      />
      <AddAthletesDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={({ created, skipped }) => {
          if (archived) setArchived('active');
          else setAthletes((list) => [...list, ...created].sort((x, y) => x.name.localeCompare(y.name)));
          const added = created.length === 1 ? `${created[0].name} added` : `${created.length} athletes added`;
          if (skipped.length) toast(`${created.length ? `${added}. ` : ''}Already on your roster: ${skipped.join(', ')}`, { duration: 5000 });
          else toast.success(added);
        }}
      />
    </>
  );
};

export default Athletes;
