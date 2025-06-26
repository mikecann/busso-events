import { Header } from "./Header";
import { Container } from "@mantine/core";
import { useRoute } from "../router";

interface AuthenticatedPageLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedPageLayout({
  children,
}: AuthenticatedPageLayoutProps) {
  const route = useRoute();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}>
      <Header currentRoute={route.name} />
      <Container size="xl" py="xl" style={{ paddingTop: "6rem" }}>
        {children}
      </Container>
    </div>
  );
}
