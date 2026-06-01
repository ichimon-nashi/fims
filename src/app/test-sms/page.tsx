"use client";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

export default function TestSms() {
  const { token } = useAuth();
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/dashboard/sms-reviews", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setResult);
  }, [token]);

  return <pre style={{ color: "white", background: "#111", padding: "2rem" }}>
    {JSON.stringify(result, null, 2)}
  </pre>;
}