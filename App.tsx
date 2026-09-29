import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  ClipboardCheck,
  Download,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Users,
  Volleyball,
  X,
} from 'lucide-react';
import {
  getGetTeamQueryKey,
  getGetTeamSummaryQueryKey,
  getHealthCheckQueryKey,
  getListRotationFeedbackQueryKey,
  getListTeamsQueryKey,
  useCreateRotationFeedback,
  useCreateTeam,
  useDeleteTeam,
  useGetTeam,
  useGetTeamSummary,
  useHealthCheck,
  useListTeams,
  useListRotationFeedback,
  useUpdateTeam,
} from '@workspace/api-client-react';
import type {
  CourtPosition,
  Lineup,
  Player,
  PlayerInput,
  PlayerRole,
  RotationFeedback,
  Team,
  TeamInput,
} from '@workspace/api-client-react';
import { PlayerRole as PlayerRoleValues } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, useRoute, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const POSITIONS: Array<{ key: CourtPosition; label: string; short: string }> = [
  { key: 'front-left', label: 'Front Left', short: 'FL' },
  { key: 'front-middle', label: 'Front Middle', short: 'FM' },
  { key: 'front-right', label: 'Front Right', short: 'FR' },
  { key: 'back-left', label: 'Back Left', short: 'BL' },
  { key: 'back-middle', label: 'Back Middle', short: 'BM' },
  { key: 'back-right', label: 'Back Right', short: 'BR' },
];

const ROLE_OPTIONS: PlayerRole[] = [
  PlayerRoleValues.Setter,
  PlayerRoleValues.Outside_Hitter,
  PlayerRoleValues.Middle,
  PlayerRoleValues.Opposite,
  PlayerRoleValues.Libero,
  PlayerRoleValues.Defensive_Specialist,
];

const ROLE_FIT_SCORES: Record<PlayerRole, Record<CourtPosition, number>> = {
  [PlayerRoleValues.Setter]: {
    'front-left': 3,
    'front-middle': 8,
    'front-right': 3,
    'back-left': 5,
    'back-middle': 8,
    'back-right': 5,
  },
  [PlayerRoleValues.Outside_Hitter]: {
    'front-left': 8,
    'front-middle': 3,
    'front-right': 7,
    'back-left': 7,
    'back-middle': 3,
    'back-right': 6,
  },
  [PlayerRoleValues.Middle]: {
    'front-left': 7,
    'front-middle': 9,
    'front-right': 7,
    'back-left': 1,
    'back-middle': 1,
    'back-right': 1,
  },
  [PlayerRoleValues.Opposite]: {
    'front-left': 5,
    'front-middle': 3,
    'front-right': 9,
    'back-left': 5,
    'back-middle': 2,
    'back-right': 8,
  },
  [PlayerRoleValues.Libero]: {
    'front-left': 0,
    'front-middle': 0,
    'front-right': 0,
    'back-left': 9,
    'back-middle': 8,
    'back-right': 9,
  },
  [PlayerRoleValues.Defensive_Specialist]: {
    'front-left': 1,
    'front-middle': 1,
    'front-right': 1,
    'back-left': 8,
    'back-middle': 7,
    'back-right': 8,
  },
};

const SUGGESTION_POSITION_ORDER: CourtPosition[] = [
  'front-middle',
  'back-middle',
  'front-left',
  'front-right',
  'back-left',
  'back-right',
];

const emptyLineup = (): Lineup => ({
  positions: POSITIONS.map(({ key }) => ({ position: key, playerId: null })),
  benchOrder: [],
  benchReplacements: [],
});

const displayDate = (value?: string) => {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '—';

type RotationCandidate = {
  lineup: Lineup;
  patternKey: string;
  feedbackScore: number;
  variant: number;
};

const roleFitScore = (role: PlayerRole, position: CourtPosition) => ROLE_FIT_SCORES[role][position];

const rotationPatternKey = (lineup: Lineup, players: Player[]) => {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const roleFor = (playerId: string | null) => playerId ? playerById.get(playerId)?.role ?? 'unknown' : 'empty';
  const replacementByPlayer = new Map((lineup.benchReplacements ?? []).map((replacement) => [replacement.playerId, replacement.position]));
  const starters = POSITIONS.map((position) => {
    const playerId = lineup.positions.find((assignment) => assignment.position === position.key)?.playerId ?? null;
    return `${position.key}:${roleFor(playerId)}`;
  }).join(',');
  const bench = lineup.benchOrder
    .map((playerId) => `${roleFor(playerId)}:${replacementByPlayer.get(playerId) ?? 'none'}`)
    .join(',');
  return `starters=${starters}|bench=${bench}`;
};

const generateRotationCandidates = (team: Team, feedback: RotationFeedback[]): RotationCandidate[] => {
  const available = team.players
    .filter((player) => player.available)
    .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (available.length < POSITIONS.length) return [];

  const feedbackByPattern = new Map(feedback.map((item) => [item.patternKey, item]));
  const candidates: RotationCandidate[] = [];
  const seenLineups = new Set<string>();
  const variants = Math.min(available.length * 2, 12);

  for (let variant = 0; variant < variants; variant += 1) {
    const rotated = available.map((_, index) => available[(index + variant) % available.length]);
    const positionOrder = variant % 2 === 0
      ? SUGGESTION_POSITION_ORDER
      : [...SUGGESTION_POSITION_ORDER.slice(3), ...SUGGESTION_POSITION_ORDER.slice(0, 3)];
    const used = new Set<string>();
    const assignments = new Map<CourtPosition, string>();
    const tolerance = variant % 3;

    for (const position of positionOrder) {
      const remaining = rotated.filter((player) => !used.has(player.id));
      const bestScore = Math.max(...remaining.map((player) => roleFitScore(player.role, position)));
      const acceptable = remaining.filter((player) => roleFitScore(player.role, position) >= bestScore - tolerance);
      const selected = acceptable[(variant + positionOrder.indexOf(position)) % acceptable.length] ?? acceptable[0];
      used.add(selected.id);
      assignments.set(position, selected.id);
    }

    const benchPlayers = rotated.filter((player) => !used.has(player.id));
    const benchOrder = benchPlayers.map((player, index) => benchPlayers[(index + variant) % benchPlayers.length]?.id ?? player.id);
    const benchReplacements = benchOrder.map((playerId) => {
      const player = team.players.find((item) => item.id === playerId) ?? available[0];
      const position = POSITIONS
        .slice()
        .sort((a, b) => roleFitScore(player.role, b.key) - roleFitScore(player.role, a.key))[0].key;
      return { playerId, position };
    });
    const lineup: Lineup = {
      positions: POSITIONS.map((position) => ({ position: position.key, playerId: assignments.get(position.key) ?? null })),
      benchOrder,
      benchReplacements,
    };
    const lineupKey = `${lineup.positions.map((assignment) => assignment.playerId ?? '').join(',')}|${benchOrder.join(',')}`;
    if (seenLineups.has(lineupKey)) continue;
    seenLineups.add(lineupKey);
    const patternKey = rotationPatternKey(lineup, team.players);
    const priorFeedback = feedbackByPattern.get(patternKey);
    candidates.push({
      lineup,
      patternKey,
      feedbackScore: priorFeedback ? priorFeedback.yesCount * 3 - priorFeedback.noCount * 4 : 0,
      variant,
    });
  }

  return candidates.sort((a, b) => b.feedbackScore - a.feedbackScore || a.variant - b.variant);
};

const viewOnlyUrl = (teamId: string) =>
  new URL(`${import.meta.env.BASE_URL}share/${teamId}`, window.location.origin).toString();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/share/:teamId" component={ViewOnlySummary} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Home() {
  const queryClient = useQueryClient();
  const teamsQuery = useListTeams({ query: { queryKey: getListTeamsQueryKey() } });
  const healthQuery = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 30_000 } });
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();
  const teams = teamsQuery.data ?? [];
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [draftTeam, setDraftTeam] = useState<Team | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!selectedTeamId && teams[0]) setSelectedTeamId(teams[0].id);
    if (selectedTeamId && !teams.some((team) => team.id === selectedTeamId)) setSelectedTeamId(teams[0]?.id ?? '');
  }, [selectedTeamId, teams]);

  const teamQuery = useGetTeam(selectedTeamId, {
    query: { enabled: Boolean(selectedTeamId), queryKey: getGetTeamQueryKey(selectedTeamId) },
  });
  const summaryQuery = useGetTeamSummary(selectedTeamId, {
    query: { enabled: Boolean(selectedTeamId), queryKey: getGetTeamSummaryQueryKey(selectedTeamId) },
  });

  useEffect(() => {
    if (teamQuery.data) setDraftTeam(teamQuery.data);
  }, [teamQuery.data]);

  const summary = summaryQuery.data;
  const selectedTeam = draftTeam?.id === selectedTeamId ? draftTeam : teamQuery.data;

  const makeDefaultTeam = (name: string): TeamInput => ({
    name: name.trim(),
    players: [],
    lineup: emptyLineup(),
  });

  const create = () => {
    const name = newTeamName.trim();
    if (!name || createTeam.isPending) return;
    createTeam.mutate({ data: makeDefaultTeam(name) }, {
      onSuccess: (team) => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        setSelectedTeamId(team.id);
        setDraftTeam(team);
        setNewTeamName('');
        setShowCreate(false);
      },
    });
  };

  const removeTeam = () => {
    if (!selectedTeam || deleteTeam.isPending) return;
    if (!window.confirm(`Delete ${selectedTeam.name}? This cannot be undone.`)) return;
    deleteTeam.mutate({ teamId: selectedTeam.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        setDraftTeam(null);
        setSelectedTeamId('');
      },
    });
  };

  const saveTeam = (next: Team, successText = 'Saved just now') => {
    setDraftTeam(next);
    setSaveState('saving');
    updateTeam.mutate({
      teamId: next.id,
      data: {
        name: next.name,
        players: next.players.map(toPlayerInput),
        lineup: next.lineup,
      },
    }, {
      onSuccess: (saved) => {
        setDraftTeam(saved);
        setSaveState('saved');
        queryClient.setQueryData(getGetTeamQueryKey(next.id), saved);
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTeamSummaryQueryKey(next.id) });
        window.setTimeout(() => setSaveState('idle'), 1800);
        void successText;
      },
      onError: () => setSaveState('error'),
    });
  };

  const previewTeam = (next: Team) => {
    setDraftTeam(next);
    setSaveState('idle');
  };

  const refresh = () => {
    void teamsQuery.refetch();
    if (selectedTeamId) {
      void teamQuery.refetch();
      void summaryQuery.refetch();
    }
  };

  return (
    <div className="grain mobile-safe min-h-[100dvh] bg-background">
      <div className="flex min-h-[100dvh] min-w-0 max-w-full flex-col lg:flex-row">
        <aside className="flex w-full max-w-full shrink-0 flex-col border-b border-card-border bg-card lg:min-h-[100dvh] lg:w-[270px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-5 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-secondary text-foreground shadow-[3px_3px_0_hsl(205_35%_18%)]">
              <Volleyball size={21} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-[17px] font-bold tracking-[-.03em]">sideline</div>
              <div className="font-mono-app text-[9px] uppercase tracking-[.18em] text-muted-foreground">lineup desk</div>
            </div>
          </div>
          <div className="hidden h-px bg-border lg:block" />
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <div className="font-mono-app text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">Saved teams</div>
            <button data-testid="button-open-create-team" onClick={() => setShowCreate(true)} className="button-snap rounded-md p-1 text-primary hover:bg-muted" aria-label="Create a new team">
              <Plus size={17} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
            {teamsQuery.isLoading ? (
              <div className="space-y-2 px-2 py-3">
                <div className="h-11 w-48 animate-pulse rounded-lg bg-muted" />
                <div className="h-11 w-56 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : teams.length ? teams.map((team) => (
              <button
                key={team.id}
                data-testid={`button-select-team-${team.id}`}
                onClick={() => setSelectedTeamId(team.id)}
                className={`button-snap min-w-[190px] rounded-lg border px-3 py-3 text-left lg:min-w-0 ${selectedTeamId === team.id ? 'border-primary bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted/60'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${selectedTeamId === team.id ? 'bg-accent' : 'bg-border'}`} />
                  <span className="truncate text-sm font-semibold">{team.name}</span>
                </div>
                <span className="mt-1 block pl-4 font-mono-app text-[10px] text-muted-foreground">{displayDate(team.updatedAt)}</span>
              </button>
            )) : (
              <div className="px-3 py-4 text-xs leading-relaxed text-muted-foreground lg:pr-8">
                No saved teams yet. Start with a tournament roster.
              </div>
            )}
          </div>
          <div className="mt-auto hidden border-t border-border p-5 lg:block">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${healthQuery.isError ? 'bg-destructive' : 'bg-primary animate-pulse-soft'}`} />
              {healthQuery.isError ? 'Connection needs attention' : 'Planner connected'}
            </div>
            <button data-testid="button-refresh-data" onClick={refresh} className="button-snap mt-3 flex items-center gap-2 text-xs font-semibold text-primary hover:text-accent">
              <RefreshCw size={13} /> Refresh workspace
            </button>
          </div>
        </aside>

        <main className="mobile-safe w-full min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background/90 px-5 py-4 backdrop-blur-sm md:px-8">
            <div>
              <div className="flex items-center gap-2 font-mono-app text-[10px] uppercase tracking-[.18em] text-muted-foreground">
                <Activity size={13} className="text-primary" /> Match-day workspace
              </div>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-[-.04em] md:text-[30px]">Lineup board</h1>
            </div>
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
              <button data-testid="button-mobile-refresh" onClick={refresh} className="button-snap rounded-lg border border-border bg-card p-2.5 text-muted-foreground hover:text-primary lg:hidden" aria-label="Refresh data">
                <RefreshCw size={16} />
              </button>
              {selectedTeam && (
                <>
                  <select data-testid="select-current-team" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="h-10 max-w-[190px] rounded-lg border border-border bg-card px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring">
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                   <ShareLineupButton team={selectedTeam} />
                   <ShareLinkButton team={selectedTeam} />
                  <button data-testid="button-delete-team" onClick={removeTeam} className="button-snap rounded-lg border border-border bg-card p-2.5 text-muted-foreground hover:border-destructive hover:text-destructive" aria-label="Delete current team">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </header>
          {showCreate && teams.length > 0 && (
            <CreateTeamDialog
              name={newTeamName}
              setName={setNewTeamName}
              onCreate={create}
              onClose={() => { setShowCreate(false); setNewTeamName(''); }}
              isPending={createTeam.isPending}
            />
          )}

          <div className="mobile-safe mx-auto w-full max-w-[1500px] px-5 py-6 md:px-8 md:py-8">
            {teamsQuery.isLoading ? (
              <LoadingState />
            ) : teamsQuery.isError ? (
              <WorkspaceError onRetry={() => void teamsQuery.refetch()} />
            ) : !teams.length ? (
              <EmptyState showCreate={showCreate} setShowCreate={setShowCreate} newTeamName={newTeamName} setNewTeamName={setNewTeamName} create={create} isPending={createTeam.isPending} />
            ) : selectedTeam ? (
              <>
                <div className="animate-enter-up flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-accent/15 px-2.5 py-1 font-mono-app text-[10px] font-medium uppercase tracking-[.12em] text-accent">Active roster</span>
                      <span className="font-mono-app text-[10px] text-muted-foreground">{displayDate(selectedTeam.updatedAt)}</span>
                    </div>
                    <h2 data-testid="text-current-team-name" className="mt-3 font-display text-3xl font-bold tracking-[-.05em] md:text-4xl">{selectedTeam.name}</h2>
                     <p className="mt-1 text-sm text-muted-foreground">Set the six, check availability, then make the bench order obvious.</p>
                  </div>
                </div>

                <SummaryStrip summary={summary} fallback={selectedTeam} />
                <RotationSuggestions team={selectedTeam} onPreview={previewTeam} onSave={saveTeam} />

                {teamQuery.isError ? (
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                    <span className="flex items-center gap-2 text-destructive"><AlertTriangle size={17} /> Could not load this team.</span>
                    <button data-testid="button-retry-team" onClick={() => void teamQuery.refetch()} className="button-snap rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive">Retry</button>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
                    <div className="space-y-6">
                      <CourtBoard team={selectedTeam} onSave={saveTeam} />
                      <BenchPlan team={selectedTeam} onSave={saveTeam} />
                    </div>
                     <RosterPanel team={selectedTeam} onSave={saveTeam} />
                  </div>
                )}
                <div className="mt-7 flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {saveState === 'saving' && <><CircleDashed size={15} className="animate-spin text-secondary" /> Saving changes…</>}
                    {saveState === 'saved' && <><Check size={15} className="animate-save-pop text-primary" /> Saved to this team</>}
                    {saveState === 'error' && <><AlertTriangle size={15} className="text-destructive" /> Save failed. Try again.</>}
                    {saveState === 'idle' && <><ClipboardCheck size={15} /> Changes save when you assign or edit.</>}
                  </div>
                  <button data-testid="button-save-team" onClick={() => saveTeam(selectedTeam)} disabled={updateTeam.isPending} className="button-snap flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-foreground shadow-[2px_2px_0_hsl(205_35%_18%)] hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60">
                    <Save size={16} /> {updateTeam.isPending ? 'Saving' : 'Save lineup'}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground">Select a team to open the lineup board.</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function RotationSuggestions({ team, onPreview, onSave }: { team: Team; onPreview: (team: Team) => void; onSave: (team: Team, successText?: string) => void }) {
  const queryClient = useQueryClient();
  const feedbackQuery = useListRotationFeedback({
    query: {
      queryKey: getListRotationFeedbackQueryKey(),
      staleTime: 30_000,
    },
  });
  const feedbackMutation = useCreateRotationFeedback();
  const [currentPatternKey, setCurrentPatternKey] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<'yes' | 'no' | null>(null);
  const candidates = useMemo(
    () => generateRotationCandidates(team, feedbackQuery.data ?? []),
    [team.players, feedbackQuery.data],
  );
  const currentCandidate = candidates.find((candidate) => candidate.patternKey === currentPatternKey) ?? null;
  const currentIndex = currentCandidate ? candidates.indexOf(currentCandidate) : -1;
  const availableCount = team.players.filter((player) => player.available).length;

  useEffect(() => {
    setCurrentPatternKey(null);
    setFeedbackGiven(null);
  }, [team.id]);

  const applyCandidate = (candidate: RotationCandidate | undefined) => {
    if (!candidate) return;
    setCurrentPatternKey(candidate.patternKey);
    setFeedbackGiven(null);
    onPreview({ ...team, lineup: candidate.lineup });
  };

  const repopulate = () => {
    if (!candidates.length) return;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % candidates.length : 0;
    applyCandidate(candidates[nextIndex]);
  };

  const vote = (value: 'yes' | 'no') => {
    if (!currentCandidate || feedbackGiven || feedbackMutation.isPending) return;
    setFeedbackGiven(value);
    if (value === 'yes') {
      onSave({ ...team, lineup: currentCandidate.lineup }, 'Suggested rotation saved');
    }
    feedbackMutation.mutate(
      { data: { patternKey: currentCandidate.patternKey, vote: value } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListRotationFeedbackQueryKey() });
        },
        onError: () => setFeedbackGiven(null),
      },
    );
  };

  return (
    <section className="panel-lift mobile-card mt-6 rounded-2xl border border-card-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground"><Sparkles size={15} /></span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold tracking-[-.03em]">Rotation suggestions</h3>
            <p className="mt-1 text-xs text-muted-foreground">Build a full lineup from available players, then cycle until the captain likes one.</p>
          </div>
        </div>
        <button
          data-testid="button-repopulate-rotation"
          type="button"
          onClick={repopulate}
          disabled={availableCount < POSITIONS.length || feedbackQuery.isLoading}
          className="button-snap inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-foreground shadow-[2px_2px_0_hsl(205_35%_18%)] hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw size={14} /> {currentCandidate ? 'Repopulate' : 'Suggest lineup'}
        </button>
      </div>
      {availableCount < POSITIONS.length ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {availableCount}/6 players are available. Mark at least six players available to generate a full rotation.
        </p>
      ) : currentCandidate ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
          <div className="min-w-0">
            <div className="font-mono-app text-[10px] font-medium uppercase tracking-[.12em] text-primary">
              Suggested option {currentIndex + 1} of {candidates.length}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              This is a preview. Select Yes to save it, or repopulate to try another role-aware option.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              data-testid="button-rotation-yes"
              type="button"
              onClick={() => vote('yes')}
              disabled={Boolean(feedbackGiven) || feedbackMutation.isPending}
              className="button-snap inline-flex items-center gap-1 rounded-md border border-primary/25 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-45"
            >
              <ThumbsUp size={13} /> Yes
            </button>
            <button
              data-testid="button-rotation-no"
              type="button"
              onClick={() => vote('no')}
              disabled={Boolean(feedbackGiven) || feedbackMutation.isPending}
              className="button-snap inline-flex items-center gap-1 rounded-md border border-destructive/20 bg-card px-2.5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-45"
            >
              <ThumbsDown size={13} /> No
            </button>
          </div>
          {feedbackGiven && <span className="basis-full text-[10px] text-muted-foreground">{feedbackGiven === 'yes' ? 'Accepted, saved, and added to future recommendations.' : 'Feedback saved. Repopulate to try another option.'}</span>}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Suggested rotations prefer each player’s marked role, with practical fallbacks when needed.</p>
      )}
    </section>
  );
}

function ViewOnlySummary() {
  const [, params] = useRoute('/share/:teamId');
  const teamId = params?.teamId ?? '';
  const teamQuery = useGetTeam(teamId, {
    query: { enabled: Boolean(teamId), queryKey: getGetTeamQueryKey(teamId) },
  });

  if (teamQuery.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-5">
        <div className="mx-auto max-w-4xl animate-pulse space-y-5">
          <div className="h-10 w-48 rounded bg-muted" />
          <div className="h-20 rounded-2xl bg-muted" />
          <div className="h-[440px] rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (teamQuery.isError || !teamQuery.data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
        <div className="w-full max-w-md rounded-2xl border border-destructive/25 bg-card p-7 text-center shadow-sm">
          <AlertTriangle className="mx-auto text-destructive" size={28} />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-[-.04em]">Lineup link unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This saved team could not be found. Ask the sender for a fresh lineup link.</p>
          <a href={import.meta.env.BASE_URL} className="button-snap mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Sideline</a>
        </div>
      </div>
    );
  }

  const team = teamQuery.data;
  return (
    <div className="grain min-h-[100dvh] bg-background">
      <main className="mx-auto max-w-5xl px-5 py-6 md:px-8 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href={import.meta.env.BASE_URL} className="flex items-center gap-3" aria-label="Open Sideline planner">
            <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-secondary text-foreground shadow-[3px_3px_0_hsl(205_35%_18%)]"><Volleyball size={21} strokeWidth={2.5} /></div>
            <div>
              <div className="font-display text-[17px] font-bold tracking-[-.03em]">sideline</div>
              <div className="font-mono-app text-[9px] uppercase tracking-[.18em] text-muted-foreground">view-only lineup</div>
            </div>
          </a>
          <ShareLinkButton team={team} />
        </header>

        <section className="mt-8 rounded-2xl border border-primary/20 bg-primary p-6 text-primary-foreground shadow-[5px_5px_0_hsl(33_91%_63%)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono-app text-[10px] uppercase tracking-[.18em] text-primary-foreground/70">Shared match plan</div>
              <h1 className="mt-2 font-display text-4xl font-bold tracking-[-.06em] md:text-5xl">{team.name}</h1>
              <p className="mt-2 text-sm text-primary-foreground/75">{displayDate(team.updatedAt)} · Read-only summary</p>
            </div>
            <div className="rounded-lg bg-primary-foreground/10 px-3 py-2 font-mono-app text-[10px] uppercase tracking-[.12em] text-primary-foreground/75">Starting six + bench</div>
          </div>
        </section>

        <ReadOnlyStartingSix team={team} />
        <ReadOnlyBench team={team} />

        <div className="mt-6 flex items-center justify-center gap-2 text-center font-mono-app text-[10px] uppercase tracking-[.12em] text-muted-foreground">
          <Link2 size={13} /> Shared from Sideline lineup desk
        </div>
      </main>
    </div>
  );
}

function ReadOnlyStartingSix({ team }: { team: Team }) {
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  return (
    <section className="panel-lift mobile-card mt-6 rounded-2xl border border-card-border bg-card p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Volleyball size={15} /></span>
            <h2 className="font-display text-xl font-bold tracking-[-.03em]">Starting six</h2>
          </div>
          <p className="mt-1 pl-9 text-xs text-muted-foreground">Playing position is shown first; role is underneath.</p>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1.5 font-mono-app text-[10px] text-muted-foreground">{team.lineup.positions.filter((assignment) => assignment.playerId).length}/6 filled</span>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border-4 border-secondary/70 bg-primary p-3 shadow-inner md:p-5">
        <div className="mb-3 flex items-center justify-between px-1 font-mono-app text-[9px] uppercase tracking-[.18em] text-primary-foreground/65"><span>Net</span><span>Attack line</span></div>
        <div className="court-surface relative grid min-w-0 max-w-full grid-cols-3 gap-2 rounded-lg p-2 md:gap-3 md:p-4">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t-2 border-dashed border-primary-foreground/45" />
          {POSITIONS.map((position) => {
            const playerId = team.lineup.positions.find((assignment) => assignment.position === position.key)?.playerId;
            const player = playerId ? playerById.get(playerId) : undefined;
            return (
              <div key={position.key} className="court-cell relative z-10 min-w-0 overflow-hidden rounded-lg border border-secondary bg-card p-2.5">
                <div className="font-mono-app text-[9px] font-medium uppercase tracking-[.1em] text-muted-foreground">{position.label}</div>
                <div className="mt-2 truncate text-sm font-bold text-foreground">{player?.name ?? 'Unassigned'}</div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">{player ? player.role : 'No player assigned'}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReadOnlyBench({ team }: { team: Team }) {
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const bench = team.lineup.benchOrder.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  return (
    <section className="panel-lift mobile-card mt-6 rounded-2xl border border-card-border bg-card p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground"><ArrowDown size={15} /></span>
            <h2 className="font-display text-xl font-bold tracking-[-.03em]">Bench rotation</h2>
          </div>
          <p className="mt-1 pl-9 text-xs text-muted-foreground">Queue order and exact replacement target.</p>
        </div>
        <span className="rounded-md bg-secondary/20 px-2.5 py-1.5 font-mono-app text-[10px] font-medium text-foreground">{bench.length} queued</span>
      </div>
      <div className="mt-5 space-y-2">
        {bench.length ? bench.map((player, index) => {
          const targetKey = team.lineup.benchReplacements?.find((replacement) => replacement.playerId === player.id)?.position ?? POSITIONS[index % POSITIONS.length].key;
          const target = POSITIONS.find((position) => position.key === targetKey) ?? POSITIONS[index % POSITIONS.length];
          const starterId = team.lineup.positions.find((assignment) => assignment.position === target.key)?.playerId;
          const starter = starterId ? playerById.get(starterId) : undefined;
          return (
            <div key={player.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary font-mono-app text-[10px] font-bold">{String(index + 1).padStart(2, '0')}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{player.name}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{player.role}</div>
              </div>
              <div className="text-right">
                <div className="font-mono-app text-[9px] uppercase tracking-[.08em] text-muted-foreground">Plays</div>
                <div className="mt-1 text-xs font-bold">{target.label}</div>
                {starter && <div className="text-[10px] text-muted-foreground">for {starter.name}</div>}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">No bench players queued.</div>
        )}
      </div>
    </section>
  );
}

function toPlayerInput(player: Player): PlayerInput {
  return {
    id: player.id,
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    role: player.role,
    available: player.available,
    note: player.note,
  };
}

function EmptyState({
  showCreate,
  setShowCreate,
  newTeamName,
  setNewTeamName,
  create,
  isPending,
}: {
  showCreate: boolean;
  setShowCreate: (value: boolean) => void;
  newTeamName: string;
  setNewTeamName: (value: string) => void;
  create: () => void;
  isPending: boolean;
}) {
  return (
    <div className="animate-enter-up mx-auto max-w-4xl">
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-primary p-7 text-primary-foreground shadow-[6px_6px_0_hsl(33_91%_63%)] md:p-12">
        <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border-[24px] border-primary-foreground/10" />
        <div className="absolute -bottom-20 right-24 h-44 w-44 rounded-full border-[18px] border-secondary/30" />
        <div className="relative max-w-xl">
          <div className="font-mono-app text-[10px] uppercase tracking-[.2em] text-primary-foreground/70">First serve</div>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[.98] tracking-[-.06em] md:text-6xl">Your court starts here.</h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/80">Save a roster once. On tournament morning, see the six, the next sub, and who is actually available without rebuilding your board.</p>
          {showCreate ? (
            <div className="mt-7 flex max-w-md gap-2 rounded-xl bg-primary-foreground/10 p-2">
              <input data-testid="input-new-team-name-empty" autoFocus value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create(); }} placeholder="e.g. 16U Northside" className="min-w-0 flex-1 bg-transparent px-3 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50" />
              <button data-testid="button-create-team-empty" onClick={create} disabled={!newTeamName.trim() || isPending} className="button-snap rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-foreground disabled:opacity-50">{isPending ? 'Creating' : 'Create team'}</button>
            </div>
          ) : (
            <button data-testid="button-start-team" onClick={() => setShowCreate(true)} className="button-snap mt-7 flex items-center gap-2 rounded-lg bg-secondary px-4 py-3 text-sm font-bold text-foreground shadow-[3px_3px_0_hsl(205_35%_18%)] hover:bg-secondary/85"><Plus size={17} /> Create your first team</button>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          ['01', 'Save the roster', 'Names, numbers, roles, and match notes stay ready.'],
          ['02', 'Set the six', 'Assign every court role with one clear view.'],
          ['03', 'Plan the next ball', 'Order the bench and name the first replacement.'],
        ].map(([number, title, text]) => (
          <div key={number} className="rounded-xl border border-border bg-card p-5">
            <div className="font-mono-app text-xs text-accent">{number}</div>
            <div className="mt-7 font-display font-bold">{title}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateTeamDialog({
  name,
  setName,
  onCreate,
  onClose,
  isPending,
}: {
  name: string;
  setName: (value: string) => void;
  onCreate: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <div className="border-b border-primary/20 bg-primary/5 px-5 py-4 md:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="font-display text-sm font-bold">New saved team</div>
          <div className="text-xs text-muted-foreground">Give this roster a name you will recognize on tournament morning.</div>
        </div>
        <input data-testid="input-new-team-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onCreate(); }} placeholder="e.g. 15U Seaside" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-56" />
        <button data-testid="button-create-team" onClick={onCreate} disabled={!name.trim() || isPending} className="button-snap h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{isPending ? 'Creating' : 'Create team'}</button>
        <button data-testid="button-cancel-create-team" onClick={onClose} className="button-snap rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground" aria-label="Cancel new team"><X size={17} /></button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-enter-up space-y-6">
      <div className="space-y-3">
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="h-11 w-64 animate-pulse rounded bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,.75fr)]">
        <div className="h-[470px] animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-[470px] animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    </div>
  );
}

function WorkspaceError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-destructive/25 bg-destructive/10 p-8 text-center">
      <AlertTriangle className="mx-auto text-destructive" size={26} />
      <h2 className="mt-4 font-display text-xl font-bold">The workspace is taking a timeout.</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">We could not reach your saved teams. Your lineup is not lost.</p>
      <button data-testid="button-retry-teams" onClick={onRetry} className="button-snap mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><RefreshCw size={15} /> Try again</button>
    </div>
  );
}

function SummaryStrip({ summary, fallback }: { summary?: { totalPlayers: number; availablePlayers: number; startersAssigned: number; benchPlayers: number }; fallback: Team }) {
  const values = [
    ['Roster', summary?.totalPlayers ?? fallback.players.length, 'players'],
    ['Available', summary?.availablePlayers ?? fallback.players.filter((player) => player.available).length, 'match-ready'],
    ['On court', summary?.startersAssigned ?? fallback.lineup.positions.filter((assignment) => assignment.playerId).length, 'of 6 assigned'],
    ['Bench order', fallback.lineup.benchOrder.length, 'cycling'],
  ];
  return (
    <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-4">
      {values.map(([label, value, detail], index) => (
        <div key={label} data-testid={`summary-${String(label).toLowerCase().replace(' ', '-')}`} className={`px-4 py-4 md:px-5 ${index ? 'border-l border-border' : ''}`}>
          <div className="font-mono-app text-[10px] uppercase tracking-[.14em] text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-[-.04em]">{value}</span>
            <span className="text-[11px] text-muted-foreground">{detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CourtBoard({ team, onSave }: { team: Team; onSave: (team: Team) => void }) {
  const starters = useMemo(() => new Set(team.lineup.positions.flatMap((assignment) => assignment.playerId ? [assignment.playerId] : [])), [team.lineup.positions]);
  const availablePlayers = team.players.filter((player) => player.available);
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const assign = (position: CourtPosition, playerId: string) => {
    const nextPositions = team.lineup.positions.map((assignment) => assignment.position === position ? { ...assignment, playerId: playerId || null } : assignment);
    const duplicate = nextPositions.find((assignment) => assignment.position !== position && assignment.playerId === playerId);
    if (duplicate && playerId) {
      duplicate.playerId = null;
    }
    onSave({ ...team, lineup: { ...team.lineup, positions: nextPositions } });
  };

  return (
    <section className="panel-lift mobile-card rounded-2xl border border-card-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><Volleyball size={15} /></span>
            <h3 className="font-display text-lg font-bold tracking-[-.03em]">Starting six</h3>
          </div>
          <p className="mt-1 pl-9 text-xs text-muted-foreground">Tap a position to assign a match-ready player.</p>
        </div>
        <div className="rounded-md bg-muted px-2.5 py-1.5 font-mono-app text-[10px] text-muted-foreground">{starters.size}/6 filled</div>
      </div>
      <div className="mt-5 min-w-0 overflow-hidden rounded-xl border-4 border-secondary/70 bg-primary p-3 shadow-inner md:p-5">
        <div className="mb-3 flex items-center justify-between px-1 font-mono-app text-[9px] uppercase tracking-[.18em] text-primary-foreground/65"><span>Net</span><span>Attack line</span></div>
        <div className="court-surface relative grid min-w-0 max-w-full grid-cols-3 gap-2 rounded-lg p-2 md:gap-3 md:p-4">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t-2 border-dashed border-primary-foreground/45" />
          {POSITIONS.map((position) => {
            const assignment = team.lineup.positions.find((item) => item.position === position.key);
            const player = assignment?.playerId ? playerById.get(assignment.playerId) : undefined;
            return (
              <div key={position.key} className="court-cell relative z-10 min-w-0">
                <label className="mb-1.5 block font-mono-app text-[9px] font-medium uppercase tracking-[.1em] text-primary-foreground/80">{position.short} <span className="hidden md:inline">· {position.label}</span></label>
                <div className={`min-w-0 overflow-hidden rounded-lg border p-2 transition-transform duration-200 ${player ? 'border-secondary bg-card' : 'border-dashed border-primary-foreground/45 bg-primary-foreground/10'}`}>
                  <select data-testid={`select-position-${position.key}`} value={assignment?.playerId ?? ''} onChange={(event) => assign(position.key, event.target.value)} className={`court-select block min-w-0 w-full appearance-none bg-transparent text-xs font-semibold outline-none ${player ? 'text-foreground' : 'text-primary-foreground/80'}`}>
                    <option value="">Unassigned</option>
                    {availablePlayers.map((option) => <option key={option.id} value={option.id}>{option.jerseyNumber ? `#${option.jerseyNumber} ` : ''}{option.name}</option>)}
                  </select>
                  <div className="mt-1 flex items-center justify-between">
                    <span className={`truncate text-[10px] ${player ? 'text-muted-foreground' : 'text-primary-foreground/55'}`}>{player ? player.role : 'Choose player'}</span>
                    {player ? <Check size={12} className="shrink-0 text-primary" /> : <Plus size={12} className="shrink-0 text-primary-foreground/60" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-[10px] text-primary-foreground/65">
          <span>Sideline</span><span>{availablePlayers.length} available today</span><span>Sideline</span>
        </div>
      </div>
    </section>
  );
}

function BenchPlan({ team, onSave }: { team: Team; onSave: (team: Team) => void }) {
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const starterIds = new Set(team.lineup.positions.flatMap((assignment) => assignment.playerId ? [assignment.playerId] : []));
  const bench = team.lineup.benchOrder.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
  const benchCandidates = team.players.filter((player) => player.available && !starterIds.has(player.id) && !team.lineup.benchOrder.includes(player.id));

  const updateBench = (benchOrder: string[], benchReplacements = team.lineup.benchReplacements) =>
    onSave({ ...team, lineup: { ...team.lineup, benchOrder, benchReplacements } });
  const move = (index: number, direction: -1 | 1) => {
    const next = [...team.lineup.benchOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateBench(next);
  };
  const add = (id: string) => {
    if (!id) return;
    const nextOrder = [...team.lineup.benchOrder, id];
    const existingTarget = team.lineup.benchReplacements?.find((replacement) => replacement.playerId === id);
    const nextReplacements = existingTarget
      ? team.lineup.benchReplacements
      : [...(team.lineup.benchReplacements ?? []), { playerId: id, position: POSITIONS[(nextOrder.length - 1) % POSITIONS.length].key }];
    updateBench(nextOrder, nextReplacements);
  };
  const remove = (id: string) => updateBench(
    team.lineup.benchOrder.filter((item) => item !== id),
    (team.lineup.benchReplacements ?? []).filter((replacement) => replacement.playerId !== id),
  );
  const setReplacement = (playerId: string, position: CourtPosition) => {
    const replacements = [...(team.lineup.benchReplacements ?? [])];
    const existingIndex = replacements.findIndex((replacement) => replacement.playerId === playerId);
    if (existingIndex >= 0) {
      replacements[existingIndex] = { playerId, position };
    } else {
      replacements.push({ playerId, position });
    }
    updateBench(team.lineup.benchOrder, replacements);
  };

  return (
    <section className="panel-lift mobile-card rounded-2xl border border-card-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground"><ArrowDown size={15} /></span>
            <h3 className="font-display text-lg font-bold tracking-[-.03em]">Bench rotation</h3>
          </div>
          <p className="mt-1 pl-9 text-xs text-muted-foreground">The order is the plan. First name in, first name out.</p>
        </div>
        <span className="rounded-md bg-secondary/20 px-2.5 py-1.5 font-mono-app text-[10px] font-medium text-foreground">{bench.length} queued</span>
      </div>
      <div className="mt-5 space-y-2">
        {bench.length ? bench.map((player, index) => {
           const target = POSITIONS.find((position) => position.key === team.lineup.benchReplacements?.find((replacement) => replacement.playerId === player.id)?.position) ?? POSITIONS[index % POSITIONS.length];
           const targetStarter = team.lineup.positions.find((assignment) => assignment.position === target.key)?.playerId;
           const targetStarterName = targetStarter ? playerById.get(targetStarter)?.name : undefined;
          return (
            <div key={player.id} data-testid={`bench-row-${player.id}`} className="group grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] gap-x-2 gap-y-2 overflow-hidden rounded-lg border border-border bg-background px-2.5 py-2 transition-colors hover:border-primary/40 sm:flex sm:items-center">
              <GripVertical size={15} className="text-muted-foreground/50" />
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono-app text-[10px] font-medium">{String(index + 1).padStart(2, '0')}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold"><span className="truncate">{player.name}</span>{player.available ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : <span className="h-1.5 w-1.5 rounded-full bg-destructive" />}</div>
                 <div className="mt-1 flex flex-wrap items-center gap-2">
                   <span className="font-mono-app text-[9px] uppercase tracking-[.08em] text-muted-foreground">Next in · replaces</span>
                   <select
                     data-testid={`select-bench-replacement-${player.id}`}
                     value={target.key}
                     onChange={(event) => setReplacement(player.id, event.target.value as CourtPosition)}
                     className="bench-select block min-w-0 w-full max-w-full rounded border border-border bg-card px-1.5 py-1 text-[10px] font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-auto"
                   >
                     {POSITIONS.map((position) => {
                       const starterId = team.lineup.positions.find((assignment) => assignment.position === position.key)?.playerId;
                       const starterName = starterId ? playerById.get(starterId)?.name : undefined;
                       return <option key={position.key} value={position.key}>{position.label}{starterName ? ` · ${starterName}` : ''}</option>;
                     })}
                   </select>
                   {targetStarterName && <span className="sr-only">{targetStarterName}</span>}
                 </div>
              </div>
                <div className="col-span-3 flex items-center justify-end gap-0.5 sm:col-span-1">
                <button data-testid={`button-bench-up-${player.id}`} onClick={() => move(index, -1)} disabled={index === 0} className="button-snap rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25" aria-label={`Move ${player.name} up`}><ChevronUp size={15} /></button>
                <button data-testid={`button-bench-down-${player.id}`} onClick={() => move(index, 1)} disabled={index === bench.length - 1} className="button-snap rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25" aria-label={`Move ${player.name} down`}><ChevronDown size={15} /></button>
                <button data-testid={`button-remove-bench-${player.id}`} onClick={() => remove(player.id)} className="button-snap rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${player.name} from bench`}><X size={15} /></button>
              </div>
            </div>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">No bench order yet. Add your first replacement below.</div>
        )}
      </div>
      {benchCandidates.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <select data-testid="select-add-bench" defaultValue="" onChange={(event) => { add(event.target.value); event.target.value = ''; }} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring">
            <option value="">Add available player to bench…</option>
            {benchCandidates.map((player) => <option key={player.id} value={player.id}>{player.name}{player.available ? '' : ' · unavailable'}</option>)}
          </select>
          <span className="font-mono-app text-[9px] uppercase tracking-[.12em] text-muted-foreground">Drag-free order</span>
        </div>
      )}
    </section>
  );
}

function ShareLineupButton({ team }: { team: Team }) {
  const [state, setState] = useState<'idle' | 'working' | 'shared' | 'downloaded' | 'error'>('idle');

  const exportLineup = async () => {
    if (state === 'working') return;
    setState('working');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1500;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');

      const colors = {
        ink: '#173246',
        teal: '#216e67',
        orange: '#f6ad4f',
        paper: '#fbf8ef',
        muted: '#637078',
        line: '#d9d3c7',
        white: '#fffdf7',
      };
      context.fillStyle = colors.paper;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = colors.teal;
      context.fillRect(0, 0, canvas.width, 18);
      context.fillStyle = colors.ink;
      context.font = '700 58px "Arial", sans-serif';
      context.fillText(team.name, 72, 115);
      context.fillStyle = colors.muted;
      context.font = '500 22px "Arial", sans-serif';
      context.fillText('SIDELINE  ·  STARTING SIX + BENCH PLAN', 75, 153);
      context.fillStyle = colors.orange;
      context.fillRect(72, 187, 1056, 4);

      const playerById = new Map(team.players.map((player) => [player.id, player]));
      const starterFor = (position: CourtPosition) => {
        const playerId = team.lineup.positions.find((assignment) => assignment.position === position)?.playerId;
        return playerId ? playerById.get(playerId) : undefined;
      };
      const fitText = (value: string, maxLength = 19) => value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

      context.fillStyle = colors.ink;
      context.font = '700 28px "Arial", sans-serif';
      context.fillText('STARTING SIX', 72, 245);
      const courtX = 72;
      const courtY = 270;
      const cardWidth = 328;
      const cardHeight = 150;
      const cardGap = 18;
      POSITIONS.forEach((position, index) => {
        const x = courtX + (index % 3) * (cardWidth + cardGap);
        const y = courtY + Math.floor(index / 3) * (cardHeight + cardGap);
        const player = starterFor(position.key);
        context.fillStyle = colors.teal;
        context.fillRect(x, y, cardWidth, cardHeight);
        context.fillStyle = colors.white;
        context.font = '500 18px "Arial", sans-serif';
        context.fillText(position.label.toUpperCase(), x + 20, y + 32);
        context.font = '700 27px "Arial", sans-serif';
        context.fillText(player ? fitText(player.name) : 'Unassigned', x + 20, y + 76);
        context.font = '500 16px "Arial", sans-serif';
        context.fillText(player ? fitText(player.role, 22) : 'No player assigned', x + 20, y + 105);
        context.font = '500 17px "Arial", sans-serif';
        context.fillText(player?.jerseyNumber ? `Jersey #${player.jerseyNumber}` : 'No jersey #', x + 20, y + 132);
      });

      const benchTop = 650;
      context.fillStyle = colors.ink;
      context.font = '700 28px "Arial", sans-serif';
      context.fillText('BENCH ROTATION', 72, benchTop);
      context.fillStyle = colors.muted;
      context.font = '500 19px "Arial", sans-serif';
      context.fillText('Queue order · each player has a named replacement target', 72, benchTop + 34);
      const bench = team.lineup.benchOrder.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
      if (!bench.length) {
        context.fillStyle = colors.white;
        context.fillRect(72, benchTop + 65, 1056, 86);
        context.strokeStyle = colors.line;
        context.strokeRect(72, benchTop + 65, 1056, 86);
        context.fillStyle = colors.muted;
        context.font = '500 22px "Arial", sans-serif';
        context.fillText('No bench players queued', 98, benchTop + 118);
      } else {
        bench.forEach((player, index) => {
          const y = benchTop + 65 + index * 82;
          const targetKey = team.lineup.benchReplacements?.find((replacement) => replacement.playerId === player.id)?.position ?? POSITIONS[index % POSITIONS.length].key;
          const target = POSITIONS.find((position) => position.key === targetKey) ?? POSITIONS[index % POSITIONS.length];
          const starter = starterFor(target.key);
          context.fillStyle = colors.white;
          context.fillRect(72, y, 1056, 68);
          context.strokeStyle = colors.line;
          context.strokeRect(72, y, 1056, 68);
          context.fillStyle = colors.orange;
          context.fillRect(72, y, 62, 68);
          context.fillStyle = colors.ink;
          context.font = '700 23px "Arial", sans-serif';
          context.fillText(String(index + 1).padStart(2, '0'), 88, y + 43);
          context.font = '700 24px "Arial", sans-serif';
          context.fillText(fitText(player.name, 24), 164, y + 30);
          context.fillStyle = colors.muted;
          context.font = '500 17px "Arial", sans-serif';
          context.fillText(`plays ${target.label}${starter ? ` · ${fitText(starter.name, 18)}` : ''}`, 164, y + 53);
          context.font = '500 15px "Arial", sans-serif';
          context.fillText(fitText(player.role, 27), 164, y + 75);
        });
      }

      context.fillStyle = colors.muted;
      context.font = '500 17px "Arial", sans-serif';
      context.fillText('Generated with Sideline', 72, 1435);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not create image');
      const file = new File([blob], `${team.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-lineup.png`, { type: 'image/png' });
      const canShareFile = typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }));
      if (canShareFile) {
        await navigator.share({ title: `${team.name} lineup`, text: 'Starting six and bench rotation', files: [file] });
        setState('shared');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
        setState('downloaded');
      }
      window.setTimeout(() => setState('idle'), 2400);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
      window.setTimeout(() => setState('idle'), 2400);
    }
  };

  const label = state === 'working' ? 'Preparing…' : state === 'shared' ? 'Shared' : state === 'downloaded' ? 'Image saved' : state === 'error' ? 'Try again' : 'Share lineup';
  return (
    <button data-testid="button-share-lineup" onClick={() => void exportLineup()} disabled={state === 'working'} className="button-snap inline-flex h-10 items-center gap-2 rounded-lg bg-secondary px-3 text-xs font-bold text-foreground shadow-[2px_2px_0_hsl(205_35%_18%)] hover:bg-secondary/85 disabled:cursor-wait disabled:opacity-70" title="Export the starting six and bench as an image">
      {state === 'downloaded' ? <Download size={15} /> : <Share2 size={15} />} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ShareLinkButton({ team }: { team: Team }) {
  const [state, setState] = useState<'idle' | 'working' | 'shared' | 'copied' | 'error'>('idle');

  const shareLink = async () => {
    if (state === 'working') return;
    setState('working');
    const url = viewOnlyUrl(team.id);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: `${team.name} lineup`,
          text: 'View the starting six and bench rotation',
          url,
        });
        setState('shared');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setState('copied');
      } else {
        const input = document.createElement('textarea');
        input.value = url;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Could not copy link');
        setState('copied');
      }
      window.setTimeout(() => setState('idle'), 2400);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
      window.setTimeout(() => setState('idle'), 2400);
    }
  };

  const label = state === 'working' ? 'Preparing…' : state === 'shared' ? 'Shared' : state === 'copied' ? 'Link copied' : state === 'error' ? 'Try again' : 'Share link';
  return (
    <button data-testid="button-share-lineup-link" onClick={() => void shareLink()} disabled={state === 'working'} className="button-snap inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground hover:border-primary hover:text-primary disabled:cursor-wait disabled:opacity-70" title="Share a view-only lineup link">
      <Link2 size={15} /> <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function RosterPanel({ team, onSave }: { team: Team; onSave: (team: Team) => void }) {
  const [name, setName] = useState('');
  const [jersey, setJersey] = useState('');
  const [role, setRole] = useState<PlayerRole>(PlayerRoleValues.Outside_Hitter);
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    const players = team.players.map((player) => player.id === id ? { ...player, ...updates } : player);
    const lineup = updates.available === false
      ? {
          ...team.lineup,
          positions: team.lineup.positions.map((assignment) => assignment.playerId === id ? { ...assignment, playerId: null } : assignment),
          benchOrder: team.lineup.benchOrder.filter((playerId) => playerId !== id),
          benchReplacements: (team.lineup.benchReplacements ?? []).filter((replacement) => replacement.playerId !== id),
        }
      : team.lineup;
    onSave({ ...team, players, lineup });
  };
  const addPlayer = () => {
    if (!name.trim()) return;
    const player: Player = {
      id: `player-${Date.now()}`,
      name: name.trim(),
      jerseyNumber: jersey ? Number(jersey) : null,
      role,
      available: true,
      note: note.trim() || null,
    };
    onSave({ ...team, players: [...team.players, player] });
    setName('');
    setJersey('');
    setNote('');
  };
  const removePlayer = (id: string) => {
    const nextLineup = {
      ...team.lineup,
      positions: team.lineup.positions.map((assignment) => assignment.playerId === id ? { ...assignment, playerId: null } : assignment),
      benchOrder: team.lineup.benchOrder.filter((playerId) => playerId !== id),
      benchReplacements: (team.lineup.benchReplacements ?? []).filter((replacement) => replacement.playerId !== id),
    };
    onSave({ ...team, players: team.players.filter((player) => player.id !== id), lineup: nextLineup });
  };
  const saveEdit = (player: Player) => {
    updatePlayer(player.id, { name: name.trim() || player.name, jerseyNumber: jersey ? Number(jersey) : null, role, note: note.trim() || null });
    setEditingId(null);
  };
  const beginEdit = (player: Player) => {
    setEditingId(player.id);
    setName(player.name);
    setJersey(player.jerseyNumber?.toString() ?? '');
    setRole(player.role);
    setNote(player.note ?? '');
  };

  return (
    <section className="panel-lift rounded-2xl border border-card-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground"><Users size={15} /></span>
            <h3 className="font-display text-lg font-bold tracking-[-.03em]">Roster</h3>
          </div>
          <p className="mt-1 pl-9 text-xs text-muted-foreground">Availability here controls who appears on court.</p>
        </div>
        <button data-testid="button-toggle-roster-form" onClick={() => setExpanded(!expanded)} className="button-snap rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={expanded ? 'Collapse roster editor' : 'Expand roster editor'}>
          {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {team.players.length ? team.players.map((player) => {
          const isStarter = team.lineup.positions.some((assignment) => assignment.playerId === player.id);
          const isBench = team.lineup.benchOrder.includes(player.id);
          return (
            <div key={player.id} data-testid={`roster-player-${player.id}`} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${player.available ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{player.jerseyNumber ?? initials(player.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-semibold ${player.available ? '' : 'text-muted-foreground line-through decoration-destructive/70'}`}>{player.name}</span>
                    {isStarter && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono-app text-[8px] uppercase tracking-[.08em] text-primary">Starter</span>}
                    {!isStarter && isBench && <span className="rounded bg-secondary/30 px-1.5 py-0.5 font-mono-app text-[8px] uppercase tracking-[.08em]">Bench</span>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{player.role}{player.note ? ` · ${player.note}` : ''}</div>
                </div>
                <button data-testid={`button-toggle-availability-${player.id}`} onClick={() => updatePlayer(player.id, { available: !player.available })} className={`button-snap rounded-full px-2.5 py-1 font-mono-app text-[9px] font-medium uppercase tracking-[.08em] ${player.available ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}>{player.available ? 'Available' : 'Out'}</button>
                <button data-testid={`button-edit-player-${player.id}`} onClick={() => beginEdit(player)} className="button-snap rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Edit ${player.name}`}><Pencil size={14} /></button>
                <button data-testid={`button-delete-player-${player.id}`} onClick={() => removePlayer(player.id)} className="button-snap rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${player.name}`}><Trash2 size={14} /></button>
              </div>
              {editingId === player.id && (
                <PlayerFields name={name} setName={setName} jersey={jersey} setJersey={setJersey} role={role} setRole={setRole} note={note} setNote={setNote} onSubmit={() => saveEdit(player)} onCancel={() => setEditingId(null)} submitLabel="Save player" />
              )}
            </div>
          );
        }) : <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center text-xs text-muted-foreground">A blank roster is fine for now. Add the first player below.</div>}
      </div>
      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 font-mono-app text-[10px] uppercase tracking-[.15em] text-muted-foreground">{editingId ? 'Edit player' : 'Add player'}</div>
          <PlayerFields name={name} setName={setName} jersey={jersey} setJersey={setJersey} role={role} setRole={setRole} note={note} setNote={setNote} onSubmit={editingId ? () => { const player = team.players.find((item) => item.id === editingId); if (player) saveEdit(player); } : addPlayer} onCancel={() => { setName(''); setJersey(''); setNote(''); setEditingId(null); }} submitLabel={editingId ? 'Save player' : 'Add to roster'} />
        </div>
      )}
    </section>
  );
}

function PlayerFields({
  name,
  setName,
  jersey,
  setJersey,
  role,
  setRole,
  note,
  setNote,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  name: string;
  setName: (value: string) => void;
  jersey: string;
  setJersey: (value: string) => void;
  role: PlayerRole;
  setRole: (value: PlayerRole) => void;
  note: string;
  setNote: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-lg bg-muted/55 p-3 sm:grid-cols-2">
      <input data-testid="input-player-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Player name" className="rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring sm:col-span-2" />
      <input data-testid="input-player-jersey" value={jersey} onChange={(event) => setJersey(event.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="Jersey #" className="rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring" />
      <select data-testid="select-player-role" value={role} onChange={(event) => setRole(event.target.value as PlayerRole)} className="rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring">{ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <input data-testid="input-player-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Match note (optional)" className="rounded-md border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring sm:col-span-2" />
      <div className="flex gap-2 sm:col-span-2">
        <button data-testid="button-submit-player" onClick={onSubmit} disabled={!name.trim()} className="button-snap flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-45">{submitLabel}</button>
        <button data-testid="button-cancel-player" onClick={onCancel} className="button-snap rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}

export default App;