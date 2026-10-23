import './globals.css';
import RegisterSW from './register-sw';

export const metadata = {
  title: '티끌모아 티끌',
  description: '나만의 다이어리 플래너와 가계부',
  icons: { icon: '/pwa-icon/192', apple: '/pwa-icon/180' },
  appleWebApp: { capable: true, title: '티끌모아', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffc9d6',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Gowun+Dodum&display=swap"
        />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
