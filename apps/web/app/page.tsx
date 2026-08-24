'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("goltex_username");
      const savedRole = localStorage.getItem("goltex_role");
      if (savedUser && savedRole) {
        router.replace("/hub");
      } else {
        router.replace("/login");
      }
    }
  }, [router]);

  return null;
}
