import '../src/styles.css';
import ThemeRuntime from '../src/ThemeRuntime.jsx';

export const metadata = {
  title: 'TleClinic POS',
  description: 'ระบบขายหน้าร้านสำหรับ TleClinic'
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body><ThemeRuntime />{children}</body>
    </html>
  );
}
