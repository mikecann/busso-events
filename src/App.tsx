import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInForm } from "./SignInForm";
import { AuthenticatedApp } from "./components/AuthenticatedApp";
import { PublicApp } from "./components/PublicApp";
import { RouteProvider } from "./router";
import {
  Container,
  Center,
  Card,
  Title,
  Text,
  Button,
  Loader,
  Stack,
} from "@mantine/core";

export default function App() {
  return (
    <RouteProvider>
    <Container size="xl">
      <AuthLoading>
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" />
        </Center>
      </AuthLoading>
      <Unauthenticated>
          <PublicApp />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </Container>
    </RouteProvider>
  );
}
