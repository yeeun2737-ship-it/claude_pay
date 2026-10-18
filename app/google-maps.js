const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// 날짜별로 선과 핀 색을 돌려 쓴다
export const DAY_COLORS = ['#ff8fb1', '#ffd23f', '#7fd6ff', '#b9a3ff', '#8fe3a3', '#ffb36b'];

let loading;

// Google 지도 스크립트를 한 번만 불러온다.
export function loadMaps() {
  if (!KEY) return Promise.reject(new Error('지도 키가 설정되지 않았어요'));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  loading ??= new Promise((resolve, reject) => {
    window.__onGoogleMaps = () => resolve(window.google.maps);
    window.gm_authFailure = () => reject(new Error('지도 키가 거부됐어요. 키의 사용 제한 설정을 확인해 주세요'));
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&v=weekly&language=ko&loading=async&callback=__onGoogleMaps`;
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      reject(new Error('지도를 불러오지 못했어요'));
    };
    document.head.append(script);
  });
  return loading;
}

// 번호가 적힌 동그란 핀
export function pinElement(number, color) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.style.background = color;
  el.textContent = number;
  return el;
}

// 지도 만들기 공통 옵션. 고급 마커를 쓰려면 mapId가 필요하다.
export const MAP_OPTIONS = {
  mapId: 'DEMO_MAP_ID',
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: 'greedy',
};
