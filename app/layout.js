import './globals.css';
import RegisterSW from './register-sw';
import ConfirmHost from './confirm';

export const metadata = {
  title: '소소노트',
  description: '나만의 다이어리 플래너와 가계부',
  icons: { icon: '/pwa-icon/192', apple: '/pwa-icon/180' },
  appleWebApp: { capable: true, title: '소소노트', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f0e2',
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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@700&display=swap&text=0123456789,.:/%25~%2B-"
        />
      </head>
      <body>
        {children}
        <RegisterSW />
        <ConfirmHost />
      </body>
    </html>
  );
}
