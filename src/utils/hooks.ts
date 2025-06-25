import { useCallback } from "react";
import { notifications } from "@mantine/notifications";

interface UseAPIErrorHandlerOptions {
  /**
   * Custom error message to show. If not provided, will try to extract from error or use default.
   */
  customMessage?: string;
  /**
   * Whether to log the error to console. Defaults to true.
   */
  logError?: boolean;
  /**
   * Additional action to perform after showing the toast.
   */
  onError?: (error: unknown) => void;
}

/**
 * Hook that returns a memoized error handler for API calls.
 * Automatically shows toast notifications and optionally logs errors.
 *
 * @example
 * ```tsx
 * const handleError = useAPIErrorHandler({ customMessage: "Failed to save data" });
 *
 * const handleSubmit = async () => {
 *   try {
 *     await createSomething({ data });
 *     toast.success("Created successfully!");
 *   } catch (error) {
 *     handleError(error);
 *   }
 * };
 * ```
 */
export function useAPIErrorHandler(options: UseAPIErrorHandlerOptions = {}) {
  const { customMessage, logError = true, onError } = options;

  return useCallback(
    (error: unknown) => {
      // Log error to console if enabled
      if (logError) {
        console.error("API Error:", error);
      }

      // Determine error message
      let errorMessage = customMessage;

      if (!errorMessage) {
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else if (error && typeof error === "object" && "message" in error) {
          errorMessage = String((error as any).message);
        } else {
          errorMessage = "An unexpected error occurred";
        }
      }

      // Show notification
      notifications.show({
        title: "Error",
        message: errorMessage,
        color: "red",
      });

      // Call additional error handler if provided
      if (onError) {
        onError(error);
      }
    },
    [customMessage, logError, onError],
  );
}
