import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import {
  Stack,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Divider,
  Box,
  Anchor,
} from "@mantine/core";
import { useAPIErrorHandler } from "./utils/hooks";
import { routes } from "./router";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const onApiError = useAPIErrorHandler();

  return (
    <Box style={{ width: "100%" }}>
      {/* <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData)
            .then((x) => {
              console.log(`signed in`, x);
              routes.home().push();
            })
            .catch((error) => {
              let toastTitle = "";
              if (error.message.includes("Invalid password")) {
                toastTitle = "Invalid password. Please try again.";
              } else {
                toastTitle =
                  flow === "signIn"
                    ? "Could not sign in, did you mean to sign up?"
                    : "Could not sign up, did you mean to sign in?";
              }
              notifications.show({
                message: toastTitle,
                color: "red",
              });
              setSubmitting(false);
            });
        }}
      >
        <Stack gap="md">
          <TextInput
            type="email"
            name="email"
            placeholder="Email"
            required
            size="md"
          />
          <PasswordInput
            name="password"
            placeholder="Password"
            required
            size="md"
          />
          <Button type="submit" loading={submitting} size="md" fullWidth>
            {flow === "signIn" ? "Sign in" : "Sign up"}
          </Button>
          <Text ta="center" size="sm" c="dimmed">
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
            <Anchor
              component="button"
              type="button"
              onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
            >
              {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
            </Anchor>
          </Text>
        </Stack>
      </form>
      <Divider label="or" labelPosition="center" my="lg" /> */}
      <Button
        onClick={() => {
          void signIn("google").catch(onApiError);
        }}
        size="md"
        color="red"
        fullWidth
      >
        {flow === "signIn" ? "Sign in with Google" : "Sign up with Google"}
      </Button>
    </Box>
  );
}
