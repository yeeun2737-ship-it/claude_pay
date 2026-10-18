'use client';

import { useEffect, useRef, useState } from 'react';
import { MAP_OPTIONS, loadMaps, pinElement } from './google-maps';

// 장소 이름으로 검색해서 위치를 고르고, 핀을 끌어서 위치를 다듬는다.
// value: { lat, lng } 또는 null. onChange({ lat, lng, name? })
export default function LocationPicker({ query, value, onChange, onClear }) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  async function search() {
    if (!query.trim()) {
      setNote('장소 이름을 먼저 입력해 주세요');
      return;
    }
    setSearching(true);
    setNote('');
    try {
      const maps = await loadMaps();
      const { Place } = await maps.importLibrary('places');
      const { places } = await Place.searchByText({
        textQuery: query.trim(),
        fields: ['displayName', 'formattedAddress', 'location'],
        language: 'ko',
        maxResultCount: 5,
      });
      setResults(places);
      if (places.length === 0) setNote('검색 결과가 없어요. 이름을 바꿔 보거나 직접 입력해 주세요');
    } catch (err) {
      setResults([]);
      setNote('검색하지 못했어요: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

  function pick(place) {
    setResults([]);
    setNote('');
    onChange({ lat: place.location.lat(), lng: place.location.lng(), name: place.displayName });
  }

  // 위치가 있으면 작은 지도에 끌 수 있는 핀을 보여준다
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    loadMaps()
      .then(async (maps) => {
        if (cancelled) return;
        const { AdvancedMarkerElement } = await maps.importLibrary('marker');
        const position = { lat: value.lat, lng: value.lng };
        if (!map.current) {
          map.current = new maps.Map(box.current, { ...MAP_OPTIONS, center: position, zoom: 15 });
          marker.current = new AdvancedMarkerElement({
            map: map.current,
            position,
            content: pinElement('📍', '#ff8fb1'),
            gmpDraggable: true,
          });
          marker.current.addListener('dragend', () => {
            const p = marker.current.position;
            latestOnChange.current({ lat: p.lat, lng: p.lng });
          });
        } else {
          marker.current.position = position;
          map.current.panTo(position);
        }
      })
      .catch((err) => setNote(err.message));
    return () => {
      cancelled = true;
    };
  }, [value?.lat, value?.lng]);

  return (
    <div className="picker">
      <div className="picker-row">
        <button type="button" className="picker-btn" onClick={search} disabled={searching}>
          {searching ? '검색 중...' : '📍 위치 검색'}
        </button>
        {value && (
          <button
            type="button"
            className="picker-clear"
            onClick={() => {
              map.current = null;
              marker.current = null;
              onClear();
            }}
          >
            위치 지우기
          </button>
        )}
      </div>
      {note && <small className="scan-note">{note}</small>}
      {results.length > 0 && (
        <ul className="picker-results">
          {results.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(p)}>
                <strong>{p.displayName}</strong>
                <small>{p.formattedAddress}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value && (
        <>
          <div ref={box} className="mini-map" />
          <small className="scan-note">핀을 끌어서 위치를 바로잡을 수 있어요</small>
        </>
      )}
    </div>
  );
}
