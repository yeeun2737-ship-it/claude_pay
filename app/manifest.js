export default function manifest() {
  return {
    name: '소소노트',
    short_name: '소소노트',
    description: '나만의 키치한 가계부',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f0e2',
    theme_color: '#f7f0e2',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
