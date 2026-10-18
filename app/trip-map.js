'use client';

import { useEffect, useRef, useState } from 'react';
import { DAY_COLORS, MAP_OPTIONS, loadMaps, pinElement } from './google-maps';

// 위치가 있는 일정을 번호 핀으로 찍고, 같은 날짜끼리 방문 순서대로 선으로 잇는다.
export default function TripMap({ days, items }) {
  const [day, setDay] = useState('all');
  const [error, setError] = useState('');
  const box = useRef(null);
  const map = useRef(null);
  const overlays = useRef([]);

  const located = items.filter((i) => i.lat !== null && i.lng !== null);
  const shownDays = days.filter((d) => day === 'all' || d === day);

  useEffect(() => {
    if (located.length === 0) return;
    let cancelled = false;
    loadMaps()
      .then(async (maps) => {
        if (cancelled) return;
        const { AdvancedMarkerElement } = await maps.importLibrary('marker');
        if (!map.current) {
          map.current = new maps.Map(box.current, { ...MAP_OPTIONS, center: { lat: located[0].lat, lng: located[0].lng }, zoom: 12 });
        }
        overlays.current.forEach((o) => (o.setMap ? o.setMap(null) : (o.map = null)));
        overlays.current = [];
        const bounds = new maps.LatLngBounds();
        shownDays.forEach((d) => {
          const color = DAY_COLORS[days.indexOf(d) % DAY_COLORS.length];
          const list = located.filter((i) => i.day === d).sort((a, b) => a.position - b.position || a.id - b.id);
          const path = list.map((i) => ({ lat: i.lat, lng: i.lng }));
          path.forEach((p) => bounds.extend(p));
          if (path.length > 1) {
            overlays.current.push(
              new maps.Polyline({
                map: map.current,
                path,
                strokeColor: color,
                strokeOpacity: 0.85,
                strokeWeight: 4,
                icons: [{ icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: color }, offset: '50%' }],
              }),
            );
          }
          list.forEach((item, index) => {
            overlays.current.push(
              new AdvancedMarkerElement({
                map: map.current,
                position: { lat: item.lat, lng: item.lng },
                content: pinElement(index + 1, color),
                title: item.place,
              }),
            );
          });
        });
        if (!bounds.isEmpty()) {
          if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.current.setCenter(bounds.getCenter());
            map.current.setZoom(15);
          } else {
            map.current.fitBounds(bounds, 40);
          }
        }
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [items, day]);

  return (
    <div className="trip-map">
      <h3>🗺️ 지도</h3>
      {days.length > 1 && (
        <div className="day-chips">
          <button className={day === 'all' ? 'chip-btn on' : 'chip-btn'} onClick={() => setDay('all')}>
            전체
          </button>
          {days.map((d, i) => (
            <button key={d} className={day === d ? 'chip-btn on' : 'chip-btn'} onClick={() => setDay(d)}>
              Day {i + 1}
            </button>
          ))}
        </div>
      )}
      {located.length === 0 ? (
        <p className="plan-empty">일정에 위치를 지정하면 지도에 번호 핀과 경로가 나타나요</p>
      ) : (
        <>
          {error && <p className="error">{error}</p>}
          <div ref={box} className="map-box" />
        </>
      )}
    </div>
  );
}
