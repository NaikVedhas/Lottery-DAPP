import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import ScrollToTop from "./ScrollToTop";

const Layout = () => {
  return (
    <div className="SpaceGrotesk">
      <ScrollToTop />

      {/* Sticky Navbar wrapper */}
      <div className="sticky top-0 z-50">
        <Navbar />
      </div>

      {/* Content with auto spacing */}
      <div className="mt-0">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
