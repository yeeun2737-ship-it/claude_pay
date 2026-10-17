import './globals.css';

export const metadata = {
  title: '티끌모아 티끌',
  description: '나만의 키치한 가계부',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
