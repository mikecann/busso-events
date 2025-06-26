import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { navigation } from "../router";
import { Center, Loader } from "@mantine/core";

interface AuthRequiredProps {
  children: React.ReactNode;
}

export function AuthRequired({ children }: AuthRequiredProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigation.home().replace();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" />
        </Center>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}
