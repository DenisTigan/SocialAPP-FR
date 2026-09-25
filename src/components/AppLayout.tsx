import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import OfflineBanner from './OfflineBanner';
import '../styles/app-layout.css';

/**
 * Shared layout for all protected pages.
 * - Desktop (≥769px): top Navbar only
 * - Mobile (≤768px): top Navbar shows brand/logo only; BottomNav handles routing
 * The main content area gets bottom padding on mobile so content doesn't hide
 * behind the fixed BottomNav.
 */
export default function AppLayout() {
  return (
    <div className="app-layout">
      <Navbar />
      <OfflineBanner />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

