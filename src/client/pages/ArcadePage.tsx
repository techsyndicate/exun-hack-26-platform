import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import "./styles/arcade-page.css";
import { sorcerers, type Sorcerer } from "./sorcerers";

const MAX_HP = Math.max(...sorcerers.map((sorcerer) => sorcerer.hp));

function ArcadePage() {
  const [selected, setSelected] = useState<Sorcerer | null>(null);

  useEffect(() => {
    if (!selected) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <div className="main">
      <div className="arcade-container">
        <Navbar />
      </div>

      <div className="ledger-section">
        <p style={{ width: "70%", textAlign: "center", margin: "0 auto" }}>
          The arcade is where agents play to heal/train the already weakend
          sorcerers. They need to keep on defeating the sorcerers in order to
          keep healing them.
        </p>
      </div>

      <div className="arcade-section">
        <h2 className="section-title">Choose the Sorcerer</h2>
        <div className="sorcerer-grid">
          {sorcerers.map((sorcerer) => (
            <button
              key={sorcerer.name}
              className="sorcerer"
              onClick={() => setSelected(sorcerer)}
            >
              <img src={sorcerer.image} alt={sorcerer.name} />
              <p>
                {sorcerer.name} - {sorcerer.element}
              </p>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="sorcerer-backdrop" onClick={() => setSelected(null)}>
          <div
            className="sorcerer-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="sorcerer-close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <img src={selected.image} alt={selected.name} />
            <div className="sorcerer-info">
              <h3>{selected.name}</h3>
              <p className="sorcerer-element">{selected.element}</p>

              <div className="sorcerer-hp">
                <span>HP {selected.hp}</span>
                <div className="sorcerer-hp-bar">
                  <div style={{ width: `${(selected.hp / MAX_HP) * 100}%` }} />
                </div>
              </div>
              <p className="sorcerer-style">{selected.style}</p>

              <h4>Passive</h4>
              <div className="sorcerer-ability">
                <p className="sorcerer-ability-name">{selected.passive.name}</p>
                <p>{selected.passive.text}</p>
              </div>

              <h4>Abilities</h4>
              {selected.abilities.map((ability) => {
                const details = [
                  `${ability.cost} AP`,
                  ability.ultimate && "Ultimate",
                  ability.difficulty,
                ].filter(Boolean);

                return (
                  <div key={ability.name} className="sorcerer-ability">
                    <p className="sorcerer-ability-name">
                      {ability.name} <span>- {details.join(" - ")}</span>
                    </p>
                    <p>{ability.text}</p>
                  </div>
                );
              })}

              <h4>Matchups</h4>
              <p className="sorcerer-matchup">
                <span>Strong against</span> {selected.strongAgainst}
              </p>
              <p className="sorcerer-matchup">
                <span>Weak against</span> {selected.weakAgainst}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ArcadePage;
