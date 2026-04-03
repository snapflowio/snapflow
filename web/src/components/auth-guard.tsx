/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loading } from "@/components/loading";
import { Path } from "@/constants/paths";
import { useAuth } from "@/hooks/use-auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPending && !user) navigate(Path.LOGIN, { replace: true });
  }, [user, isPending, navigate]);

  if (isPending || showLoader) {
    return <Loading />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
