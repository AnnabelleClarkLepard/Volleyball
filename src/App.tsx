import { useEffect, useMemo, useState } from 'react';

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialTeams;
    try {
      const parsed = JSON.parse(raw) as Team[];
      return parsed.map((team) => ({
        ...team,
        players: (team.players ?? []).map((player) => ({
          ...player,
          role: normalizeRole(player.role),
        })),
      }));
    } catch {
      return initialTeams;
    }
  });
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeams[0].id);
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
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('view');
    if (!raw) {
      setSharedRotation(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        teamName: string;
        players: Player[];
        lineup: { positions: LineupAssignment[]; benchOrder: string[]; benchReplacements: Array<{ playerId: string; replacesPlayerId: string | null }> };
      };
      setSharedRotation(parsed);
    } catch {
      setSharedRotation(null);
    }
  }, []);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;

  const shareCurrentRotation = () => {
    const payload = { teamName: selectedTeam?.name ?? 'Volleyball lineup', players: selectedTeam?.players ?? [], lineup: selectedTeam?.lineup ?? emptyLineup() };
    const params = new URLSearchParams({ view: JSON.stringify(payload) });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', url);
    window.alert('View-only share link ready in the address bar.');
  };

  const copyCurrentShareLink = async () => {
    if (!selectedTeam) return;
    const payload = { teamName: selectedTeam.name, players: selectedTeam.players, lineup: selectedTeam.lineup };
    const params = new URLSearchParams({ view: JSON.stringify(payload) });
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      window.alert('View-only link copied to clipboard.');
    } catch {
      window.prompt('Copy this view-only link:', url);
    }
  };

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
        <div className="brand-row">
          <div className="logo">V</div>
          <div>
            <div className="brand">sideline</div>
            <div className="brand-subtitle">lineup desk</div>
          </div>
        </div>

        <div className="section-header">
          <span>Saved teams</span>
          <button className="ghost-button" onClick={() => setShowCreate(true)} aria-label="Create a new team">
            +
          </button>
        </div>

        <div className="team-list">
          {teams.map((team) => (
            <button
              key={team.id}
              className={`team-item ${selectedTeam?.id === team.id ? 'active' : ''}`}
              onClick={() => setSelectedTeamId(team.id)}
            >
              <div className="team-name-wrap">
                <span className={`dot ${selectedTeam?.id === team.id ? 'active' : ''}`} />
                <span>{team.name}</span>
              </div>
              <small>{formatDate(team.updatedAt)}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">Match-day workspace</div>
            <h1>Lineup board</h1>
          </div>

          {selectedTeam && (
            <div className="topbar-actions">
              <button className="button muted" onClick={() => window.location.reload()}>
                Refresh data
              </button>
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button className="button secondary" onClick={copyCurrentShareLink}>
                Share link
              </button>
              <button className="button secondary" onClick={shareCurrentRotation}>
                Share lineup
              </button>
              <button className="button danger" onClick={handleDeleteTeam}>
                Delete current team
              </button>
            </div>
          )}
        </header>

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
              <div className="roster-header-date">Updated {formatDate(selectedTeam.updatedAt)}</div>
            </div>

            <SummaryStrip summary={summary} team={selectedTeam} />
            <ShareControls team={selectedTeam} />
            <RotationSuggestions team={selectedTeam} onSave={updateTeam} />

            <div className="board-grid">
              <div className="stack-col">
                <CourtBoard team={selectedTeam} onAssign={onAssignPlayerToPosition} />
                <BenchPlan
                  team={selectedTeam}
                  onAdd={onAddBenchPlayer}
                  onMove={onMoveBench}
                  onRemove={onRemoveBench}
                  onSetReplacement={onSetBenchReplacement}
                />
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

function ShareControls({ team }: { team: Team }) {
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
    <div className="share-box">
      <div className="small-heading-row">
        <div className="small-heading">Share rotation</div>
      </div>
      <div className="share-actions">
        <button className="button primary" onClick={copyLink}>Copy view-only link</button>
        <button className="button secondary" onClick={exportPng}>Download PNG</button>
      </div>
      {status && <div className="suggestion-feedback">{status}</div>}
    </div>
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

function RotationSuggestions({ team, onSave }: { team: Team; onSave: (team: Team) => void }) {
  const [rotationSeed, setRotationSeed] = useState(0);
  const [rejectedKeys, setRejectedKeys] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'approve' | 'deny' | null>(null);

  const suggestions = useMemo(
    () => generateSuggestions(team, rotationSeed, rejectedKeys),
    [team, rotationSeed, rejectedKeys],
  );

  const current = suggestions[0] ?? null;
  const currentKey = current ? lineupSignature(current) : '';

  useEffect(() => {
    setRotationSeed(0);
    setRejectedKeys([]);
    setFeedback(null);
  }, [team.id]);

  const repopulate = () => {
    setRotationSeed((value) => value + 1);
    setFeedback(null);
  };

  const approve = () => {
    if (!current) return;
    onSave({ ...team, lineup: current });
    setFeedback('approve');
  };

  const deny = () => {
    if (!current || !currentKey) return;
    setRejectedKeys((keys) => [...keys, currentKey].slice(-8));
    setFeedback('deny');
    setRotationSeed((value) => value + 1);
  };

  if (team.players.filter((player) => player.available).length < POSITIONS.length) {
    return (
      <div className="suggestion-box">
        <div className="small-heading">Rotation suggestions</div>
        <p>
          {team.players.filter((player) => player.available).length}/6 players are available. Mark at least six players available to generate a full rotation.
        </p>
      </div>
    );
  }

  return (
    <section className="suggestion-box">
      <div className="small-heading-row">
        <div className="small-heading">Rotation suggestions</div>
        <button className="button secondary" onClick={repopulate}>
          Repopulate
        </button>
      </div>

      {current ? (
        <>
          <div className="suggestion-meta">
            Suggested rotation {rotationSeed + 1}
          </div>

          <div className="suggestion-preview">
            <div className="suggestion-preview-grid">
              {current.positions.map((assignment) => {
                const player = team.players.find((item) => item.id === assignment.playerId);
                const position = POSITIONS.find((item) => item.key === assignment.position);
                return (
                  <div key={assignment.position} className="suggestion-preview-slot">
                    <span>{position?.short ?? assignment.position}</span>
                    <strong>{player?.name ?? 'Open'}</strong>
                    <small>{player?.role ?? 'Unassigned'}</small>
                  </div>
                );
              })}
            </div>

            <div className="suggestion-bench-preview">
              <div className="suggestion-bench-label">Bench rotation</div>
              <div className="suggestion-bench-list">
                {current.benchOrder.map((id, index) => {
                  const player = team.players.find((item) => item.id === id);
                  return (
                    <div key={`${id}-${index}`} className="suggestion-bench-item">
                      <span>{index + 1}</span>
                      <strong>{player?.name ?? 'Player'}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="suggestion-actions">
            <button className="button primary" onClick={approve}>
              Approve suggestion
            </button>
            <button className="button muted" onClick={deny}>
              Deny suggestion
            </button>
          </div>
          {feedback && (
            <div className="suggestion-feedback">
              {feedback === 'approve' ? 'Approved and saved to the current board.' : 'Suggestion denied. A new rotation is ready.'}
            </div>
          )}
        </>
      ) : (
        <p>Suggested rotations prefer each player’s marked role, while keeping the six positions in a valid 4-2 court pattern.</p>
      )}
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

function CourtBoard({ team, onAssign }: { team: Team; onAssign: (position: CourtPosition, playerId: string) => void }) {
  const available = team.players.filter((player) => player.available);
  const playerById = new Map(team.players.map((player) => [player.id, player]));

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div className="header-row">
          <div className="mini-badge primary">V</div>
          <h3>Starting six</h3>
        </div>
        <span>{team.lineup.positions.filter((assignment) => assignment.playerId).length}/6 filled</span>
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
            <div key={position.key} className="court-slot">
              <label>
                <span>{position.short}</span>
                <small>· {position.label}</small>
              </label>
              <select value={assignment?.playerId ?? ''} onChange={(event) => onAssign(position.key, event.target.value)}>
                <option value="">Unassigned</option>
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
          <div className="mini-badge secondary">↓</div>
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
                    <button onClick={() => onMove(index, -1)} disabled={index === 0}>
                      ↑
                    </button>
                    <button onClick={() => onMove(index, 1)} disabled={index === bench.length - 1}>
                      ↓
                    </button>
                    <button className="danger" onClick={() => onRemove(player.id)}>
                      ×
                    </button>
                  </div>
                </div>
                {replacementPlayer && <div className="bench-replacement-text">{replacementPlayer.name}</div>}
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
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Outside Hitter');
  const [note, setNote] = useState('');

  const submitAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: `player-${Date.now()}`,
      name: name.trim(),
      role,
      available: true,
      note: note.trim() || null,
    });
    setName('');
    setRole('Outside Hitter');
    setNote('');
  };

  return (
    <section className="panel-card roster-panel">
      <div className="panel-header">
        <div className="header-row">
          <div className="mini-badge accent">R</div>
          <h3>Roster</h3>
        </div>
      </div>

      <div className="roster-list">
        {team.players.map((player) => (
          <div key={player.id} className="roster-item">
            <div className={`avatar ${player.available ? '' : 'off'}`}>{initials(player.name)}</div>
            <div className="roster-body">
              <div className="roster-topline">
                <strong>{player.name}</strong>
                {team.lineup.positions.some((assignment) => assignment.playerId === player.id) && <span className="badge">Starter</span>}
              </div>
              <small>{player.role}</small>
            </div>
            <button className="pill toggle" onClick={() => onToggleAvailability(player.id, { available: !player.available })}>
              {player.available ? 'Available' : 'Out'}
            </button>
            <button className="icon-button danger" onClick={() => onDelete(player.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="player-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Player name" />
        <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Match note (optional)" />
        <div className="form-actions">
          <button className="button primary" onClick={submitAdd} disabled={!name.trim()}>
            Add to roster
          </button>
          <button
            className="button muted"
            onClick={() => {
              setName('');
              setNote('');
              setRole('Outside Hitter');
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

export default App;
