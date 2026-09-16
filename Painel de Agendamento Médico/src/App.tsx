import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = "confirmed" | "pending" | "cancelled" | "completed";
type Modality = "presencial" | "online";
type SlotState = "available" | "blocked" | "default";

interface Appointment {
  id: string;
  patient: string;
  avatar: string;
  specialty: string;
  date: string;
  time: string;
  type: string;
  status: Status;
  modality: Modality;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCTOR = {
  name: "Dr. Rafael Mendes",
  crm: "CRM/SP 142.890",
  specialties: ["Cardiologia", "Clínica Geral", "Medicina Preventiva"],
  initials: "RM",
};

const SPECIALTIES = ["Cardiologia", "Clínica Geral", "Medicina Preventiva"];

const ALL_HOURS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00",
];

const WEEK_DAYS = [
  { label: "Seg", short: "S", date: "2026-09-14", day: "14" },
  { label: "Ter", short: "T", date: "2026-09-15", day: "15" },
  { label: "Qua", short: "Q", date: "2026-09-16", day: "16" },
  { label: "Qui", short: "Q", date: "2026-09-17", day: "17" },
  { label: "Sex", short: "S", date: "2026-09-18", day: "18" },
];

const TODAY = "2026-09-16";

// ─── Initial Appointments ─────────────────────────────────────────────────────

const INITIAL_APPOINTMENTS: Appointment[] = [
  { id: "A001", patient: "Mariana Costa", avatar: "MC", specialty: "Cardiologia", date: "2026-09-16", time: "08:00", type: "Consulta de rotina", status: "confirmed", modality: "presencial" },
  { id: "A002", patient: "João Almeida", avatar: "JA", specialty: "Clínica Geral", date: "2026-09-16", time: "09:00", type: "Retorno", status: "confirmed", modality: "online" },
  { id: "A003", patient: "Beatriz Santos", avatar: "BS", specialty: "Cardiologia", date: "2026-09-16", time: "09:30", type: "Eletrocardiograma", status: "pending", modality: "presencial" },
  { id: "A004", patient: "Carlos Ferreira", avatar: "CF", specialty: "Medicina Preventiva", date: "2026-09-16", time: "10:00", type: "Check-up anual", status: "cancelled", modality: "presencial", notes: "Desmarcou às 07h42" },
  { id: "A005", patient: "Fernanda Rocha", avatar: "FR", specialty: "Cardiologia", date: "2026-09-16", time: "11:00", type: "Acompanhamento", status: "confirmed", modality: "online" },
  { id: "A006", patient: "Lucas Pereira", avatar: "LP", specialty: "Clínica Geral", date: "2026-09-16", time: "14:00", type: "Primeira consulta", status: "completed", modality: "presencial" },
  { id: "A007", patient: "Sofia Martins", avatar: "SM", specialty: "Medicina Preventiva", date: "2026-09-16", time: "15:00", type: "Avaliação", status: "pending", modality: "online" },
  { id: "A008", patient: "Pedro Oliveira", avatar: "PO", specialty: "Cardiologia", date: "2026-09-17", time: "09:00", type: "Ecocardiograma", status: "confirmed", modality: "presencial" },
  { id: "A009", patient: "Ana Rodrigues", avatar: "AR", specialty: "Clínica Geral", date: "2026-09-17", time: "10:00", type: "Retorno", status: "confirmed", modality: "online" },
  { id: "A010", patient: "Thiago Lima", avatar: "TL", specialty: "Medicina Preventiva", date: "2026-09-15", time: "08:30", type: "Vacinação", status: "completed", modality: "presencial" },
];

// ─── Initial slot config: default available hours (Mon–Fri 08:00–17:00) ────────

function buildDefaultSlots() {
  const slots: Record<string, Record<string, SlotState>> = {};
  for (const d of WEEK_DAYS) {
    slots[d.date] = {};
    for (const h of ALL_HOURS) {
      const hNum = parseInt(h.split(":")[0]);
      slots[d.date][h] = hNum >= 8 && hNum < 17 ? "available" : "default";
    }
  }
  return slots;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusConfig: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  confirmed: { label: "Confirmado", bg: "bg-[#0d3d37]", text: "text-[#2dd4bf]", dot: "bg-[#2dd4bf]" },
  pending: { label: "Pendente", bg: "bg-[#3d2a00]", text: "text-[#f59e0b]", dot: "bg-[#f59e0b]" },
  cancelled: { label: "Cancelado", bg: "bg-[#3d0a17]", text: "text-[#f43f5e]", dot: "bg-[#f43f5e]" },
  completed: { label: "Concluído", bg: "bg-[#0f2d1a]", text: "text-[#22c55e]", dot: "bg-[#22c55e]" },
};

const specialtyColor: Record<string, string> = {
  "Cardiologia": "#2dd4bf",
  "Clínica Geral": "#8b5cf6",
  "Medicina Preventiva": "#f59e0b",
};

function StatusBadge({ status }: { status: Status }) {
  const c = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function ModalityBadge({ modality }: { modality: Modality }) {
  return modality === "online" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1e1040] text-[#a78bfa]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />Online
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1c1a12] text-[#fbbf24]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />Presencial
    </span>
  );
}

function SpecialtyTag({ specialty }: { specialty: string }) {
  const color = specialtyColor[specialty] ?? "#7d8590";
  return (
    <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: `${color}18`, color }}>
      {specialty}
    </span>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ appointments }: { appointments: Appointment[] }) {
  const today = appointments.filter(a => a.date === TODAY);
  const total = today.length || 1;
  const stats = [
    { label: "Consultas hoje", value: today.length, sub: "16 de setembro", color: "#2dd4bf" },
    { label: "Confirmadas", value: today.filter(a => a.status === "confirmed").length, sub: `${Math.round(today.filter(a => a.status === "confirmed").length / total * 100)}% do total`, color: "#22c55e" },
    { label: "Pendentes", value: today.filter(a => a.status === "pending").length, sub: "Aguardando confirmação", color: "#f59e0b" },
    { label: "Online", value: today.filter(a => a.modality === "online").length, sub: `${Math.round(today.filter(a => a.modality === "online").length / total * 100)}% via telemedicina`, color: "#a78bfa" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
      {stats.map(s => (
        <div key={s.label} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4 hover:border-[#30363d] transition-colors">
          <p className="text-[#7d8590] text-xs font-medium uppercase tracking-wider mb-2">{s.label}</p>
          <p className="text-3xl font-semibold mb-1" style={{ color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</p>
          <p className="text-[#484f58] text-xs">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ appointments }: { appointments: Appointment[] }) {
  const getAppt = (date: string, hour: string) =>
    appointments.find(a => a.date === date && a.time === hour);

  return (
    <div className="flex-1 min-h-0 bg-[#161b22] border border-[#21262d] rounded-xl flex flex-col overflow-hidden">
      {/* Day headers */}
      <div className="flex flex-shrink-0 border-b border-[#21262d]">
        <div className="w-14 flex-shrink-0" />
        {WEEK_DAYS.map(d => (
          <div key={d.date} className={`flex-1 py-2.5 text-center border-l border-[#21262d] ${d.date === TODAY ? "bg-[#0d3d3780]" : ""}`}>
            <p className="text-[#7d8590] text-xs font-medium">{d.label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${d.date === TODAY ? "text-[#2dd4bf]" : "text-[#e6edf3]"}`}>{d.day}</p>
          </div>
        ))}
      </div>
      {/* Scrollable grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {ALL_HOURS.map(hour => (
          <div key={hour} className="flex border-b border-[#21262d] last:border-0" style={{ minHeight: 48 }}>
            <div className="w-14 flex-shrink-0 flex items-start justify-end pr-2 pt-2">
              <span className="text-[#484f58] text-[10px] font-mono leading-none">{hour}</span>
            </div>
            {WEEK_DAYS.map(d => {
              const appt = getAppt(d.date, hour);
              const color = appt ? (specialtyColor[appt.specialty] ?? "#7d8590") : null;
              return (
                <div key={d.date} className={`flex-1 border-l border-[#21262d] p-1 ${d.date === TODAY ? "bg-[#0d3d370a]" : ""}`}>
                  {appt && color && (
                    <div className="rounded-md px-2 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity h-full"
                      style={{ background: `${color}18`, borderLeft: `2px solid ${color}` }}>
                      <p className="font-semibold truncate leading-tight" style={{ color }}>{appt.patient}</p>
                      <p className="text-[#7d8590] truncate text-[10px] mt-0.5">{appt.specialty}</p>
                      <p className="text-[#484f58] truncate text-[10px]">{appt.modality === "online" ? "🔗 Online" : "🏥 Presencial"}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Appointments List ────────────────────────────────────────────────────────

type FilterKey = "all" | Status;

function AppointmentList({ appointments }: { appointments: Appointment[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [modFilter, setModFilter] = useState<"all" | Modality>("all");

  const today = appointments.filter(a => a.date === TODAY);
  const filtered = today
    .filter(a => filter === "all" || a.status === filter)
    .filter(a => modFilter === "all" || a.modality === modFilter)
    .filter(a =>
      a.patient.toLowerCase().includes(search.toLowerCase()) ||
      a.specialty.toLowerCase().includes(search.toLowerCase())
    );

  const statusFilters: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "confirmed", label: "Confirmadas" },
    { key: "pending", label: "Pendentes" },
    { key: "cancelled", label: "Canceladas" },
    { key: "completed", label: "Concluídas" },
  ];

  return (
    <div className="flex-1 min-h-0 bg-[#161b22] border border-[#21262d] rounded-xl flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-[#21262d] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e6edf3]">Consultas de hoje</h3>
          <p className="text-xs text-[#7d8590] mt-0.5">16 de setembro de 2026</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#0d1117] border border-[#21262d] rounded-lg p-0.5">
            {(["all", "presencial", "online"] as const).map(m => (
              <button key={m} onClick={() => setModFilter(m)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${modFilter === m ? "bg-[#21262d] text-[#e6edf3]" : "text-[#7d8590] hover:text-[#e6edf3]"}`}>
                {m === "all" ? "Todos" : m === "online" ? "Online" : "Presencial"}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar paciente..."
            className="bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#2dd4bf] transition-colors w-44" />
          <button className="bg-[#2dd4bf] text-[#0d1117] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#14b8a6] transition-colors whitespace-nowrap">
            + Nova consulta
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 flex border-b border-[#21262d] overflow-x-auto">
        {statusFilters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${filter === f.key ? "border-[#2dd4bf] text-[#2dd4bf]" : "border-transparent text-[#7d8590] hover:text-[#e6edf3]"}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#161b22] z-10">
            <tr className="border-b border-[#21262d]">
              {["Horário", "Paciente", "Especialidade", "Modalidade", "Tipo", "Status", ""].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[#7d8590] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d]">
            {filtered.map(a => (
              <tr key={a.id} className="hover:bg-[#1f2937] transition-colors group">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-xs font-mono text-[#2dd4bf]">{a.time}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ background: `${specialtyColor[a.specialty] ?? "#7d8590"}22`, color: specialtyColor[a.specialty] ?? "#7d8590" }}>
                      {a.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-[#e6edf3] text-sm leading-tight">{a.patient}</p>
                      <p className="text-[#484f58] text-[10px]">#{a.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><SpecialtyTag specialty={a.specialty} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><ModalityBadge modality={a.modality} /></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-[#7d8590] text-xs">{a.type}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={a.status} />
                    {a.notes && <p className="text-[#484f58] text-[10px] max-w-[160px] truncate">{a.notes}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-[#7d8590] hover:text-[#2dd4bf] text-xs px-2 py-1 rounded hover:bg-[#0d3d37] transition-colors">Editar</button>
                    <button className="text-[#7d8590] hover:text-[#f43f5e] text-xs px-2 py-1 rounded hover:bg-[#3d0a17] transition-colors">Cancelar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[#484f58] text-sm">Nenhuma consulta encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Schedule Manager ─────────────────────────────────────────────────────────

function ScheduleManager() {
  const [slots, setSlots] = useState<Record<string, Record<string, SlotState>>>(buildDefaultSlots);
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const [defaultHours, setDefaultHours] = useState<Record<string, boolean>>(() => {
    const d: Record<string, boolean> = {};
    for (const h of ALL_HOURS) {
      const hNum = parseInt(h.split(":")[0]);
      d[h] = hNum >= 8 && hNum < 17;
    }
    return d;
  });
  const [tab, setTab] = useState<"week" | "defaults">("week");

  function toggleSlot(date: string, hour: string) {
    setSlots(prev => {
      const cur = prev[date]?.[hour] ?? "default";
      const next: SlotState = cur === "available" ? "blocked" : cur === "blocked" ? "default" : "available";
      return { ...prev, [date]: { ...prev[date], [hour]: next } };
    });
  }

  function toggleDefault(hour: string) {
    setDefaultHours(prev => ({ ...prev, [hour]: !prev[hour] }));
  }

  function applyDefaultsToDay(date: string) {
    setSlots(prev => {
      const daySlots: Record<string, SlotState> = {};
      for (const h of ALL_HOURS) {
        daySlots[h] = defaultHours[h] ? "available" : "default";
      }
      return { ...prev, [date]: daySlots };
    });
  }

  function applyDefaultsToWeek() {
    setSlots(prev => {
      const next = { ...prev };
      for (const d of WEEK_DAYS) {
        next[d.date] = {};
        for (const h of ALL_HOURS) {
          next[d.date][h] = defaultHours[h] ? "available" : "default";
        }
      }
      return next;
    });
  }

  const daySlots = slots[selectedDay] ?? {};
  const availableCount = Object.values(daySlots).filter(s => s === "available").length;
  const blockedCount = Object.values(daySlots).filter(s => s === "blocked").length;
  const defaultCount = Object.keys(defaultHours).filter(h => defaultHours[h]).length;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 bg-[#161b22] border border-[#21262d] rounded-xl p-1 self-start">
        <button onClick={() => setTab("week")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "week" ? "bg-[#21262d] text-[#e6edf3]" : "text-[#7d8590] hover:text-[#e6edf3]"}`}>
          Agenda semanal
        </button>
        <button onClick={() => setTab("defaults")}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "defaults" ? "bg-[#21262d] text-[#e6edf3]" : "text-[#7d8590] hover:text-[#e6edf3]"}`}>
          Horários padrão
        </button>
      </div>

      {tab === "defaults" ? (
        /* ── Default hours config ── */
        <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
          <div className="flex-1 min-h-0 bg-[#161b22] border border-[#21262d] rounded-xl flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#e6edf3]">Horários padrão de atendimento</h3>
                <p className="text-xs text-[#7d8590] mt-0.5">{defaultCount} horários ativos por padrão</p>
              </div>
              <button onClick={applyDefaultsToWeek}
                className="bg-[#2dd4bf] text-[#0d1117] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#14b8a6] transition-colors">
                Aplicar à semana toda
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <p className="text-xs text-[#7d8590] mb-3">Clique para ativar ou desativar horários padrão. Eles serão aplicados automaticamente em novos dias.</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {ALL_HOURS.map(hour => (
                  <button key={hour} onClick={() => toggleDefault(hour)}
                    className={`py-2 rounded-lg text-xs font-mono font-medium transition-all border ${
                      defaultHours[hour]
                        ? "bg-[#0d3d37] border-[#2dd4bf] text-[#2dd4bf]"
                        : "bg-[#0d1117] border-[#21262d] text-[#484f58] hover:border-[#30363d] hover:text-[#7d8590]"
                    }`}>
                    {hour}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Legend */}
          <div className="w-56 flex-shrink-0 bg-[#161b22] border border-[#21262d] rounded-xl p-4 flex flex-col gap-3 self-start">
            <h4 className="text-xs font-semibold text-[#e6edf3] uppercase tracking-wider">Legenda</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#0d3d37] border border-[#2dd4bf]" />
                <span className="text-xs text-[#7d8590]">Horário ativo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-[#0d1117] border border-[#21262d]" />
                <span className="text-xs text-[#7d8590]">Horário inativo</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Weekly schedule grid ── */
        <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
          {/* Day selector */}
          <div className="w-48 flex-shrink-0 bg-[#161b22] border border-[#21262d] rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[#21262d]">
              <h3 className="text-xs font-semibold text-[#e6edf3] uppercase tracking-wider">Semana</h3>
              <p className="text-[10px] text-[#7d8590] mt-0.5">Set 14–18, 2026</p>
            </div>
            <div className="flex-1 p-2 space-y-1">
              {WEEK_DAYS.map(d => {
                const ds = slots[d.date] ?? {};
                const av = Object.values(ds).filter(s => s === "available").length;
                const bl = Object.values(ds).filter(s => s === "blocked").length;
                return (
                  <button key={d.date} onClick={() => setSelectedDay(d.date)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${selectedDay === d.date ? "bg-[#0d3d37] border border-[#2dd4bf30]" : "hover:bg-[#1f2937]"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${selectedDay === d.date ? "text-[#2dd4bf]" : d.date === TODAY ? "text-[#e6edf3]" : "text-[#7d8590]"}`}>
                          {d.label} {d.day}
                          {d.date === TODAY && <span className="ml-1 text-[10px] text-[#2dd4bf]">Hoje</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-[#2dd4bf] font-mono">{av} disp.</span>
                      {bl > 0 && <span className="text-[10px] text-[#f43f5e] font-mono">{bl} bloq.</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2.5 border-t border-[#21262d]">
              <button onClick={() => applyDefaultsToDay(selectedDay)}
                className="w-full text-xs text-[#7d8590] hover:text-[#2dd4bf] transition-colors text-left">
                ↩ Aplicar padrão neste dia
              </button>
            </div>
          </div>

          {/* Slot grid */}
          <div className="flex-1 min-h-0 bg-[#161b22] border border-[#21262d] rounded-xl flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-3 border-b border-[#21262d] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#e6edf3]">
                  {WEEK_DAYS.find(d => d.date === selectedDay)?.label} · {selectedDay.slice(8)} de setembro
                  {selectedDay === TODAY && <span className="ml-2 text-xs text-[#2dd4bf] bg-[#0d3d37] px-1.5 py-0.5 rounded">Hoje</span>}
                </h3>
                <p className="text-xs text-[#7d8590] mt-0.5">{availableCount} disponíveis · {blockedCount} bloqueados</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#7d8590]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#0d3d37] border border-[#2dd4bf]" />Disponível</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#3d0a17] border border-[#f43f5e]" />Bloqueado</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#0d1117] border border-[#21262d]" />Inativo</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <p className="text-xs text-[#7d8590] mb-3">Clique em um horário para alternar: inativo → disponível → bloqueado → inativo</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {ALL_HOURS.map(hour => {
                  const state = daySlots[hour] ?? "default";
                  return (
                    <button key={hour} onClick={() => toggleSlot(selectedDay, hour)}
                      className={`py-2.5 rounded-lg text-xs font-mono font-medium transition-all border ${
                        state === "available"
                          ? "bg-[#0d3d37] border-[#2dd4bf] text-[#2dd4bf] hover:bg-[#0d4a40]"
                          : state === "blocked"
                          ? "bg-[#3d0a17] border-[#f43f5e] text-[#f43f5e] hover:bg-[#4a0d1c]"
                          : "bg-[#0d1117] border-[#21262d] text-[#484f58] hover:border-[#30363d] hover:text-[#7d8590]"
                      }`}>
                      {hour}
                      {state === "available" && <span className="block text-[9px] opacity-70 font-sans">livre</span>}
                      {state === "blocked" && <span className="block text-[9px] opacity-70 font-sans">bloq.</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type NavPage = "dashboard" | "calendar" | "schedule";

function Sidebar({ page, setPage }: { page: NavPage; setPage: (p: NavPage) => void }) {
  const items: { id: NavPage; icon: string; label: string }[] = [
    { id: "dashboard", icon: "▦", label: "Consultas" },
    { id: "calendar", icon: "◷", label: "Calendário" },
    { id: "schedule", icon: "◈", label: "Meus Horários" },
  ];

  return (
    <aside className="w-52 bg-[#0d1117] border-r border-[#21262d] flex flex-col flex-shrink-0">
      <div className="px-4 py-4 border-b border-[#21262d]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#2dd4bf] flex items-center justify-center">
            <span className="text-[#0d1117] text-xs font-bold">+</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e6edf3] leading-tight">MedAdmin</p>
            <p className="text-[10px] text-[#484f58]">Agendamentos</p>
          </div>
        </div>
      </div>

      {/* Doctor card */}
      <div className="mx-3 mt-3 mb-1 bg-[#161b22] border border-[#21262d] rounded-xl p-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#2dd4bf22] flex items-center justify-center text-xs font-bold text-[#2dd4bf] flex-shrink-0">
            {DOCTOR.initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#e6edf3] truncate">{DOCTOR.name}</p>
            <p className="text-[10px] text-[#484f58]">{DOCTOR.crm}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {DOCTOR.specialties.map(s => (
            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: `${specialtyColor[s]}18`, color: specialtyColor[s] }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {items.map(item => (
          <button key={item.id} onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
              page === item.id ? "bg-[#0d3d37] text-[#2dd4bf]" : "text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#161b22]"
            }`}>
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[#21262d] space-y-0.5">
        {[{ icon: "◫", label: "Relatórios" }, { icon: "⊙", label: "Configurações" }].map(i => (
          <button key={i.label} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors text-left">
            <span className="text-base leading-none">{i.icon}</span>{i.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<NavPage>("dashboard");
  const [appointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);

  const pageTitle: Record<NavPage, string> = {
    dashboard: "Consultas",
    calendar: "Calendário semanal",
    schedule: "Gerenciar Horários",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar page={page} setPage={setPage} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex-shrink-0 px-6 py-3.5 border-b border-[#21262d] flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-[#e6edf3]">{pageTitle[page]}</h1>
            <p className="text-xs text-[#7d8590] mt-0.5">Terça, 16 de setembro de 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0d3d37] border border-[#2dd4bf30]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] animate-pulse" />
              <span className="text-xs text-[#2dd4bf] font-medium">Online</span>
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#21262d] text-[#7d8590] hover:text-[#e6edf3] hover:border-[#30363d] transition-colors relative">
              <span className="text-base">◎</span>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            </button>
          </div>
        </header>

        {/* Main — layout differs per page */}
        {page === "dashboard" && (
          <main className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-4 overflow-hidden">
            <StatsRow appointments={appointments} />
            <AppointmentList appointments={appointments} />
          </main>
        )}

        {page === "calendar" && (
          <main className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-4 overflow-hidden">
            <StatsRow appointments={appointments} />
            <CalendarView appointments={appointments} />
          </main>
        )}

        {page === "schedule" && (
          <main className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-4 overflow-hidden">
            <ScheduleManager />
          </main>
        )}
      </div>
    </div>
  );
}
