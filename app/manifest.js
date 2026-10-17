export default function manifest() {
  return {
    name: '티끌모아 티끌',
    short_name: '티끌모아',
    description: '나만의 키치한 가계부',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff8e7',
    theme_color: '#ff8fb1',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
