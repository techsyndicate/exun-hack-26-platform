import React from "react";

function Navbar() {
  return (
    <div className="navbar">
      <div className="left">
        <h1>HOME</h1>
        <h1>LEDGE</h1>
        <h1>CHAT</h1>
        <h1>ARCADE</h1>
      </div>
      <div className="right">
        <img src="/assets/home/profile.png" alt="Profile" />
      </div>
    </div>
  );
}

export default Navbar;
