'use client';
// ============================================================
// SOVEREIGN CALENDAR — MIRACLE HMS V1.0
// Per-user task builder, alarms, reminders, 10-country holidays
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';

// ──────────────────────────────────────────────────────────────
// 1. TYPES
// ──────────────────────────────────────────────────────────────
interface CalendarTask {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: 'TASK' | 'ALARM' | 'MEETING' | 'REMINDER';
  time?: string; // HH:MM
  note?: string;
  color?: string;
  completed?: boolean;
}

interface Holiday {
  date: string; // MM-DD
  name: string;
  type: 'PUBLIC' | 'RELIGIOUS' | 'INTERNATIONAL';
  countries?: string[];
}

// ──────────────────────────────────────────────────────────────
// 2. HOLIDAY DATABASE (10 COUNTRIES + INTERNATIONAL)
// ──────────────────────────────────────────────────────────────
const HOLIDAYS_BY_COUNTRY: Record<string, Holiday[]> = {
  BD: [
    { date: '02-21', name: 'International Mother Language Day', type: 'PUBLIC' },
    { date: '03-17', name: 'Birth of Sheikh Mujibur Rahman', type: 'PUBLIC' },
    { date: '03-26', name: 'Independence Day', type: 'PUBLIC' },
    { date: '04-14', name: 'Bengali New Year (Pahela Baishakh)', type: 'PUBLIC' },
    { date: '05-01', name: 'International Workers Day', type: 'PUBLIC' },
    { date: '08-15', name: 'National Mourning Day', type: 'PUBLIC' },
    { date: '12-16', name: 'Victory Day', type: 'PUBLIC' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
  ],
  US: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '01-20', name: 'Martin Luther King Jr. Day', type: 'PUBLIC' },
    { date: '02-17', name: "Presidents' Day", type: 'PUBLIC' },
    { date: '05-26', name: 'Memorial Day', type: 'PUBLIC' },
    { date: '06-19', name: 'Juneteenth', type: 'PUBLIC' },
    { date: '07-04', name: 'Independence Day', type: 'PUBLIC' },
    { date: '09-01', name: 'Labor Day', type: 'PUBLIC' },
    { date: '11-11', name: "Veterans' Day", type: 'PUBLIC' },
    { date: '11-27', name: 'Thanksgiving Day', type: 'PUBLIC' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
  ],
  GB: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '04-18', name: 'Good Friday', type: 'RELIGIOUS' },
    { date: '04-21', name: 'Easter Monday', type: 'RELIGIOUS' },
    { date: '05-05', name: 'Early May Bank Holiday', type: 'PUBLIC' },
    { date: '05-26', name: 'Spring Bank Holiday', type: 'PUBLIC' },
    { date: '08-25', name: 'Summer Bank Holiday', type: 'PUBLIC' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
    { date: '12-26', name: 'Boxing Day', type: 'PUBLIC' },
  ],
  AE: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '12-02', name: 'UAE National Day', type: 'PUBLIC' },
    { date: '12-03', name: 'UAE National Day', type: 'PUBLIC' },
  ],
  SG: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '01-29', name: 'Chinese New Year', type: 'RELIGIOUS' },
    { date: '04-18', name: 'Good Friday', type: 'RELIGIOUS' },
    { date: '05-01', name: 'Labour Day', type: 'PUBLIC' },
    { date: '05-12', name: 'Vesak Day', type: 'RELIGIOUS' },
    { date: '08-09', name: 'National Day', type: 'PUBLIC' },
    { date: '10-20', name: 'Deepavali', type: 'RELIGIOUS' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
  ],
  JP: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '01-13', name: 'Coming of Age Day', type: 'PUBLIC' },
    { date: '02-11', name: 'National Foundation Day', type: 'PUBLIC' },
    { date: '03-20', name: 'Vernal Equinox Day', type: 'PUBLIC' },
    { date: '04-29', name: 'Showa Day', type: 'PUBLIC' },
    { date: '05-03', name: 'Constitution Memorial Day', type: 'PUBLIC' },
    { date: '05-04', name: 'Greenery Day', type: 'PUBLIC' },
    { date: '05-05', name: "Children's Day", type: 'PUBLIC' },
    { date: '07-21', name: 'Marine Day', type: 'PUBLIC' },
    { date: '08-11', name: 'Mountain Day', type: 'PUBLIC' },
    { date: '09-15', name: 'Respect for the Aged Day', type: 'PUBLIC' },
    { date: '11-03', name: 'Culture Day', type: 'PUBLIC' },
    { date: '11-23', name: 'Labour Thanksgiving Day', type: 'PUBLIC' },
    { date: '12-23', name: "Emperor's Birthday", type: 'PUBLIC' },
  ],
  AU: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '01-27', name: 'Australia Day', type: 'PUBLIC' },
    { date: '04-18', name: 'Good Friday', type: 'RELIGIOUS' },
    { date: '04-21', name: 'Easter Monday', type: 'RELIGIOUS' },
    { date: '04-25', name: 'ANZAC Day', type: 'PUBLIC' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
    { date: '12-26', name: 'Boxing Day', type: 'PUBLIC' },
  ],
  IN: [
    { date: '01-26', name: 'Republic Day', type: 'PUBLIC' },
    { date: '03-14', name: 'Holi', type: 'RELIGIOUS' },
    { date: '04-14', name: 'Ambedkar Jayanti', type: 'PUBLIC' },
    { date: '08-15', name: 'Independence Day', type: 'PUBLIC' },
    { date: '10-02', name: 'Gandhi Jayanti', type: 'PUBLIC' },
    { date: '10-20', name: 'Dussehra', type: 'RELIGIOUS' },
    { date: '11-01', name: 'Diwali', type: 'RELIGIOUS' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
  ],
  FR: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '04-21', name: 'Easter Monday', type: 'RELIGIOUS' },
    { date: '05-01', name: 'Labour Day', type: 'PUBLIC' },
    { date: '05-08', name: 'Victory in Europe Day', type: 'PUBLIC' },
    { date: '07-14', name: 'Bastille Day', type: 'PUBLIC' },
    { date: '11-01', name: 'All Saints Day', type: 'RELIGIOUS' },
    { date: '11-11', name: 'Armistice Day', type: 'PUBLIC' },
    { date: '12-25', name: 'Christmas Day', type: 'RELIGIOUS' },
  ],
  CN: [
    { date: '01-01', name: "New Year's Day", type: 'PUBLIC' },
    { date: '01-29', name: 'Chinese New Year', type: 'RELIGIOUS' },
    { date: '04-05', name: 'Qingming Festival', type: 'RELIGIOUS' },
    { date: '05-01', name: 'Labour Day', type: 'PUBLIC' },
    { date: '06-02', name: 'Dragon Boat Festival', type: 'RELIGIOUS' },
    { date: '09-29', name: 'Mid-Autumn Festival', type: 'RELIGIOUS' },
    { date: '10-01', name: 'National Day', type: 'PUBLIC' },
  ],
};

const INTERNATIONAL_HOLIDAYS: Holiday[] = [
  { date: '01-01', name: "International New Year's Day", type: 'INTERNATIONAL' },
  { date: '02-14', name: "Valentine's Day", type: 'INTERNATIONAL' },
  { date: '03-08', name: "International Women's Day", type: 'INTERNATIONAL' },
  { date: '04-22', name: 'Earth Day', type: 'INTERNATIONAL' },
  { date: '05-01', name: 'International Labour Day', type: 'INTERNATIONAL' },
  { date: '06-05', name: 'World Environment Day', type: 'INTERNATIONAL' },
  { date: '09-21', name: 'International Day of Peace', type: 'INTERNATIONAL' },
  { date: '10-31', name: 'Halloween', type: 'INTERNATIONAL' },
  { date: '12-25', name: 'Christmas Day', type: 'INTERNATIONAL' },
  { date: '12-31', name: "New Year's Eve", type: 'INTERNATIONAL' },
];

const COUNTRY_OPTIONS = [
  { code: 'BD', name: 'Bangladesh (Dhaka)' },
  { code: 'US', name: 'United States (New York)' },
  { code: 'GB', name: 'United Kingdom (London)' },
  { code: 'AE', name: 'UAE (Dubai)' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan (Tokyo)' },
  { code: 'AU', name: 'Australia (Sydney)' },
  { code: 'IN', name: 'India (Mumbai)' },
  { code: 'FR', name: 'France (Paris)' },
  { code: 'CN', name: 'China (Beijing)' },
];

const TASK_TYPES = [
  { value: 'TASK', label: '✅ Task', color: '#00F2FF' },
  { value: 'ALARM', label: '🔔 Alarm', color: '#FF3131' },
  { value: 'MEETING', label: '👥 Meeting', color: '#D4AF37' },
  { value: 'REMINDER', label: '💡 Reminder', color: '#9D00FF' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ──────────────────────────────────────────────────────────────
// 3. STORAGE HELPERS (per-user localStorage)
// ──────────────────────────────────────────────────────────────
const getStorageKey = (userId: string) => `sovereign_tasks_${userId}`;

const loadTasks = (userId: string): CalendarTask[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveTasks = (userId: string, tasks: CalendarTask[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(userId), JSON.stringify(tasks));
};

// ──────────────────────────────────────────────────────────────
// 4. MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
interface Props { onClose: () => void; }

export default function SovereignCalendar({ onClose }: Props) {
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('BD');
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [userId, setUserId] = useState('default');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<CalendarTask | null>(null);

  // Form state
  const [form, setForm] = useState({ title: '', type: 'TASK' as CalendarTask['type'], time: '', note: '' });

  // Load user + tasks
  useEffect(() => {
    const user = typeof window !== 'undefined' ? (localStorage.getItem('miracle_user') || 'default') : 'default';
    setUserId(user);
    setTasks(loadTasks(user));
    // Auto-detect country from timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes('Dhaka')) setSelectedCountry('BD');
      else if (tz.includes('New_York') || tz.includes('America')) setSelectedCountry('US');
      else if (tz.includes('London') || tz.includes('Europe/London')) setSelectedCountry('GB');
      else if (tz.includes('Dubai')) setSelectedCountry('AE');
      else if (tz.includes('Singapore')) setSelectedCountry('SG');
      else if (tz.includes('Tokyo')) setSelectedCountry('JP');
      else if (tz.includes('Sydney')) setSelectedCountry('AU');
      else if (tz.includes('Kolkata') || tz.includes('Calcutta')) setSelectedCountry('IN');
      else if (tz.includes('Paris')) setSelectedCountry('FR');
      else if (tz.includes('Shanghai') || tz.includes('Beijing')) setSelectedCountry('CN');
    } catch {}
  }, []);

  // Holiday lookup
  const getHolidaysForDate = useCallback((dateStr: string) => {
    const mmdd = dateStr.slice(5); // YYYY-MM-DD -> MM-DD
    const countryHols = HOLIDAYS_BY_COUNTRY[selectedCountry] || [];
    const intl = INTERNATIONAL_HOLIDAYS;
    return [...countryHols, ...intl].filter(h => h.date === mmdd);
  }, [selectedCountry]);

  // Tasks for selected date
  const tasksForDate = useMemo(() => {
    if (!selectedDate) return [];
    return tasks.filter(t => t.date === selectedDate).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [tasks, selectedDate]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [viewYear, viewMonth]);

  const formatDate = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const getDayDots = (day: number) => {
    const d = formatDate(day);
    const dayTasks = tasks.filter(t => t.date === d);
    const holidays = getHolidaysForDate(d);
    return { tasks: dayTasks, holidays };
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(formatDate(day));
    setShowTaskForm(false);
    setEditingTask(null);
    setForm({ title: '', type: 'TASK', time: '', note: '' });
  };

  const handleAddTask = () => {
    if (!form.title.trim() || !selectedDate) return;
    const newTask: CalendarTask = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userId,
      date: selectedDate,
      title: form.title.trim(),
      type: form.type,
      time: form.time || undefined,
      note: form.note || undefined,
      color: TASK_TYPES.find(t => t.value === form.type)?.color,
      completed: false,
    };
    const updated = editingTask
      ? tasks.map(t => t.id === editingTask.id ? { ...newTask, id: editingTask.id } : t)
      : [...tasks, newTask];
    setTasks(updated);
    saveTasks(userId, updated);
    setShowTaskForm(false);
    setEditingTask(null);
    setForm({ title: '', type: 'TASK', time: '', note: '' });
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    saveTasks(userId, updated);
  };

  const handleToggleTask = (taskId: string) => {
    const updated = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    setTasks(updated);
    saveTasks(userId, updated);
  };

  const handleEditTask = (task: CalendarTask) => {
    setEditingTask(task);
    setForm({ title: task.title, type: task.type, time: task.time || '', note: task.note || '' });
    setShowTaskForm(true);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedHolidays = selectedDate ? getHolidaysForDate(selectedDate) : [];

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        {/* HEADER */}
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontFamily: 'Cinzel', fontSize: '18px', color: '#D4AF37', letterSpacing: '3px', textShadow: '0 0 20px rgba(212,175,55,0.5)' }}>
              📅 SOVEREIGN CALENDAR
            </div>
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              style={selectStyle}
            >
              {COUNTRY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
          {/* LEFT: CALENDAR GRID */}
          <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
            {/* Month Nav */}
            <div style={monthNavStyle}>
              <button onClick={prevMonth} style={navBtnStyle}>‹</button>
              <div style={{ fontFamily: 'Cinzel', fontSize: '16px', color: '#FFF', letterSpacing: '2px', textAlign: 'center' }}>
                {MONTHS[viewMonth]} {viewYear}
              </div>
              <button onClick={nextMonth} style={navBtnStyle}>›</button>
            </div>

            {/* Day Headers */}
            <div style={dayHeaderRow}>
              {DAYS.map(d => (
                <div key={d} style={dayHeaderCell}>{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={calGridStyle}>
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} />;
                const dateStr = formatDate(day);
                const { tasks: dayTasks, holidays } = getDayDots(day);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const isWeekend = ((calendarDays.slice(0, calendarDays.indexOf(day)).filter(d => d !== null).length) + calendarDays.slice(0, calendarDays.indexOf(day)).filter(d => d === null).length) % 7 >= 5;
                const hasHoliday = holidays.length > 0;
                const taskAlarm = dayTasks.find(t => t.type === 'ALARM');

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleDayClick(day)}
                    style={dayCell(isToday, isSelected, isWeekend, hasHoliday)}
                  >
                    <span style={{ fontSize: '13px', fontWeight: isToday ? 900 : 600, color: isToday ? '#000' : isWeekend ? '#FF6B6B' : '#FFF', lineHeight: 1 }}>
                      {day}
                    </span>
                    {/* Dots row */}
                    <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                      {hasHoliday && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#D4AF37', display: 'block' }} />}
                      {dayTasks.slice(0, 3).map(t => (
                        <span key={t.id} style={{ width: '4px', height: '4px', borderRadius: '50%', background: t.color || '#00F2FF', display: 'block', boxShadow: `0 0 4px ${t.color || '#00F2FF'}` }} />
                      ))}
                      {taskAlarm && <span style={{ fontSize: '7px' }}>🔔</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', padding: '12px 0', flexWrap: 'wrap' }}>
              <div style={legendItem}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37', display: 'block' }} /> Holidays</div>
              {TASK_TYPES.map(t => (
                <div key={t.value} style={legendItem}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.color, display: 'block', boxShadow: `0 0 6px ${t.color}` }} />
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: DAY PANEL */}
          <div style={dayPanelStyle}>
            {selectedDate ? (
              <>
                <div style={{ fontFamily: 'Cinzel', fontSize: '13px', color: '#D4AF37', marginBottom: '12px', letterSpacing: '2px' }}>
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>

                {/* Holidays for this day */}
                {selectedHolidays.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    {selectedHolidays.map((h, i) => (
                      <div key={i} style={holidayBadge(h.type)}>
                        {h.type === 'PUBLIC' ? '🏛️' : h.type === 'RELIGIOUS' ? '🕌' : '🌍'} {h.name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks for this day */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
                  {tasksForDate.length === 0 && !showTaskForm && (
                    <div style={{ color: '#444', fontSize: '11px', textAlign: 'center', padding: '20px 0' }}>No tasks yet for this day</div>
                  )}
                  {tasksForDate.map(task => (
                    <div key={task.id} style={taskCard(task.color || '#00F2FF', task.completed || false)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={task.completed || false}
                          onChange={() => handleToggleTask(task.id)}
                          style={{ marginTop: '3px', accentColor: task.color || '#00F2FF', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: task.completed ? '#555' : '#FFF', textDecoration: task.completed ? 'line-through' : 'none', wordBreak: 'break-word' }}>
                            {task.title}
                          </div>
                          {task.time && <div style={{ fontSize: '10px', color: task.color || '#00F2FF', marginTop: '2px' }}>⏰ {task.time}</div>}
                          {task.note && <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>{task.note}</div>}
                          <div style={{ fontSize: '9px', background: `${task.color || '#00F2FF'}22`, border: `1px solid ${task.color || '#00F2FF'}44`, color: task.color || '#00F2FF', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>
                            {TASK_TYPES.find(t => t.value === task.type)?.label}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => handleEditTask(task)} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: '11px', padding: '2px' }}>✏️</button>
                          <button onClick={() => handleDeleteTask(task.id)} style={{ background: 'none', border: 'none', color: '#FF3131', cursor: 'pointer', fontSize: '11px', padding: '2px' }}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Task Form */}
                {showTaskForm ? (
                  <div style={taskFormStyle}>
                    <div style={{ fontSize: '11px', color: '#D4AF37', fontWeight: 900, marginBottom: '10px', letterSpacing: '1px' }}>
                      {editingTask ? '✏️ EDIT ENTRY' : '➕ NEW ENTRY'}
                    </div>
                    <div style={formGroup}>
                      <input
                        type="text"
                        placeholder="Title *"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        style={inputStyle}
                        autoFocus
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CalendarTask['type'] }))} style={inputStyle}>
                        {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <input
                        type="time"
                        value={form.time}
                        onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <textarea
                      placeholder="Notes (optional)..."
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      style={{ ...inputStyle, height: '60px', resize: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={handleAddTask} style={saveBtnStyle}>
                        {editingTask ? 'UPDATE' : 'SAVE'}
                      </button>
                      <button onClick={() => { setShowTaskForm(false); setEditingTask(null); }} style={cancelBtnStyle}>
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowTaskForm(true)} style={addTaskBtnStyle}>
                    + ADD TASK / ALARM / REMINDER
                  </button>
                )}
              </>
            ) : (
              <div style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '40px 20px', lineHeight: 2 }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📅</div>
                Select a day to view<br />holidays and manage<br />your tasks & alarms
              </div>
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes calendarSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cal-day:hover { background: rgba(0,242,255,0.08) !important; transform: scale(1.05); }
      ` }} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 5. STYLES
// ──────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(8px)',
  zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px',
};

const modalStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(15,15,20,0.98) 0%, rgba(5,5,10,0.99) 100%)',
  border: '1px solid rgba(212,175,55,0.2)',
  borderRadius: '24px',
  boxShadow: '0 40px 80px rgba(0,0,0,0.9), 0 0 60px rgba(212,175,55,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
  width: '100%', maxWidth: '900px',
  maxHeight: '88vh',
  display: 'flex', flexDirection: 'column',
  padding: '24px',
  gap: '16px',
  animation: 'calendarSlideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
  overflow: 'hidden',
};

const modalHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: '1px solid rgba(212,175,55,0.15)',
  paddingBottom: '16px',
};

const selectStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: '8px',
  color: '#D4AF37',
  padding: '6px 10px',
  fontSize: '11px',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'rgba(255,49,49,0.1)',
  border: '1px solid rgba(255,49,49,0.3)',
  borderRadius: '50%',
  width: '32px', height: '32px',
  color: '#FF3131',
  cursor: 'pointer',
  fontSize: '14px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const monthNavStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: '12px',
};

const navBtnStyle: React.CSSProperties = {
  background: 'rgba(0,242,255,0.1)',
  border: '1px solid rgba(0,242,255,0.2)',
  borderRadius: '8px',
  color: '#00F2FF',
  cursor: 'pointer',
  fontSize: '20px',
  width: '36px', height: '36px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const dayHeaderRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '2px',
  marginBottom: '6px',
};

const dayHeaderCell: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '10px',
  fontWeight: 900,
  color: '#555',
  letterSpacing: '1px',
  padding: '4px 0',
};

const calGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '3px',
  flex: 1,
};

const dayCell = (isToday: boolean, isSelected: boolean, isWeekend: boolean, hasHoliday: boolean): React.CSSProperties => ({
  background: isToday
    ? 'linear-gradient(135deg, #D4AF37 0%, #F5D060 100%)'
    : isSelected
    ? 'rgba(0,242,255,0.15)'
    : hasHoliday
    ? 'rgba(212,175,55,0.07)'
    : 'rgba(255,255,255,0.02)',
  border: isSelected
    ? '1px solid rgba(0,242,255,0.6)'
    : isToday
    ? '1px solid #D4AF37'
    : hasHoliday
    ? '1px solid rgba(212,175,55,0.25)'
    : '1px solid rgba(255,255,255,0.04)',
  borderRadius: '8px',
  padding: '6px 2px',
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: '52px',
  boxShadow: isSelected ? '0 0 10px rgba(0,242,255,0.2)' : 'none',
});

const dayPanelStyle: React.CSSProperties = {
  width: '280px',
  flexShrink: 0,
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: '16px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
};

const holidayBadge = (type: string): React.CSSProperties => ({
  background: type === 'PUBLIC' ? 'rgba(0,242,255,0.08)' : type === 'RELIGIOUS' ? 'rgba(212,175,55,0.1)' : 'rgba(57,255,20,0.08)',
  border: `1px solid ${type === 'PUBLIC' ? 'rgba(0,242,255,0.3)' : type === 'RELIGIOUS' ? 'rgba(212,175,55,0.35)' : 'rgba(57,255,20,0.3)'}`,
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '11px',
  color: type === 'PUBLIC' ? '#00F2FF' : type === 'RELIGIOUS' ? '#D4AF37' : '#39FF14',
  marginBottom: '6px',
  fontWeight: 700,
});

const taskCard = (color: string, completed: boolean): React.CSSProperties => ({
  background: completed ? 'rgba(0,0,0,0.2)' : `${color}08`,
  border: `1px solid ${completed ? 'rgba(255,255,255,0.05)' : `${color}30`}`,
  borderRadius: '10px',
  padding: '10px 12px',
  marginBottom: '8px',
  transition: '0.2s',
  opacity: completed ? 0.6 : 1,
});

const taskFormStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(212,175,55,0.2)',
  borderRadius: '12px',
  padding: '14px',
};

const formGroup: React.CSSProperties = { marginBottom: '8px' };

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#FFF',
  padding: '8px 10px',
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box',
};

const saveBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(0,242,255,0.15)',
  border: '1px solid rgba(0,242,255,0.4)',
  borderRadius: '8px',
  color: '#00F2FF',
  padding: '8px',
  fontWeight: 900,
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '1px',
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,49,49,0.1)',
  border: '1px solid rgba(255,49,49,0.3)',
  borderRadius: '8px',
  color: '#FF3131',
  padding: '8px',
  fontWeight: 900,
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '1px',
};

const addTaskBtnStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,242,255,0.08)',
  border: '1px dashed rgba(0,242,255,0.3)',
  borderRadius: '10px',
  color: '#00F2FF',
  padding: '12px',
  fontWeight: 900,
  fontSize: '11px',
  cursor: 'pointer',
  letterSpacing: '1px',
  transition: '0.2s',
};

const legendItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '10px',
  color: '#555',
  fontWeight: 700,
};
