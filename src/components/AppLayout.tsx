import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

/**
 * Shared layout for all protected pages.
 * Renders the persistent Navbar above the active page via <Outlet />.
 */
export default function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
