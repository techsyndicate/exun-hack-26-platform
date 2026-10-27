import React from "react";

function Navbar() {
  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="left">
        <h1>
          <a className="nav-link" href="/">
            HOME
          </a>
        </h1>
        <h1>
          <a className="nav-link" href="/ledger">
            LEDGER
          </a>
        </h1>
        <h1>
          <a className="nav-link" href="/direct">
            CHAT
          </a>
        </h1>
        <h1>
          <a className="nav-link" href="/arcade">
            ARCADE
          </a>
        </h1>
      </div>
      <div className="right">
        <a href="/account" aria-label="Open account">
          <img src="/assets/home/profile.png" alt="" />
        </a>
      </div>
    </nav>
  );
}

export default Navbar;
