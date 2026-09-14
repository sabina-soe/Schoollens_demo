"use client";

import Link from "next/link";
import { projectPins, staticMapSrc, toPins } from "@/lib/map-pins";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  location: unknown;
};

export function BranchesMap({
  branches,
  activeId,
}: {
  branches: Branch[];
  activeId?: string;
}) {
  const pins = toPins(branches);
  const mapSrc = staticMapSrc(pins.map((pin) => pin.coord));
  const positions = projectPins(pins.map((pin) => pin.coord));

  if (!branches.length) return null;

  return (
    <section className="profile-map" aria-label="Branch locations">
      <h2>Locations</h2>
      <p className="directory-meta">Every campus in this network. A pin is city-level when the street address could not be geocoded.</p>
      {mapSrc ? (
        <div className="pin-map">
          {/* OSM static tiles; pins are the tap targets */}
          <img src={mapSrc} alt="Map of school branches" className="pin-map-image" />
          {pins.map((pin, index) => (
            <Link
              key={pin.id}
              href={`/schools/${pin.id}`}
              className={pin.id === activeId ? "map-pin map-pin-active" : "map-pin"}
              style={positions[index]}
              title={pin.name}
            >
              <span className="map-pin-dot" aria-hidden="true" />
              <span className="map-pin-label">{pin.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p>Branch pins are not geocoded yet. Addresses stay listed below.</p>
      )}
      <ul className="ledger">
        {branches.map((branch) => (
          <li key={branch.id}>
            {branch.id === activeId ? (
              <strong>{branch.name}</strong>
            ) : (
              <Link href={`/schools/${branch.id}`}>{branch.name}</Link>
            )}
            {branch.address ? <span> — {branch.address}</span> : null}
          </li>
        ))}
      </ul>
      <p className="map-credit">
        Map ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>
      </p>
    </section>
  );
}
