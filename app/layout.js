import './globals.css';
import RegisterSW from './register-sw';

export const metadata = {
  title: '티끌모아 티끌',
  description: '나만의 키치한 가계부',
  icons: { icon: '/pwa-icon/192', apple: '/pwa-icon/180' },
  appleWebApp: { capable: true, title: '티끌모아', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ff8fb1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
