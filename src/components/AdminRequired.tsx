import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AuthRequired } from "./AuthRequired";
import { useEffect } from "react";
import { navigation } from "../router";
import { Center, Loader } from "@mantine/core";

interface AdminRequiredProps {
  children: React.ReactNode;
}

export function AdminRequired({ children }: AdminRequiredProps) {
  return (
    <AuthRequired>
      <AdminCheck>{children}</AdminCheck>
    </AuthRequired>
  );
}

function AdminCheck({ children }: AdminRequiredProps) {
  const isAdmin = useQuery(api.users.isCurrentUserAdmin);

  useEffect(() => {
    if (isAdmin === false) {
      navigation.home().replace();
    }
  }, [isAdmin]);

  if (isAdmin === undefined) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" />
        </Center>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
