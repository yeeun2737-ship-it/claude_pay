'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// 주간·월간 화면이 같이 쓰는 데이터 불러오기.
// 할 일·일정은 반복 때문에 전부 불러오고, 체크·지출·여행·여행 일정은 보이는 기간(start~end)만 불러온다.
export function usePlanner(start, end, setError) {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [checks, setChecks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [trips, setTrips] = useState([]);
  const [items, setItems] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('events').select('*').order('created_at'),
    ]).then(([t, e]) => {
      const err = t.error ?? e.error;
      if (err) setError('일정을 불러오지 못했어요: ' + err.message);
      else {
        setTasks(t.data);
        setEvents(e.data);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from('task_checks').select('*').gte('day', start).lte('day', end),
      supabase.from('expenses').select('id,date,amount,place,category').gte('date', start).lte('date', end),
      supabase.from('trips').select('id,name,start_date,end_date').lte('start_date', end).gte('end_date', start),
      supabase.from('trip_items').select('id,trip_id,day,place,visit_time,position').gte('day', start).lte('day', end).order('position'),
      supabase.from('workouts').select('id,day,kind,minutes').gte('day', start).lte('day', end),
    ]).then((results) => {
      if (cancelled) return;
      const err = results.find((r) => r.error)?.error;
      if (err) return setError('기간 데이터를 불러오지 못했어요: ' + err.message);
      setChecks(results[0].data);
      setExpenses(results[1].data);
      setTrips(results[2].data);
      setItems(results[3].data);
      setWorkouts(results[4].data);
    });
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  const doneSet = new Set(checks.map((c) => `${c.task_id}|${c.day}`));
  const isDone = (task, day) => doneSet.has(`${task.id}|${day}`);

  async function toggleTask(task, day) {
    if (isDone(task, day)) {
      const { error } = await supabase.from('task_checks').delete().eq('task_id', task.id).eq('day', day);
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks((cs) => cs.filter((c) => !(c.task_id === task.id && c.day === day)));
    } else {
      const { data, error } = await supabase.from('task_checks').insert({ task_id: task.id, day }).select().single();
      if (error) return setError('체크를 바꾸지 못했어요: ' + error.message);
      setChecks((cs) => [...cs, data]);
    }
    setError('');
  }

  const saveTask = (t) => setTasks((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t]));
  const removeTask = (id) => {
    setTasks((ts) => ts.filter((x) => x.id !== id));
    setChecks((cs) => cs.filter((c) => c.task_id !== id));
  };
  const saveEvent = (ev) => setEvents((es) => (es.some((x) => x.id === ev.id) ? es.map((x) => (x.id === ev.id ? ev : x)) : [...es, ev]));
  const removeEvent = (id) => setEvents((es) => es.filter((x) => x.id !== id));

  return { tasks, events, expenses, trips, items, workouts, loaded, isDone, toggleTask, saveTask, removeTask, saveEvent, removeEvent };
}
