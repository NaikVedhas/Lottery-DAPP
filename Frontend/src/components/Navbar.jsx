import { NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { HandCoins, UserIcon } from "lucide-react";
import { IoWalletOutline } from "react-icons/io5";

const NavItem = ({ to, Icon, label, iconSize = 20 }) => {
  return (
    <li>
      <NavLink
        to={to}
        aria-label={label}
        className={({ isActive }) =>
          [
            "flex items-center justify-center gap-2 px-2 py-1 rounded-md transition",
            isActive
              ? "text-blue-600 font-semibold"
              : "text-gray-700 hover:text-blue-600",
          ].join(" ")
        }
      >
        <Icon size={iconSize} className="shrink-0" />
        <span className="hidden md:inline">{label}</span>
      </NavLink>
    </li>
  );
};

const Navbar = () => {
  return (
    <nav className="bg-white/95 shadow-md py-3 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      {/* Left links */}
      

      {/* Center Logo */}
      <div className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight px-2">
        <NavLink to="/" className="inline-flex items-center gap-1">
          Fund<span className="text-gray-700">Chain</span>
        </NavLink>
      </div>

      {/* Right links + connect */}
      <div className="flex items-center space-x-2 md:space-x-6">
        <ul className="flex items-center space-x-2 md:space-x-6 text-gray-700">
          <NavItem
            to="/profile"
            Icon={UserIcon}
            label="Profile"
            iconSize={20}
          />
          <NavItem
            to="/raise-funds"
            Icon={HandCoins}
            label="Raise Funds"
            iconSize={20}
          />
        </ul>

        {/* Connect Wallet */}
        <div className="flex items-center justify-center">
          <ConnectButton
            label={
              <span className="flex items-center justify-center gap-1 font-bold text-sm text-white">
                <IoWalletOutline size={20} />
                <span className="hidden md:inline">Connect Wallet</span>
              </span>
            }
            chainStatus="none"
            showBalance={false}
            accountStatus={{
              smallScreen: "avatar",
              largeScreen: "full",
            }}
          />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
