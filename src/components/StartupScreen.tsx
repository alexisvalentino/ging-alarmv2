/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export default function StartupScreen() {
  return (
    <div
      className="relative min-h-dvh ambient-glow-bg ging-screen ging-screen--startup overflow-hidden"
      role="status"
      aria-busy="true"
    >
      <div className="glow-sphere-orange top-[-10%] left-[-15%]" />
      <div className="glow-sphere-red bottom-[-15%] right-[-10%]" />

      <div className="startup-loader z-10">
        <img
          className="startup-mascot"
          src="/gingy-mascot-cutout.webp"
          alt=""
          aria-hidden="true"
        />
        <p className="startup-label">Getting things ready</p>
        <div className="startup-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
