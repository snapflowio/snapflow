/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import * as z from "zod";
import { AuthLayout } from "@/components/layouts/auth-layout";
import { Path } from "@/constants/paths";
import { useAuth } from "@/hooks/use-auth";

const INPUT_CLASS =
  "h-10 rounded-[5px] border border-border-1 bg-surface-2 px-3 font-season text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-icon";

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const { signUp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await signUp(values.name, values.email, values.password);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      reset();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout termsText="signing up">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-[430] font-season text-[28px] text-white leading-[100%] tracking-[-0.02em]">
            Create an account
          </h1>
          <p className="font-season text-[15px] text-text-icon">
            Sign up to get started with Snapflow
          </p>
        </div>

        {error && (
          <div className="rounded-[5px] border border-red-500/30 bg-red-500/10 px-4 py-3 font-season text-[14px] text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-season text-[14px] text-emerald-400">
            Verification email sent! Check your inbox and click the link to activate your account.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="font-season text-[13px] text-text-secondary">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              className={INPUT_CLASS}
              {...register("name")}
            />
            {errors.name && (
              <p className="font-season text-[12px] text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="font-season text-[13px] text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className={INPUT_CLASS}
              {...register("email")}
            />
            {errors.email && (
              <p className="font-season text-[12px] text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="font-season text-[13px] text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className={INPUT_CLASS}
              {...register("password")}
            />
            {errors.password && (
              <p className="font-season text-[12px] text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirmPassword"
              className="font-season text-[13px] text-text-secondary"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              className={INPUT_CLASS}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="font-season text-[12px] text-red-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border border-[#FFFFFF] bg-[#FFFFFF] font-[430] font-season text-[14px] text-black transition-colors hover:border-[#E0E0E0] hover:bg-[#E0E0E0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              "Creating account..."
            ) : (
              <span className="flex items-center gap-1">
                Create account
                <span className="inline-flex transition-transform duration-200 group-hover:translate-x-0.5">
                  {isHovered ? (
                    <ArrowRight className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </span>
              </span>
            )}
          </button>
        </form>

        <p className="text-center font-season text-[14px] text-text-icon">
          Already have an account?{" "}
          <Link
            to={Path.LOGIN}
            className="text-text-primary underline underline-offset-2 hover:text-white"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
