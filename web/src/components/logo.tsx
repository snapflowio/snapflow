/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Link } from "react-router";

export function Logo({
  size = 28,
  asLink = true,
  className,
}: {
  size?: number;
  asLink?: boolean;
  className?: string;
}) {
  const logoImage = (
    <img
      src={"/branding/logo.png"}
      alt="snapflow logo"
      width={size}
      height={size}
      draggable="false"
      className={className}
    />
  );

  if (!asLink) {
    return (
      <>
        {logoImage}
        <span className="sr-only">Snapflow logo</span>
      </>
    );
  }

  return (
    <Link to={"/"}>
      {logoImage}
      <span className="sr-only">Snapflow logo</span>
    </Link>
  );
}
