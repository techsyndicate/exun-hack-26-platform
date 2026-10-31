import { useState, useEffect } from "react";
import { DEFAULT_AVATAR, useMe } from "../me";

async function getFakeUser() {
  const response = await fetch("/api/auth/fake");
  if (!response.ok) throw new Error("Could not check for fake user.");
  const data: { isFake?: boolean } = await response.json();
  return data?.isFake;
}

function Navbar() {
  const [isFake, setIsFake] = useState<boolean | null>(null);
  const me = useMe();
  useEffect(() => {
    void getFakeUser().then((isFake) => {
      setIsFake(isFake ?? null);
      console.log("isFake", isFake);
    });
  }, []);

  if (isFake !== null || me?.role === "unverified") {
    return (
      <nav className="navbar" aria-label="Main navigation">
        <div className="left">
          <h1>
            <a className="nav-link" href="/">
              HOME
            </a>
          </h1>
        </div>
        <div className="right">
          <a href="/account" aria-label="Open account">
            <img src={me?.avatar ?? DEFAULT_AVATAR} alt="" />
          </a>
        </div>
      </nav>
    );
  }

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
        <h1>
          <a className="nav-link" href="/vouch">
            VOUCH
          </a>
        </h1>
        {me?.role === "admin" && (
          <h1>
            <a className="nav-link" href="/admin">
              ADMIN
            </a>
          </h1>
        )}
      </div>
      <div className="right">
        <a href="/account" aria-label="Open account">
          <img src={me?.avatar ?? DEFAULT_AVATAR} alt="" />
        </a>
      </div>
    </nav>
  );
}

export default Navbar;
