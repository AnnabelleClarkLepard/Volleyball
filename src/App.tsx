import {
  ChevronDown,
  ChevronUp,
  Download,
  Link2,
  Pencil,
  Plus,
  WandSparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type CourtPosition =
  | 'front-left'
  | 'front-middle'
  | 'front-right'
  | 'back-left'
  | 'back-middle'
  | 'back-right';

const POSITIONS: Array<{ key: CourtPosition; label: string; short: string }> = [
  { key: 'front-left', label: 'Front Left', short: 'FL' },
  { key: 'front-middle', label: 'Front Middle', short: 'FM' },
  { key: 'front-right', label: 'Front Right', short: 'FR' },
  { key: 'back-left', label: 'Back Left', short: 'BL' },
  { key: 'back-middle', label: 'Back Middle', short: 'BM' },
  { key: 'back-right', label: 'Back Right', short: 'BR' },
];

const COURT_PAIRS: Array<[CourtPosition, CourtPosition]> = [
  ['front-left', 'back-right'],
  ['front-middle', 'back-middle'],
  ['front-right', 'back-left'],
];

type Role = 'Setter' | 'Outside Hitter' | 'Middle';

type Player = {
  id: string;
  name: string;
  role: Role;
  available: boolean;
  note?: string | null;
};

type LineupAssignment = { position: CourtPosition; playerId: string | null };

type Team = {
  id: string;
  name: string;
  updatedAt: string;
  players: Player[];
  lineup: {
    positions: LineupAssignment[];
    benchOrder: string[];
    benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }>;
  };
};

const ROLE_OPTIONS: Role[] = ['Setter', 'Outside Hitter', 'Middle'];

const normalizeRole = (role?: string): Role => {
  if (ROLE_OPTIONS.includes(role as Role)) return role as Role;
  return 'Outside Hitter';
};

const roleFitScore = (role: Role | string, position: CourtPosition): number => {
  const normalizedRole = normalizeRole(role);
  const scores: Record<Role, Record<CourtPosition, number>> = {
    Setter: {
      'front-left': 4,
      'front-middle': 10,
      'front-right': 4,
      'back-left': 6,
      'back-middle': 10,
      'back-right': 6,
    },
    'Outside Hitter': {
      'front-left': 9,
      'front-middle': 4,
      'front-right': 9,
      'back-left': 8,
      'back-middle': 4,
      'back-right': 8,
    },
    Middle: {
      'front-left': 5,
      'front-middle': 10,
      'front-right': 5,
      'back-left': 2,
      'back-middle': 10,
      'back-right': 2,
    },
  };

  return scores[normalizedRole]?.[position] ?? 0;
};

const pairAwareScore = (role: Role | string, position: CourtPosition): number => {
  const opposite = COURT_PAIRS.find(([a, b]) => a === position || b === position)?.find((side) => side !== position) ?? position;
  return roleFitScore(role, position) + roleFitScore(role, opposite) * 0.55;
};

const emptyLineup = () => ({
  positions: POSITIONS.map(({ key }) => ({ position: key, playerId: null })),
  benchOrder: [],
  benchReplacements: [],
});

const coerceLineup = (lineup?: Partial<Team['lineup']>): Team['lineup'] => {
  const safeLineup = lineup && typeof lineup === 'object' ? lineup : {};
  const positions = Array.isArray(safeLineup.positions) && safeLineup.positions.length ? safeLineup.positions : emptyLineup().positions;

  return {
    positions: positions.map((assignment, index) => ({
      position: (assignment as LineupAssignment)?.position ?? POSITIONS[index]?.key ?? 'front-left',
      playerId: (assignment as LineupAssignment)?.playerId ?? null,
    })),
    benchOrder: Array.isArray(safeLineup.benchOrder) ? safeLineup.benchOrder.filter((id): id is string => typeof id === 'string') : [],
    benchReplacements: Array.isArray(safeLineup.benchReplacements)
      ? safeLineup.benchReplacements.filter(
          (entry): entry is { playerId: string; replacesPlayerId: string | null } =>
            !!entry && typeof entry === 'object' && typeof (entry as { playerId?: unknown }).playerId === 'string',
        )
      : [],
  };
};

const hydrateTeam = (team: Partial<Team>): Team => ({
  id: typeof team.id === 'string' ? team.id : `team-${Date.now()}`,
  name: typeof team.name === 'string' && team.name.trim() ? team.name : 'Untitled team',
  updatedAt: typeof team.updatedAt === 'string' ? team.updatedAt : new Date().toISOString(),
  players: Array.isArray(team.players)
    ? team.players.map((player) => ({
        id: typeof player?.id === 'string' ? player.id : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: typeof player?.name === 'string' && player.name.trim() ? player.name : 'Unnamed player',
        role: normalizeRole(player?.role),
        available: Boolean(player?.available),
        note: typeof player?.note === 'string' ? player.note : null,
      }))
    : [],
  lineup: coerceLineup(team.lineup),
});

const initialTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Bumpin Uglies',
    updatedAt: new Date().toISOString(),
    players: [
      { id: 'p1', name: 'Quincy Ing', role: 'Setter', available: true },
      { id: 'p2', name: 'Annabelle Clark-Lepard', role: 'Outside Hitter', available: true },
      { id: 'p3', name: 'Aidan Bell', role: 'Outside Hitter', available: true },
      { id: 'p4', name: 'Erica Mandel', role: 'Middle', available: true },
      { id: 'p5', name: 'Naomi Ing', role: 'Setter', available: true },
      { id: 'p6', name: 'Christian Saldanha', role: 'Middle', available: true },
      { id: 'p7', name: 'Kent Arkell', role: 'Outside Hitter', available: true },
      { id: 'p8', name: 'Haris Lutvica', role: 'Middle', available: true },
      { id: 'p9', name: 'Trevor Rice', role: 'Outside Hitter', available: true },
    ],
    lineup: {
      positions: [
        { position: 'front-left', playerId: 'p5' },
        { position: 'front-middle', playerId: 'p2' },
        { position: 'front-right', playerId: 'p6' },
        { position: 'back-left', playerId: 'p8' },
        { position: 'back-middle', playerId: 'p1' },
        { position: 'back-right', playerId: 'p4' },
      ],
      benchOrder: [],
      benchReplacements: [],
    },
  },
];

const STORAGE_KEY = 'volleyball-lineup-planner-teams';

const formatDate = (value?: string) => {
  if (!value) return 'Not saved yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently updated' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '—';

function App() {
  const [teams, setTeams] = useState<Team[]>(() => {
    if (typeof window === 'undefined') return initialTeams;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialTeams;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return initialTeams;
      return parsed.map((team) => hydrateTeam(team as Partial<Team>));
    } catch {
      return initialTeams;
    }
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    if (typeof window === 'undefined') return initialTeams[0]?.id ?? '';
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialTeams[0]?.id ?? '';
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return initialTeams[0]?.id ?? '';
      return hydrateTeam(parsed[0] as Partial<Team>).id;
    } catch {
      return initialTeams[0]?.id ?? '';
    }
  });
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [sharedRotation, setSharedRotation] = useState<{
    teamName: string;
    players: Player[];
    lineup: { positions: LineupAssignment[]; benchOrder: string[]; benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }> };
  } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  }, [teams]);

  useEffect(() => {
    if (!teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(teams[0]?.id ?? '');
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSharedRotation(null);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const raw = params.get('view');
    if (!raw) {
      setSharedRotation(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{
        teamName: string;
        players: Player[];
        lineup: { positions: LineupAssignment[]; benchOrder: string[]; benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }> };
      }>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.players) || !parsed.lineup || !Array.isArray(parsed.lineup.positions)) {
        setSharedRotation(null);
        return;
      }

      setSharedRotation({
        teamName: typeof parsed.teamName === 'string' && parsed.teamName.trim() ? parsed.teamName : 'Volleyball lineup',
        players: parsed.players.map((player) => ({
          id: typeof player?.id === 'string' ? player.id : `player-${Math.random().toString(16).slice(2)}`,
          name: typeof player?.name === 'string' && player.name.trim() ? player.name : 'Unnamed player',
          role: normalizeRole(player?.role),
          available: Boolean(player?.available),
          note: typeof player?.note === 'string' ? player.note : null,
        })),
        lineup: coerceLineup(parsed.lineup),
      });
    } catch {
      setSharedRotation(null);
    }
  }, []);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;
  const [suggestionSeed, setSuggestionSeed] = useState(0);

  useEffect(() => {
    setSuggestionSeed(0);
  }, [selectedTeamId]);

  const rotationSuggestion = useMemo(() => {
    if (!selectedTeam) return null;
    return generateSuggestions(selectedTeam, suggestionSeed)[0] ?? null;
  }, [selectedTeam, suggestionSeed]);

  const clearSharedRotation = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url);
    setSharedRotation(null);
  };

  const updateTeam = (next: Team) => {
    setTeams((current) => current.map((team) => (team.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : team)));
  };

  const handleCreateTeam = () => {
    const name = newTeamName.trim();
    if (!name) return;
    const team: Team = {
      id: `team-${Date.now()}`,
      name,
      updatedAt: new Date().toISOString(),
      players: [],
      lineup: emptyLineup(),
    };
    setTeams((current) => [team, ...current]);
    setSelectedTeamId(team.id);
    setShowCreate(false);
    setNewTeamName('');
  };

  const handleDeleteTeam = () => {
    if (!selectedTeam) return;
    if (!window.confirm(`Delete ${selectedTeam.name}? This cannot be undone.`)) return;
    setTeams((current) => current.filter((team) => team.id !== selectedTeam.id));
  };

  const onAssignPlayerToPosition = (position: CourtPosition, playerId: string) => {
    if (!selectedTeam) return;

    const nextPositions = selectedTeam.lineup.positions.map((assignment) =>
      assignment.position === position ? { ...assignment, playerId: playerId || null } : assignment,
    );

    const used = new Set<string>();
    for (const assignment of nextPositions) {
      if (!assignment.playerId) continue;
      if (used.has(assignment.playerId)) {
        const first = nextPositions.find(
          (entry) => entry.playerId === assignment.playerId && entry.position !== position,
        );
        if (first) first.playerId = null;
      }
      used.add(assignment.playerId);
    }

    updateTeam({ ...selectedTeam, lineup: { ...selectedTeam.lineup, positions: nextPositions } });
  };

  const onAddBenchPlayer = (playerId: string) => {
    if (!selectedTeam || !playerId) return;

    const isOnCourt = selectedTeam.lineup.positions.some((assignment) => assignment.playerId === playerId);
    const isAlreadyBenched = selectedTeam.lineup.benchOrder.includes(playerId);
    if (isOnCourt || isAlreadyBenched) return;

    const nextBench = [...selectedTeam.lineup.benchOrder, playerId];
    const starters = selectedTeam.lineup.positions
      .map((assignment) => assignment.playerId)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !selectedTeam.lineup.benchReplacements.some((entry) => entry.replacesPlayerId === id));

    const nextReplacements = selectedTeam.lineup.benchReplacements.some((entry) => entry.playerId === playerId)
      ? selectedTeam.lineup.benchReplacements
      : [
          ...selectedTeam.lineup.benchReplacements,
          { playerId, replacesPlayerId: starters[0] ?? null },
        ];

    updateTeam({ ...selectedTeam, lineup: { ...selectedTeam.lineup, benchOrder: nextBench, benchReplacements: nextReplacements } });
  };

  const onSetBenchReplacement = (playerId: string, replacesPlayerId: string | null) => {
    if (!selectedTeam) return;
    const replacements = [...selectedTeam.lineup.benchReplacements];
    const index = replacements.findIndex((entry) => entry.playerId === playerId);
    if (index >= 0) replacements[index] = { playerId, replacesPlayerId };
    else replacements.push({ playerId, replacesPlayerId });
    updateTeam({ ...selectedTeam, lineup: { ...selectedTeam.lineup, benchReplacements: replacements } });
  };

  const onMoveBench = (index: number, direction: -1 | 1) => {
    if (!selectedTeam) return;
    const next = [...selectedTeam.lineup.benchOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateTeam({ ...selectedTeam, lineup: { ...selectedTeam.lineup, benchOrder: next } });
  };

  const onRemoveBench = (playerId: string) => {
    if (!selectedTeam) return;
    updateTeam({
      ...selectedTeam,
      lineup: {
        ...selectedTeam.lineup,
        benchOrder: selectedTeam.lineup.benchOrder.filter((id) => id !== playerId),
        benchReplacements: selectedTeam.lineup.benchReplacements.filter((entry) => entry.playerId !== playerId),
      },
    });
  };

  const addPlayer = (player: Player) => {
    if (!selectedTeam) return;
    updateTeam({ ...selectedTeam, players: [...selectedTeam.players, player] });
  };

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    if (!selectedTeam) return;
    const players = selectedTeam.players.map((player) => (player.id === id ? { ...player, ...updates } : player));
    updateTeam({
      ...selectedTeam,
      players,
      lineup:
        updates.available === false
          ? {
              ...selectedTeam.lineup,
              positions: selectedTeam.lineup.positions.map((assignment) =>
                assignment.playerId === id ? { ...assignment, playerId: null } : assignment,
              ),
              benchOrder: selectedTeam.lineup.benchOrder.filter((playerId) => playerId !== id),
              benchReplacements: selectedTeam.lineup.benchReplacements.filter((entry) => entry.playerId !== id),
            }
          : selectedTeam.lineup,
    });
  };

  const removePlayer = (id: string) => {
    if (!selectedTeam) return;
    updateTeam({
      ...selectedTeam,
      players: selectedTeam.players.filter((player) => player.id !== id),
      lineup: {
        ...selectedTeam.lineup,
        positions: selectedTeam.lineup.positions.map((assignment) => (assignment.playerId === id ? { ...assignment, playerId: null } : assignment)),
        benchOrder: selectedTeam.lineup.benchOrder.filter((playerId) => playerId !== id),
        benchReplacements: selectedTeam.lineup.benchReplacements.filter((entry) => entry.playerId !== id),
      },
    });
  };

  const summary = useMemo(() => {
    if (!selectedTeam) return null;
    return {
      totalPlayers: selectedTeam.players.length,
      availablePlayers: selectedTeam.players.filter((player) => player.available).length,
      startersAssigned: selectedTeam.lineup.positions.filter((assignment) => assignment.playerId).length,
      benchPlayers: selectedTeam.lineup.benchOrder.length,
    };
  }, [selectedTeam]);

  const applySuggestedRotation = (suggestedLineup: Team['lineup']) => {
    if (!selectedTeam) return;
    updateTeam({ ...selectedTeam, lineup: suggestedLineup });
  };

  const handleUseSuggestion = () => {
    if (!selectedTeam) return;
    const nextSuggestion = generateSuggestions(selectedTeam, suggestionSeed)[0] ?? null;
    if (!nextSuggestion) return;
    applySuggestedRotation(nextSuggestion);
    setSuggestionSeed((current) => current + 1);
  };

  if (sharedRotation) {
    return (
      <div className="app-shell share-shell">
        <main className="main-panel">
          <header className="topbar">
            <div>
              <div className="eyebrow">Shared rotation</div>
              <h1>{sharedRotation.teamName}</h1>
            </div>
            <div className="topbar-actions">
              <button className="button secondary" onClick={clearSharedRotation}>Back to planner</button>
            </div>
          </header>

          <div className="content-wrap">
            <ShareRotationCard
              teamName={sharedRotation.teamName}
              players={sharedRotation.players}
              lineup={sharedRotation.lineup}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="section-header">
          <span>Saved teams</span>
          <button className="ghost-button" onClick={() => setShowCreate(true)} aria-label="Create a new team">
            +
          </button>
        </div>

        <div className="team-list">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`team-item ${selectedTeam?.id === team.id ? 'active' : ''}`}
            >
              <button
                type="button"
                className="team-select"
                onClick={() => setSelectedTeamId(team.id)}
                aria-label={`Select ${team.name}`}
              >
                <div className="team-name-wrap">
                  <span className={`dot ${selectedTeam?.id === team.id ? 'active' : ''}`} />
                  <span>{team.name}</span>
                </div>
                <small>{formatDate(team.updatedAt)}</small>
              </button>
              <button
                type="button"
                className="team-delete-button"
                onClick={() => {
                  if (!window.confirm(`Delete ${team.name}? This cannot be undone.`)) return;
                  setTeams((current) => current.filter((item) => item.id !== team.id));
                  if (selectedTeamId === team.id) {
                    const nextTeam = teams.find((item) => item.id !== team.id) ?? null;
                    setSelectedTeamId(nextTeam?.id ?? '');
                  }
                }}
                aria-label={`Delete ${team.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-panel">
        {showCreate && (
          <div className="create-row">
            <input
              autoFocus
              value={newTeamName}
              placeholder="e.g. 15U Seaside"
              onChange={(event) => setNewTeamName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreateTeam();
              }}
            />
            <button className="button primary" onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
              Create team
            </button>
            <button
              className="button muted"
              onClick={() => {
                setShowCreate(false);
                setNewTeamName('');
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {selectedTeam ? (
          <div className="content-wrap">
            <div className="roster-header">
              <div className="roster-header-copy">
                <div className="eyebrow">Active roster</div>
                <h2>{selectedTeam.name}</h2>
                <p>Set the six, check availability, then make the bench order obvious.</p>
              </div>
              <div className="roster-header-actions">
                <div className="roster-header-date">Updated {formatDate(selectedTeam.updatedAt)}</div>
                <ShareControls team={selectedTeam} compact />
              </div>
            </div>

            <SummaryStrip summary={summary} team={selectedTeam} />

            <div className="board-grid">
              <div className="stack-col">
                <section className="lineup-card">
                  <div className="panel-header lineup-header">
                    <div className="header-row">
                      <h3>Lineup</h3>
                    </div>
                    {selectedTeam.players.filter((player) => player.available).length >= POSITIONS.length && rotationSuggestion && (
                      <button className="button secondary small-action" onClick={handleUseSuggestion} aria-label="Autosuggest lineup">
                        <WandSparkles size={14} aria-hidden="true" />
                        Autosuggest
                      </button>
                    )}
                  </div>
                  <div className="lineup-stack">
                    <CourtBoard
                      team={selectedTeam}
                      onAssign={onAssignPlayerToPosition}
                      onApplySuggestion={applySuggestedRotation}
                      suggestion={rotationSuggestion}
                      onUseSuggestion={handleUseSuggestion}
                    />
                    <BenchPlan
                      team={selectedTeam}
                      onAdd={onAddBenchPlayer}
                      onMove={onMoveBench}
                      onRemove={onRemoveBench}
                      onSetReplacement={onSetBenchReplacement}
                    />
                  </div>
                </section>
              </div>
              <RosterPanel team={selectedTeam} onAdd={addPlayer} onToggleAvailability={updatePlayer} onDelete={removePlayer} />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h2>Your court starts here.</h2>
            <button className="button primary" onClick={() => setShowCreate(true)}>
              Create your first team
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryStrip({ summary, team }: { summary: { totalPlayers: number; availablePlayers: number; startersAssigned: number; benchPlayers: number } | null; team: Team }) {
  const data = [
    ['Roster', summary?.totalPlayers ?? team.players.length, 'players'],
    ['Available', summary?.availablePlayers ?? team.players.filter((player) => player.available).length, 'match-ready'],
    ['On court', summary?.startersAssigned ?? team.lineup.positions.filter((assignment) => assignment.playerId).length, 'of 6 assigned'],
    ['Bench order', summary?.benchPlayers ?? team.lineup.benchOrder.length, 'cycling'],
  ];

  return (
    <div className="summary-strip">
      {data.map(([label, value, detail], index) => (
        <div key={label} className={`summary-card ${index ? 'with-border' : ''}`}>
          <div className="summary-label">{label}</div>
          <div className="summary-number">{String(value)}</div>
          <div className="summary-detail">{detail}</div>
        </div>
      ))}
    </div>
  );
}

function ShareControls({ team, compact = false }: { team: Team; compact?: boolean }) {
  const [status, setStatus] = useState('');

  const shareUrl = useMemo(() => {
    const payload = {
      teamName: team.name,
      players: team.players,
      lineup: team.lineup,
    };
    const params = new URLSearchParams({ view: JSON.stringify(payload) });
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }, [team]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus('View-only link copied.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setStatus('View-only link copied.');
    }
  };

  const exportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 760;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = '#f6f2ea';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#163b4a';
    context.font = '700 42px Arial';
    context.fillText(team.name, 64, 86);
    context.font = '500 20px Arial';
    context.fillStyle = '#53656d';
    context.fillText('Volleyball lineup rotation', 64, 120);

    const positions = [
      ['Front Left', 'front-left'],
      ['Front Middle', 'front-middle'],
      ['Front Right', 'front-right'],
      ['Back Left', 'back-left'],
      ['Back Middle', 'back-middle'],
      ['Back Right', 'back-right'],
    ] as const;

    const playerMap = new Map(team.players.map((player) => [player.id, player]));
    const startX = 80;
    const startY = 180;
    const cardWidth = 300;
    const cardHeight = 140;

    positions.forEach(([label, key], index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const x = startX + column * (cardWidth + 30);
      const y = startY + row * (cardHeight + 20);
      const assignment = team.lineup.positions.find((item) => item.position === key);
      const player = assignment?.playerId ? playerMap.get(assignment.playerId) : null;

      context.fillStyle = '#ffffff';
      context.strokeStyle = '#dfe3e7';
      context.lineWidth = 2;
      context.fillRect(x, y, cardWidth, cardHeight);
      context.strokeRect(x, y, cardWidth, cardHeight);

      context.fillStyle = '#43525e';
      context.font = '700 18px Arial';
      context.fillText(label, x + 20, y + 34);
      context.font = '700 28px Arial';
      context.fillStyle = '#163b4a';
      context.fillText(player?.name ?? 'Open', x + 20, y + 78, 240);
      context.font = '500 16px Arial';
      context.fillStyle = '#5c6b74';
      context.fillText(player?.role ?? 'Waiting for player', x + 20, y + 106);
    });

    const bench = team.lineup.benchOrder.map((id) => playerMap.get(id)).filter(Boolean) as Player[];
    const benchY = 620;
    context.fillStyle = '#eaf2f4';
    context.fillRect(60, 560, 1080, 150);
    context.fillStyle = '#163b4a';
    context.font = '700 22px Arial';
    context.fillText('Bench rotation', 80, 600);

    bench.forEach((player, index) => {
      context.fillStyle = '#1f3442';
      context.font = '500 20px Arial';
      context.fillText(`${index + 1}. ${player.name} — ${player.role}`, 80, benchY + index * 28);
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'volleyball'}-rotation.png`;
    link.click();
    setStatus('PNG downloaded.');
  };

  return (
    <>
      <div className={compact ? 'share-actions compact' : 'share-actions'}>
        <button className={compact ? 'button primary small-action' : 'button primary icon-button-text'} onClick={copyLink} aria-label="Copy view-only link">
          <Link2 size={15} aria-hidden="true" />
          {!compact && <span>Copy link</span>}
          {compact && <span>Copy</span>}
        </button>
        <button className={compact ? 'button secondary small-action' : 'button secondary icon-button-text'} onClick={exportPng} aria-label="Download PNG image">
          <Download size={15} aria-hidden="true" />
          {!compact && <span>PNG</span>}
          {compact && <span>PNG</span>}
        </button>
      </div>
      {status && <div className="suggestion-feedback">{status}</div>}
    </>
  );
}

function ShareRotationCard({ teamName, players, lineup }: { teamName: string; players: Player[]; lineup: { positions: LineupAssignment[]; benchOrder: string[]; benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }> } }) {
  const playerMap = new Map(players.map((player) => [player.id, player]));

  return (
    <section className="panel-card share-readonly">
      <div className="panel-header">
        <div className="header-row">
          <div className="mini-badge primary">V</div>
          <h3>{teamName}</h3>
        </div>
        <span>View only</span>
      </div>

      <div className="court-grid share-grid">
        {POSITIONS.map((position) => {
          const assignment = lineup.positions.find((item) => item.position === position.key);
          const player = assignment?.playerId ? playerMap.get(assignment.playerId) : null;
          return (
            <div key={position.key} className="court-slot share-slot">
              <label>{position.short}</label>
              <div className="share-name">{player?.name ?? 'Open'}</div>
              <div className="slot-meta">{player?.role ?? 'Waiting for player'}</div>
            </div>
          );
        })}
      </div>

      <div className="share-bench">
        <div className="share-bench-heading">Bench rotation</div>
        <div className="share-bench-list">
          {lineup.benchOrder.map((id, index) => {
            const player = playerMap.get(id);
            const replacement = lineup.benchReplacements.find((entry) => entry.playerId === id)?.replacesPlayerId ?? null;
            const replacementPlayer = replacement ? playerMap.get(replacement) : null;
            return (
              <div key={`${id}-${index}`} className="share-bench-item">
                <span>{index + 1}</span>
                <div className="share-bench-copy">
                  <strong>{player?.name ?? 'Unknown player'}</strong>
                  {replacementPlayer && <small>Replaces {replacementPlayer.name}</small>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function lineupSignature(lineup: { positions: LineupAssignment[]; benchOrder: string[] }) {
  return `${lineup.positions.map((assignment) => assignment.playerId ?? '').join(',')}|${lineup.benchOrder.join(',')}`;
}

function rotatePlayers(players: Player[], offset: number) {
  return Array.from({ length: players.length }, (_, index) => players[(index + offset) % players.length]);
}

function generateSuggestions(team: Team, seed = 0, rejectedKeys: string[] = []) {
  const available = team.players.filter((player) => player.available);
  if (available.length < POSITIONS.length) return [];

  const setters = available.filter((player) => player.role === 'Setter');
  const outsideHitters = available.filter((player) => player.role === 'Outside Hitter');
  const middles = available.filter((player) => player.role === 'Middle');

  if (setters.length < 2 || outsideHitters.length < 2 || middles.length < 2) {
    return [];
  }

  const candidates: Array<{ positions: LineupAssignment[]; benchOrder: string[]; benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }> }> = [];
  const seen = new Set<string>();

  const rotationPlans = [
    {
      setterSlots: ['front-middle', 'back-middle'] as CourtPosition[],
      middleSlots: ['front-left', 'back-right'] as CourtPosition[],
      outsideSlots: ['front-right', 'back-left'] as CourtPosition[],
    },
    {
      setterSlots: ['back-middle', 'front-middle'] as CourtPosition[],
      middleSlots: ['back-right', 'front-left'] as CourtPosition[],
      outsideSlots: ['back-left', 'front-right'] as CourtPosition[],
    },
    {
      setterSlots: ['front-middle', 'back-middle'] as CourtPosition[],
      middleSlots: ['front-right', 'back-left'] as CourtPosition[],
      outsideSlots: ['front-left', 'back-right'] as CourtPosition[],
    },
  ];

  for (let variant = 0; variant < 12; variant += 1) {
    const plan = rotationPlans[(variant + seed) % rotationPlans.length];
    const rotatedSetters = rotatePlayers(setters, variant + seed);
    const rotatedOutside = rotatePlayers(outsideHitters, variant + 1 + seed);
    const rotatedMiddle = rotatePlayers(middles, variant + 2 + seed);
    const assignments = new Map<CourtPosition, string>();

    assignments.set(plan.setterSlots[0], rotatedSetters[0].id);
    assignments.set(plan.setterSlots[1], rotatedSetters[1].id);
    assignments.set(plan.middleSlots[0], rotatedMiddle[0].id);
    assignments.set(plan.middleSlots[1], rotatedMiddle[1].id);
    assignments.set(plan.outsideSlots[0], rotatedOutside[0].id);
    assignments.set(plan.outsideSlots[1], rotatedOutside[1].id);

    const used = new Set(Array.from(assignments.values()));
    const benchOrder = rotatePlayers(
      available.filter((player) => !used.has(player.id)),
      variant + seed,
    ).map((player) => player.id);

      const courtPlayers = Array.from(assignments.values());
    const benchReplacements = benchOrder.map((playerId, index) => {
      const replacementPlayerId = courtPlayers[(index + seed) % courtPlayers.length] ?? null;
      return { playerId, replacesPlayerId: replacementPlayerId };
    });

    const lineup = {
      positions: POSITIONS.map((position) => ({ position: position.key, playerId: assignments.get(position.key) ?? null })),
      benchOrder,
      benchReplacements,
    };

    const key = lineupSignature(lineup);
    if (!rejectedKeys.includes(key) && !seen.has(key)) {
      seen.add(key);
      candidates.push(lineup);
    }
  }

  return candidates;
}

function CourtBoard({ team, onAssign, onApplySuggestion, suggestion, onUseSuggestion }: { team: Team; onAssign: (position: CourtPosition, playerId: string) => void; onApplySuggestion: (lineup: Team['lineup']) => void; suggestion: Team['lineup'] | null; onUseSuggestion: () => void; }) {
  const available = team.players.filter((player) => player.available);
  const playerById = new Map(team.players.map((player) => [player.id, player]));

  return (
    <section className="panel-card">
      <div className="panel-header court-header">
        <div className="header-row court-header-title">
          <h3>Starting six</h3>
        </div>
        <span
          className={`court-filled-badge ${team.lineup.positions.filter((assignment) => assignment.playerId).length === POSITIONS.length ? 'full' : ''}`}
        >
          {team.lineup.positions.filter((assignment) => assignment.playerId).length}/6 filled
        </span>
      </div>

      <div className="court-axis">
        <span>Net</span>
        <span>Attack line</span>
      </div>
      <div className="court-grid">
        {POSITIONS.map((position) => {
          const assignment = team.lineup.positions.find((item) => item.position === position.key);
          const player = assignment?.playerId ? playerById.get(assignment.playerId) : undefined;

          return (
            <div key={position.key} className={`court-slot ${!assignment?.playerId ? 'empty' : ''}`}>
              <label>
                <span>{position.short}</span>
              </label>
              <select value={assignment?.playerId ?? ''} onChange={(event) => onAssign(position.key, event.target.value)}>
                <option value="">—</option>
                {available.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <div className="slot-meta">{player ? <>{player.role}</> : 'Choose player'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BenchPlan({
  team,
  onAdd,
  onMove,
  onRemove,
  onSetReplacement,
}: {
  team: Team;
  onAdd: (playerId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (playerId: string) => void;
  onSetReplacement: (playerId: string, replacesPlayerId: string | null) => void;
}) {
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const available = team.players.filter((player) => player.available && !team.lineup.positions.some((assignment) => assignment.playerId === player.id));
  const bench = team.lineup.benchOrder.map((id) => playerById.get(id)).filter(Boolean) as Player[];
  const starterOptions = team.players.filter((player) =>
    team.lineup.positions.some((assignment) => assignment.playerId === player.id),
  );

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div className="header-row">
          <h3>Bench rotation</h3>
        </div>
        <span>{bench.length} queued</span>
      </div>

      <div className="bench-list">
        {bench.length ? (
          bench.map((player, index) => {
            const replacementId = team.lineup.benchReplacements.find((entry) => entry.playerId === player.id)?.replacesPlayerId ?? null;
            const replacementPlayer = starterOptions.find((starter) => starter.id === replacementId) ?? null;
            return (
              <div key={player.id} className="bench-item">
                <div className="bench-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="bench-player">
                  <strong>{player.name}</strong>
                  <span>Next in · replaces</span>
                </div>
                <div className="bench-controls">
                  <select value={replacementId ?? ''} onChange={(event) => onSetReplacement(player.id, event.target.value || null)}>
                    <option value="">No starter selected</option>
                    {starterOptions.map((starter) => (
                      <option key={starter.id} value={starter.id}>
                        {starter.name}
                      </option>
                    ))}
                  </select>
                  <div className="bench-actions">
                    <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${player.name} up`}>
                      <ChevronUp size={14} aria-hidden="true" />
                    </button>
                    <button onClick={() => onMove(index, 1)} disabled={index === bench.length - 1} aria-label={`Move ${player.name} down`}>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    <button className="danger" onClick={() => onRemove(player.id)} aria-label={`Remove ${player.name}`}>
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-small">No bench order yet. Add your first replacement below.</div>
        )}
      </div>

      {available.length > 0 && (
        <div className="bench-add-row">
          <select
            defaultValue=""
            onChange={(event) => {
              onAdd(event.target.value);
              event.target.value = '';
            }}
          >
            <option value="">Add available player to bench…</option>
            {available.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}

function RosterPanel({ team, onAdd, onToggleAvailability, onDelete }: {
  team: Team;
  onAdd: (player: Player) => void;
  onToggleAvailability: (id: string, updates: Partial<Player>) => void;
  onDelete: (id: string) => void;
}) {
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState<Role>('Outside Hitter');
  const [draftNote, setDraftNote] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('Outside Hitter');
  const [editNote, setEditNote] = useState('');
  const rosterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const resetDraft = () => {
    setDraftName('');
    setDraftRole('Outside Hitter');
    setDraftNote('');
  };

  const resetEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditRole('Outside Hitter');
    setEditNote('');
  };

  const submitAdd = () => {
    if (!draftName.trim()) return;
    onAdd({
      id: `player-${Date.now()}`,
      name: draftName.trim(),
      role: draftRole,
      available: true,
      note: draftNote.trim() || null,
    });
    resetDraft();
  };

  const beginEdit = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setEditRole(player.role);
    setEditNote(player.note ?? '');
  };

  const updateEditField = (player: Player, patch: Partial<{ name: string; role: Role; note: string; available: boolean }>) => {
    const nextName = patch.name ?? editName;
    const nextRole = patch.role ?? editRole;
    const nextNote = patch.note ?? editNote;

    if (patch.name !== undefined) {
      setEditName(patch.name);
      if (!patch.name.trim()) return;
    }

    if (patch.role !== undefined) {
      setEditRole(patch.role);
    }

    if (patch.note !== undefined) {
      setEditNote(patch.note);
    }

    onToggleAvailability(player.id, {
      name: nextName.trim() || player.name,
      role: nextRole,
      note: nextNote.trim() || null,
      available: patch.available ?? player.available,
    });
  };

  useEffect(() => {
    if (!editingId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const activeCard = rosterRefs.current[editingId];
      if (activeCard && !activeCard.contains(event.target as Node)) {
        resetEdit();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingId]);

  return (
    <section className="panel-card roster-panel">
      <div className="panel-header">
        <div className="header-row">
          <h3>Roster</h3>
        </div>
      </div>

      <div className="roster-list">
        {team.players.map((player) => (
          <div
            key={player.id}
            className="roster-item"
            onClick={() => {
              if (editingId === player.id) {
                resetEdit();
              } else {
                beginEdit(player);
              }
            }}
            ref={(node) => {
              rosterRefs.current[player.id] = node;
            }}
          >
            <div className={`avatar ${player.available ? '' : 'off'}`}>{initials(player.name)}</div>
            <div className="roster-body">
              <div className="roster-topline">
                <strong>{player.name}</strong>
                <span className="badge">{player.role}</span>
              </div>
              <div className="roster-meta">
                <button
                  type="button"
                  className={`status-pill ${player.available ? 'available' : 'out'}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleAvailability(player.id, { available: !player.available });
                  }}
                >
                  <span className={`status-dot ${player.available ? 'available' : 'out'}`} />
                  {player.available ? 'Available' : 'Out'}
                </button>
              </div>
            </div>
            {editingId === player.id && (
              <div className="player-form" style={{ gridColumn: '1 / -1', marginTop: '0.75rem' }} onClick={(event) => event.stopPropagation()}>
                <input
                  value={editName}
                  onChange={(event) => updateEditField(player, { name: event.target.value })}
                  placeholder="Player name"
                />
                <select value={editRole} onChange={(event) => updateEditField(player, { role: event.target.value as Role })}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  value={editNote}
                  onChange={(event) => updateEditField(player, { note: event.target.value })}
                  placeholder="Match note (optional)"
                />
                <div className="form-actions">
                  <button className="button danger" onClick={() => {
                    onDelete(player.id);
                    resetEdit();
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="player-form">
        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Player name" />
        <select value={draftRole} onChange={(event) => setDraftRole(event.target.value as Role)}>
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Match note (optional)" />
        <div className="form-actions">
          <button className="button primary" onClick={submitAdd} disabled={!draftName.trim()}>
            Add to roster
          </button>
        </div>
      </div>
    </section>
  );
}

export default App;
